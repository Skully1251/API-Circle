'use strict';

const { redis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Redis-backed fixed/sliding window rate limiter for auth endpoints.
 * Fails open if Redis is unavailable so legitimate traffic is not blocked.
 */
function rateLimiter({ endpoint, maxRequests = 20, windowSeconds = KEYS.RATE_LIMIT_TTL } = {}) {
  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = KEYS.rateLimit(ip, endpoint || req.path);

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, maxRequests - current);
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(remaining));

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        res.set('Retry-After', String(ttl > 0 ? ttl : windowSeconds));
        return next(
          new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
        );
      }
    } catch (err) {
      logger.warn('Auth rate limiter Redis fallback (failing open)', { errMessage: err.message });
    }

    return next();
  };
}

module.exports = rateLimiter;
