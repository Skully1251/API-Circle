'use strict';

process.env.NODE_ENV = 'test';
const { describe, it, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// Mock db and redis before importing services so tests run offline without external DB/Redis
const db = require('../src/config/db');
const { redis } = require('../src/config/redis');

const tokenService = require('../src/services/tokenService');
const authService = require('../src/services/authService');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const RefreshToken = require('../src/models/RefreshToken');
const EmailVerification = require('../src/models/EmailVerification');
const PasswordReset = require('../src/models/PasswordReset');
const { validateEmail, validatePassword } = require('../src/middlewares/validate');

describe('TokenService', () => {
  it('generates opaque tokens and hashes deterministically with SHA-256', () => {
    const token = tokenService.generateOpaqueToken(16);
    assert.equal(token.length, 32);
    const hash1 = tokenService.hashToken(token);
    const hash2 = tokenService.hashToken(token);
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
  });

  it('signs and verifies a JWT access token when not blacklisted', async () => {
    const getMock = mock.method(redis, 'get', async () => null);
    const jwtToken = tokenService.signAccessToken({
      userId: 'user-123',
      email: 'dev@apicircle.com',
      roles: ['consumer'],
    });

    const payload = await tokenService.verifyAccessToken(jwtToken);
    assert.equal(payload.sub, 'user-123');
    assert.equal(payload.email, 'dev@apicircle.com');
    assert.deepEqual(payload.roles, ['consumer']);
    getMock.mock.restore();
  });

  it('rejects a blacklisted JWT access token', async () => {
    const getMock = mock.method(redis, 'get', async () => '1');
    const jwtToken = tokenService.signAccessToken({
      userId: 'user-123',
      email: 'dev@apicircle.com',
      roles: ['consumer'],
    });

    await assert.rejects(
      () => tokenService.verifyAccessToken(jwtToken),
      (err) => err.statusCode === 401 && err.code === 'TOKEN_REVOKED'
    );
    getMock.mock.restore();
  });
});

describe('AuthService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('prevents self-registration with admin role', async () => {
    await assert.rejects(
      () => authService.register({ email: 'admin@test.com', password: 'password123', role: 'admin' }),
      (err) => err.statusCode === 400 && err.code === 'INVALID_ROLE'
    );
  });

  it('rejects duplicate email registration', async () => {
    mock.method(User, 'findByEmail', async () => ({ id: 'existing-id', email: 'dup@test.com' }));

    await assert.rejects(
      () => authService.register({ email: 'dup@test.com', password: 'password123' }),
      (err) => err.statusCode === 409 && err.code === 'EMAIL_EXISTS'
    );
  });

  it('locks account after repeated failed login attempts', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    mock.method(User, 'findByEmail', async () => ({
      id: 'user-1',
      email: 'user@test.com',
      password_hash: passwordHash,
      is_active: true,
      failed_login_attempts: 4,
      locked_until: null,
    }));

    let recordedLock = null;
    mock.method(User, 'recordFailedLogin', async (_id, lockUntil) => {
      recordedLock = lockUntil;
    });
    mock.method(redis, 'incr', async () => 5);
    mock.method(redis, 'expire', async () => 1);

    await assert.rejects(
      () => authService.login({ email: 'user@test.com', password: 'wrong-password' }),
      (err) => err.statusCode === 401 && err.code === 'INVALID_CREDENTIALS'
    );
    assert.ok(recordedLock instanceof Date);
  });

  it('issues JWT and refresh token on valid login', async () => {
    const passwordHash = await bcrypt.hash('SecretPass123', 4);
    mock.method(User, 'findByEmail', async () => ({
      id: 'user-1',
      email: 'user@test.com',
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
      failed_login_attempts: 0,
      locked_until: null,
    }));
    mock.method(User, 'recordLogin', async () => {});
    mock.method(redis, 'del', async () => 1);
    mock.method(redis, 'get', async () => JSON.stringify(['consumer']));
    mock.method(RefreshToken, 'create', async ({ expiresAt }) => {
      assert.ok(expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()));
      return { id: 'rt-1' };
    });

    const result = await authService.login({
      email: 'user@test.com',
      password: 'SecretPass123',
      ipAddress: '127.0.0.1',
    });

    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);
    assert.equal(result.user.email, 'user@test.com');
    assert.deepEqual(result.user.roles, ['consumer']);
  });

  it('detects refresh token reuse and revokes the entire token family', async () => {
    mock.method(RefreshToken, 'findActiveByHash', async () => null);
    mock.method(db.pool, 'query', async () => ({
      rows: [{ id: 'rt-old', family_id: 'fam-999', revoked_at: new Date() }],
    }));
    let revokedFamilyId = null;
    mock.method(RefreshToken, 'revokeFamily', async (familyId) => {
      revokedFamilyId = familyId;
    });

    await assert.rejects(
      () => authService.refresh({ refreshToken: 'stolen-reused-token' }),
      (err) => err.statusCode === 401 && err.code === 'INVALID_REFRESH_TOKEN'
    );
    assert.equal(revokedFamilyId, 'fam-999');
  });

  it('verifies email with valid token', async () => {
    mock.method(EmailVerification, 'findValidByHash', async () => ({
      id: 'ev-1',
      user_id: 'user-1',
    }));
    let verifiedId = null;
    let verifiedUserId = null;
    mock.method(EmailVerification, 'markVerified', async (id) => { verifiedId = id; });
    mock.method(User, 'verifyEmail', async (uid) => { verifiedUserId = uid; });

    const res = await authService.verifyEmail({ token: 'valid-raw-token' });
    assert.equal(res.verified, true);
    assert.equal(verifiedId, 'ev-1');
    assert.equal(verifiedUserId, 'user-1');
  });

  it('resets password and revokes all refresh tokens', async () => {
    mock.method(PasswordReset, 'findValidByHash', async () => ({
      id: 'pr-1',
      user_id: 'user-1',
    }));
    let updatedHash = null;
    let revokedAllUserId = null;
    mock.method(User, 'updatePassword', async (_uid, hash) => { updatedHash = hash; });
    mock.method(PasswordReset, 'markUsed', async () => {});
    mock.method(RefreshToken, 'revokeAllForUser', async (uid) => { revokedAllUserId = uid; });

    await authService.resetPassword({ token: 'reset-tok', newPassword: 'NewPassword123' });
    assert.ok(updatedHash && updatedHash.startsWith('$2'));
    assert.equal(revokedAllUserId, 'user-1');
  });
});

