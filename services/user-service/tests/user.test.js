'use strict';

process.env.NODE_ENV = 'test';
const { describe, it, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const config = require('../src/config/env');
const { redis, authRedis } = require('../src/config/redis');
const { pool } = require('../src/config/db');
const rabbitmq = require('../src/utils/rabbitmq');

const UserProfile = require('../src/models/UserProfile');
const ProviderProfile = require('../src/models/ProviderProfile');
const ConsumerProfile = require('../src/models/ConsumerProfile');
const Organization = require('../src/models/Organization');
const OrganizationMember = require('../src/models/OrganizationMember');
const AccountSettings = require('../src/models/AccountSettings');

const profileService = require('../src/services/profileService');
const organizationService = require('../src/services/organizationService');
const settingsService = require('../src/services/settingsService');
const app = require('../src/app');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '99999999-9999-9999-9999-999999999999';
const ORG_ID = '33333333-3333-3333-3333-333333333333';

function signTestJwt({ userId = USER_ID, email = 'user@apicircle.com', roles = ['consumer'] } = {}) {
  return jwt.sign({ email, roles }, config.jwt.secret, {
    subject: userId,
    issuer: config.jwt.issuer,
    expiresIn: '15m',
  });
}

async function requestApp(method, path, { headers = {}, body } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('ProfileService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('returns cached user profile from Redis on cache hit', async () => {
    const cachedProfile = { user_id: USER_ID, display_name: 'Cached Dev' };
    mock.method(redis, 'get', async () => JSON.stringify(cachedProfile));
    const dbSpy = mock.method(UserProfile, 'findByUserId', async () => null);

    const profile = await profileService.getUserProfile(USER_ID);
    assert.deepEqual(profile, cachedProfile);
    assert.equal(dbSpy.mock.calls.length, 0);
  });

  it('fetches user profile from DB on cache miss and populates Redis', async () => {
    const dbProfile = { user_id: USER_ID, first_name: 'Ada', last_name: 'Lovelace' };
    mock.method(redis, 'get', async () => null);
    mock.method(UserProfile, 'findByUserId', async () => dbProfile);
    const setSpy = mock.method(redis, 'set', async () => 'OK');

    const profile = await profileService.getUserProfile(USER_ID);
    assert.deepEqual(profile, dbProfile);
    assert.equal(setSpy.mock.calls.length, 1);
  });

  it('throws 404 when user profile does not exist', async () => {
    mock.method(redis, 'get', async () => null);
    mock.method(UserProfile, 'findByUserId', async () => null);

    await assert.rejects(
      () => profileService.getUserProfile(USER_ID),
      (err) => err.statusCode === 404 && err.code === 'PROFILE_NOT_FOUND'
    );
  });

  it('upserts user profile with camelCase/snake_case fields and invalidates cache', async () => {
    const updated = { user_id: USER_ID, first_name: 'Grace', display_name: 'Grace H.' };
    mock.method(UserProfile, 'upsert', async (_uid, fields) => {
      assert.equal(fields.first_name, 'Grace');
      assert.equal(fields.display_name, 'Grace H.');
      return updated;
    });
    const delSpy = mock.method(redis, 'del', async () => 1);

    const result = await profileService.upsertUserProfile(USER_ID, {
      firstName: 'Grace',
      display_name: 'Grace H.',
    });
    assert.deepEqual(result, updated);
    assert.equal(delSpy.mock.calls.length, 1);
  });
});

describe('OrganizationService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('rejects duplicate organization slug with 409', async () => {
    mock.method(Organization, 'findBySlug', async () => ({ id: ORG_ID, slug: 'acme' }));

    await assert.rejects(
      () =>
        organizationService.createOrganization({
          name: 'Acme',
          slug: 'acme',
          ownerUserId: USER_ID,
        }),
      (err) => err.statusCode === 409 && err.code === 'SLUG_EXISTS'
    );
  });

  it('creates organization with owner transactionally', async () => {
    mock.method(Organization, 'findBySlug', async () => null);
    mock.method(Organization, 'createWithOwner', async (data) => ({
      id: ORG_ID,
      name: data.name,
      slug: data.slug,
      owner_user_id: data.ownerUserId,
    }));

    const org = await organizationService.createOrganization({
      name: 'Acme APIs',
      slug: 'acme-apis',
      ownerUserId: USER_ID,
    });
    assert.equal(org.id, ORG_ID);
    assert.equal(org.owner_user_id, USER_ID);
  });

  it('prevents non-admin members from adding new members', async () => {
    mock.method(Organization, 'findById', async () => ({ id: ORG_ID, owner_user_id: USER_ID }));
    mock.method(OrganizationMember, 'findMembership', async () => ({
      organization_id: ORG_ID,
      user_id: OTHER_USER_ID,
      role: 'member',
    }));

    await assert.rejects(
      () =>
        organizationService.addMember({
          orgId: ORG_ID,
          userId: ADMIN_ID,
          role: 'member',
          invitedBy: OTHER_USER_ID,
        }),
      (err) => err.statusCode === 403 && err.code === 'FORBIDDEN'
    );
  });

  it('prevents removing the primary organization owner', async () => {
    mock.method(Organization, 'findById', async () => ({ id: ORG_ID, owner_user_id: USER_ID }));

    await assert.rejects(
      () =>
        organizationService.removeMember({
          orgId: ORG_ID,
          targetUserId: USER_ID,
          requesterId: USER_ID,
        }),
      (err) => err.statusCode === 400 && err.code === 'CANNOT_REMOVE_OWNER'
    );
  });
});

