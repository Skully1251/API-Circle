'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  keyPrefix: 'auth:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

/* ------------------------------------------------------------------ */
/*  Key helpers – centralise key shapes and default TTLs              */
/* ------------------------------------------------------------------ */

const KEYS = {
  /** Token blacklist entry. TTL should match remaining token lifetime. */
  blacklist: (tokenHash) => `blacklist:${tokenHash}`,

  /** Failed login attempts counter. */
  loginAttempts: (email) => `login_attempts:${email}`,
  LOGIN_ATTEMPTS_TTL: 900, // 15 minutes

  /** Cached role names for a user. */
  userRoles: (userId) => `user_roles:${userId}`,
  USER_ROLES_TTL: 300, // 5 minutes

  /** Sliding-window rate limiting. */
  rateLimit: (ip, endpoint) => `rate_limit:${ip}:${endpoint}`,
  RATE_LIMIT_TTL: 60, // 1 minute window
};

module.exports = { redis, KEYS };
