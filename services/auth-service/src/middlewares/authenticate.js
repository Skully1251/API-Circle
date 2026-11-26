'use strict';

const tokenService = require('../services/tokenService');
const AppError = require('../utils/AppError');

/**
 * Verifies Bearer JWT access token and checks Redis blacklist.
 * Attaches `req.user` and `req.accessToken` on success.
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

    const payload = await tokenService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
    };
    req.accessToken = token;
    req.tokenPayload = payload;
    return next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN'));
  }
}

module.exports = authenticate;