describe('SettingsService', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('initializes default settings when none exist', async () => {
    const defaults = { user_id: USER_ID, email_notifications: true, theme: 'light' };
    mock.method(AccountSettings, 'findByUserId', async () => null);
    mock.method(AccountSettings, 'upsert', async () => defaults);

    const settings = await settingsService.getSettings(USER_ID);
    assert.deepEqual(settings, defaults);
  });
});

describe('HTTP Endpoints', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('GET /health returns 200 when postgres and redis are up', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ '?column?': 1 }] }));
    mock.method(redis, 'ping', async () => 'PONG');

    const res = await requestApp('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.service, 'user-service');
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.checks.postgres, 'up');
    assert.equal(res.body.checks.redis, 'up');
  });

  it('GET /users/me validates x-api-key via RabbitMQ RPC', async () => {
    mock.method(rabbitmq, 'validateApiKey', async (key) => {
      assert.equal(key, 'ac_live_test123');
      return {
        valid: true,
        user: { id: USER_ID, email: 'dev@apicircle.com', name: 'Dev' },
      };
    });

    const res = await requestApp('GET', '/users/me', {
      headers: { 'x-api-key': 'ac_live_test123' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, USER_ID);
    assert.equal(res.body.authenticatedBy, 'api-key-service via RabbitMQ');
  });

  it('GET /users/me returns 401 when x-api-key header is missing', async () => {
    const res = await requestApp('GET', '/users/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'UNAUTHORIZED');
  });

  it('PUT /api/v1/users/:id/profile rejects unauthenticated requests and other users', async () => {
    const unauth = await requestApp('PUT', `/api/v1/users/${USER_ID}/profile`, {
      body: { firstName: 'Test' },
    });
    assert.equal(unauth.status, 401);

    mock.method(authRedis, 'get', async () => null);
    const otherToken = signTestJwt({ userId: OTHER_USER_ID, roles: ['consumer'] });
    const forbidden = await requestApp('PUT', `/api/v1/users/${USER_ID}/profile`, {
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { firstName: 'Test' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');
  });

  it('PUT /api/v1/users/:id/profile updates profile for self', async () => {
    mock.method(authRedis, 'get', async () => null);
    mock.method(UserProfile, 'upsert', async () => ({
      user_id: USER_ID,
      first_name: 'Alan',
      last_name: 'Turing',
    }));
    mock.method(redis, 'del', async () => 1);

    const token = signTestJwt({ userId: USER_ID });
    const res = await requestApp('PUT', `/api/v1/users/${USER_ID}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      body: { firstName: 'Alan', lastName: 'Turing' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.first_name, 'Alan');
  });

  it('POST /api/v1/users/:id/provider-profile/verify requires admin role', async () => {
    mock.method(authRedis, 'get', async () => null);
    const userToken = signTestJwt({ userId: USER_ID, roles: ['provider'] });
    const forbidden = await requestApp('POST', `/api/v1/users/${USER_ID}/provider-profile/verify`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(forbidden.status, 403);

    mock.method(ProviderProfile, 'verify', async () => ({
      user_id: USER_ID,
      is_verified: true,
    }));
    const adminToken = signTestJwt({ userId: ADMIN_ID, roles: ['admin'] });
    const ok = await requestApp('POST', `/api/v1/users/${USER_ID}/provider-profile/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.providerProfile.is_verified, true);
  });

  it('POST /api/v1/organizations validates slug and creates org', async () => {
    mock.method(authRedis, 'get', async () => null);
    const token = signTestJwt({ userId: USER_ID });

    const invalidSlug = await requestApp('POST', '/api/v1/organizations', {
      headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Bad Org', slug: 'Invalid Slug!' },
    });
    assert.equal(invalidSlug.status, 400);
    assert.equal(invalidSlug.body.code, 'INVALID_SLUG');

    mock.method(Organization, 'findBySlug', async () => null);
    mock.method(Organization, 'createWithOwner', async (data) => ({
      id: ORG_ID,
      name: data.name,
      slug: data.slug,
      owner_user_id: data.ownerUserId,
    }));

    const created = await requestApp('POST', '/api/v1/organizations', {
      headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Good Org', slug: 'good-org' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.organization.slug, 'good-org');
  });

  it('GET /api/v1/users/:id/consumer-profile and /settings work for owner', async () => {
    mock.method(authRedis, 'get', async () => null);
    mock.method(ConsumerProfile, 'findByUserId', async () => ({
      user_id: USER_ID,
      company_name: 'DevCo',
    }));
    mock.method(AccountSettings, 'findByUserId', async () => ({
      user_id: USER_ID,
      theme: 'dark',
    }));

    const token = signTestJwt({ userId: USER_ID });
    const cp = await requestApp('GET', `/api/v1/users/${USER_ID}/consumer-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(cp.status, 200);
    assert.equal(cp.body.consumerProfile.company_name, 'DevCo');

    const settings = await requestApp('GET', `/api/v1/users/${USER_ID}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.settings.theme, 'dark');
  });
});

after(async () => {
  redis.disconnect();
  authRedis.disconnect();
});