describe('Validation Middlewares', () => {
  it('normalizes valid email to lowercase', () => {
    const req = { body: { email: '  User@Example.COM  ' } };
    let nextErr = null;
    validateEmail(req, {}, (err) => { nextErr = err || null; });
    assert.equal(nextErr, null);
    assert.equal(req.body.email, 'user@example.com');
  });

  it('rejects short passwords', () => {
    const req = { body: { password: '123' } };
    let nextErr = null;
    validatePassword('password')(req, {}, (err) => { nextErr = err; });
    assert.equal(nextErr.statusCode, 400);
    assert.equal(nextErr.code, 'WEAK_PASSWORD');
  });
});

describe('HTTP Express Routes & JWT End-to-End', () => {
  const app = require('../src/app');
  let server;
  let baseUrl;

  beforeEach(() => {
    mock.restoreAll();
  });

  it('serves /api/v1/auth/login, /me, /validate, and /logout with real JWT verification', async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    try {
      const passwordHash = await bcrypt.hash('SecretPass123', 4);
      mock.method(User, 'findByEmail', async () => ({
        id: 'user-http-1',
        email: 'http@test.com',
        password_hash: passwordHash,
        is_active: true,
        is_email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
      }));
      mock.method(User, 'findById', async () => ({
        id: 'user-http-1',
        email: 'http@test.com',
        is_active: true,
        is_email_verified: true,
        last_login_at: new Date(),
        created_at: new Date(),
      }));
      mock.method(User, 'recordLogin', async () => {});
      mock.method(RefreshToken, 'create', async ({ expiresAt }) => {
        assert.ok(expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()));
        return { id: 'rt-http-1' };
      });
      mock.method(require('../src/models/Permission'), 'findByUserId', async () => [
        { name: 'api:read' },
      ]);

      const blacklist = new Set();
      mock.method(redis, 'incr', async () => 1);
      mock.method(redis, 'expire', async () => 1);
      mock.method(redis, 'del', async () => 1);
      mock.method(redis, 'get', async (key) => {
        if (key.startsWith('user_roles:')) return JSON.stringify(['consumer']);
        if (key.startsWith('blacklist:')) {
          const hash = key.slice('blacklist:'.length);
          return blacklist.has(hash) ? '1' : null;
        }
        return null;
      });
      mock.method(redis, 'set', async (key) => {
        if (key.startsWith('blacklist:')) {
          blacklist.add(key.slice('blacklist:'.length));
        }
        return 'OK';
      });

      // 1. Login -> get real JWT + refreshToken
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'http@test.com', password: 'SecretPass123' }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.ok(loginData.accessToken);
      assert.ok(loginData.refreshToken);

      // 2. Access protected /me with Bearer JWT
      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${loginData.accessToken}` },
      });
      assert.equal(meRes.status, 200);
      const meData = await meRes.json();
      assert.equal(meData.user.email, 'http@test.com');
      assert.deepEqual(meData.user.permissions, ['api:read']);

      // 3. Validate token via /validate
      const valRes = await fetch(`${baseUrl}/api/v1/auth/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: loginData.accessToken }),
      });
      assert.equal(valRes.status, 200);
      const valData = await valRes.json();
      assert.equal(valData.valid, true);

      // 4. Logout -> blacklists JWT in Redis
      const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${loginData.accessToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(logoutRes.status, 200);

      // 5. Subsequent /me with same JWT is rejected as TOKEN_REVOKED
      const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${loginData.accessToken}` },
      });
      assert.equal(meAfterLogout.status, 401);
      const errData = await meAfterLogout.json();
      assert.equal(errData.code, 'TOKEN_REVOKED');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

after(async () => {
  redis.disconnect();
  await db.pool.end();
});
