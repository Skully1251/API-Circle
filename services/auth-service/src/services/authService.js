'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { getClient, query } = require('../config/db');
const { redis, KEYS } = require('../config/redis');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RefreshToken = require('../models/RefreshToken');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');
const tokenService = require('./tokenService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const PUBLIC_REGISTER_ROLES = new Set(['consumer', 'provider']);

/**
 * Helper to fetch and cache role names for a user.
 */
async function getUserRoleNames(userId) {
  const cacheKey = KEYS.userRoles(userId);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn('Redis role cache read failed', { errMessage: err.message });
  }

  const roles = await Role.findByUserId(userId);
  const roleNames = roles.map((r) => r.name);

  try {
    await redis.set(cacheKey, JSON.stringify(roleNames), 'EX', KEYS.USER_ROLES_TTL);
  } catch (err) {
    logger.warn('Redis role cache write failed', { errMessage: err.message });
  }

  return roleNames;
}

const authService = {
  /**
   * Register a new user, assign default role, and create an email verification token.
   */
  async register({ email, password, role = 'consumer' }) {
    if (!PUBLIC_REGISTER_ROLES.has(role)) {
      throw new AppError(
        'Invalid role for self-registration. Allowed roles: consumer, provider',
        400,
        'INVALID_ROLE'
      );
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const assignedRole = await Role.findByName(role);
    if (!assignedRole) {
      throw new AppError(`Role '${role}' is not configured in database`, 500, 'ROLE_NOT_FOUND');
    }

    const client = await getClient();
    let createdUser;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO auth.users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, is_email_verified, is_active, created_at`,
        [email, passwordHash]
      );
      createdUser = rows[0];

      await client.query(
        `INSERT INTO auth.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [createdUser.id, assignedRole.id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
      }
      throw err;
    } finally {
      client.release();
    }

    // Create email verification token
    const rawVerificationToken = tokenService.generateOpaqueToken();
    const verificationExpiresAt = new Date(
      Date.now() + config.security.emailVerificationExpiresHours * 60 * 60 * 1000
    );
    await EmailVerification.create({
      userId: createdUser.id,
      tokenHash: tokenService.hashToken(rawVerificationToken),
      expiresAt: verificationExpiresAt,
    });

    logger.info('User registered', { userId: createdUser.id, role });

    const result = {
      user: {
        ...createdUser,
        roles: [role],
      },
    };

    // Expose verification token only in non-production environments for local/CI testing
    if (config.nodeEnv !== 'production') {
      result.verificationToken = rawVerificationToken;
    }

    return result;
  },

  /**
   * Authenticate user credentials, enforce lockout policy, and issue JWT + Refresh Token.
   */
  async login({ email, password, ipAddress = null, userAgent = null }) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DISABLED');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError(
        'Account is temporarily locked due to too many failed login attempts',
        423,
        'ACCOUNT_LOCKED'
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      const nextAttempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = nextAttempts >= config.security.maxFailedLoginAttempts;
      const lockUntil = shouldLock
        ? new Date(Date.now() + config.security.lockoutMinutes * 60 * 1000)
        : null;

      await User.recordFailedLogin(user.id, lockUntil);
      try {
        await redis.incr(KEYS.loginAttempts(email));
        await redis.expire(KEYS.loginAttempts(email), KEYS.LOGIN_ATTEMPTS_TTL);
      } catch (err) {
        logger.warn('Redis loginAttempts update failed', { errMessage: err.message });
      }

      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    await User.recordLogin(user.id, ipAddress);
    try {
      await redis.del(KEYS.loginAttempts(email));
    } catch (err) {
      logger.warn('Redis loginAttempts clear failed', { errMessage: err.message });
    }

    const roles = await getUserRoleNames(user.id);
    const accessToken = tokenService.signAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const rawRefreshToken = tokenService.generateOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000
    );

    await RefreshToken.create({
      userId: user.id,
      tokenHash: tokenService.hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiresAt,
      userAgent,
      ipAddress,
    });

    logger.info('User logged in', { userId: user.id });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.accessExpiresSeconds,
      user: {
        id: user.id,
        email: user.email,
        isEmailVerified: user.is_email_verified,
        roles,
      },
    };
  },

  /**
   * Rotate a refresh token with token-family reuse detection.
   */
  async refresh({ refreshToken, ipAddress = null, userAgent = null }) {
    const tokenHash = tokenService.hashToken(refreshToken);
    const activeToken = await RefreshToken.findActiveByHash(tokenHash);

    if (!activeToken) {
      // Check if this token was previously revoked (potential theft/reuse!)
      const { rows } = await query(
        'SELECT id, family_id, revoked_at FROM auth.refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );
      if (rows[0] && rows[0].revoked_at) {
        await RefreshToken.revokeFamily(rows[0].family_id, 'token_reuse_detected');
        logger.warn('Refresh token reuse detected; family revoked', {
          familyId: rows[0].family_id,
        });
      }
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(activeToken.user_id);
    if (!user || !user.is_active) {
      throw new AppError('User account is inactive or not found', 401, 'ACCOUNT_DISABLED');
    }

    // Revoke the used refresh token and issue a replacement in the same family
    await RefreshToken.revoke(activeToken.id, 'rotation');

    const roles = await getUserRoleNames(user.id);
    const newAccessToken = tokenService.signAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const newRawRefreshToken = tokenService.generateOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000
    );

    await RefreshToken.create({
      userId: user.id,
      tokenHash: tokenService.hashToken(newRawRefreshToken),
      familyId: activeToken.family_id,
      expiresAt: refreshExpiresAt,
      userAgent,
      ipAddress,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.accessExpiresSeconds,
    };
  },

  /**
   * Logout: blacklist current access token and revoke refresh token if provided.
   */
  async logout({ accessToken, refreshToken }) {
    if (accessToken) {
      await tokenService.blacklistAccessToken(accessToken);
    }

    if (refreshToken) {
      const tokenHash = tokenService.hashToken(refreshToken);
      const activeToken = await RefreshToken.findActiveByHash(tokenHash);
      if (activeToken) {
        await RefreshToken.revoke(activeToken.id, 'logout');
      }
    }
  },

  /**
   * Verify user email using the opaque verification token.
   */
  async verifyEmail({ token }) {
    const tokenHash = tokenService.hashToken(token);
    const record = await EmailVerification.findValidByHash(tokenHash);
    if (!record) {
      throw new AppError('Invalid or expired email verification token', 400, 'INVALID_TOKEN');
    }

    await EmailVerification.markVerified(record.id);
    await User.verifyEmail(record.user_id);

    logger.info('Email verified', { userId: record.user_id });
    return { verified: true };
  },

  /**
   * Initiate password reset flow. Always succeeds silently to avoid email enumeration.
   */
  async forgotPassword({ email, ipAddress = null }) {
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      return { message: 'If an account exists for that email, a reset link has been sent.' };
    }

    await PasswordReset.invalidatePendingForUser(user.id);

    const rawResetToken = tokenService.generateOpaqueToken();
    const expiresAt = new Date(
      Date.now() + config.security.passwordResetExpiresMinutes * 60 * 1000
    );

    await PasswordReset.create({
      userId: user.id,
      tokenHash: tokenService.hashToken(rawResetToken),
      expiresAt,
      ipAddress,
    });

    logger.info('Password reset requested', { userId: user.id });

    const response = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };
    if (config.nodeEnv !== 'production') {
      response.resetToken = rawResetToken;
    }
    return response;
  },

  /**
   * Complete password reset and revoke all active refresh tokens.
   */
  async resetPassword({ token, newPassword }) {
    const tokenHash = tokenService.hashToken(token);
    const record = await PasswordReset.findValidByHash(tokenHash);
    if (!record) {
      throw new AppError('Invalid or expired password reset token', 400, 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await User.updatePassword(record.user_id, passwordHash);
    await PasswordReset.markUsed(record.id);
    await RefreshToken.revokeAllForUser(record.user_id, 'password_reset');

    logger.info('Password reset completed', { userId: record.user_id });
    return { message: 'Password has been reset successfully.' };
  },

  /**
   * Fetch authenticated user profile, roles, and resolved permissions.
   */
  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const roles = await getUserRoleNames(userId);
    const permissions = await Permission.findByUserId(userId);

    return {
      id: user.id,
      email: user.email,
      isEmailVerified: user.is_email_verified,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      roles,
      permissions: permissions.map((p) => p.name),
    };
  },
};

module.exports = authService;
