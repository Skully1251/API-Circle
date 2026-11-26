'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { redis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const tokenService = {
  /**
   * Generate a cryptographically secure random opaque token.
   */
  generateOpaqueToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  },

  /**
   * Compute SHA-256 hex digest of a token (for DB storage & Redis blacklist keys).
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  },

  /**
   * Sign a short-lived JWT access token.
   */
  signAccessToken({ userId, email, roles }) {
    return jwt.sign(
      {
        email,
        roles,
      },
      config.jwt.secret,
      {
        subject: String(userId),
        issuer: config.jwt.issuer,
        expiresIn: config.jwt.accessExpiresIn,
        jwtid: crypto.randomUUID(),
      }
    );
  },

  /**
   * Verify a JWT access token and ensure it has not been blacklisted in Redis.
   */
  async verifyAccessToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Access token has expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
    }

    const tokenHash = this.hashToken(token);
    try {
      const isBlacklisted = await redis.get(KEYS.blacklist(tokenHash));
      if (isBlacklisted) {
        throw new AppError('Access token has been revoked', 401, 'TOKEN_REVOKED');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn('Redis blacklist check failed (failing open)', { errMessage: err.message });
    }

    return payload;
  },

  /**
   * Blacklist an access token in Redis until its natural expiration.
   */
  async blacklistAccessToken(token) {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return;

    const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return;

    const tokenHash = this.hashToken(token);
    try {
      await redis.set(KEYS.blacklist(tokenHash), '1', 'EX', ttlSeconds);
    } catch (err) {
      logger.error('Failed to blacklist access token in Redis', { errMessage: err.message });
    }
  },
};

module.exports = tokenService;
