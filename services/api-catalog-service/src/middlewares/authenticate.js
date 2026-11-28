'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { authRedis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

async function verifyToken(token) {
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

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const isBlacklisted = await authRedis.get(KEYS.authBlacklist(tokenHash));
    if (isBlacklisted) {
      throw new AppError('Access token has been revoked', 401, 'TOKEN_REVOKED');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn('Redis blacklist check failed (failing open)', { errMessage: err.message });
  }

  return {
    id: payload.sub,
    email: payload.email,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
  };
}

/**
 * Verifies Bearer JWT access token issued by auth-service and checks Redis blacklist.
 */
async function authenticate(req, _res, next) {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization Bearer token is required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Authorization Bearer token is required', 401, 'UNAUTHORIZED');
    }

    req.user = await verifyToken(token);
    return next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN'));
  }
}

/**
 * Attaches `req.user` if a valid Bearer token is provided; otherwise continues unauthenticated.
 */
async function optionalAuthenticate(req, _res, next) {
  const authHeader = req.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    req.user = await verifyToken(token);
  } catch (_err) {
    // Public routes ignore invalid/expired optional tokens and treat caller as anonymous
  }
  return next();
}

/**
 * Ensures the authenticated user has at least one of the required roles.
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    const userRoles = req.user?.roles || [];
    if (roles.some((role) => userRoles.includes(role))) {
      return next();
    }
    return next(new AppError('Insufficient role permissions', 403, 'FORBIDDEN'));
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
};
