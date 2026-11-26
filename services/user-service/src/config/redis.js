'use strict';

const Redis = require('ioredis');
const config = require('./env');

const isTest = config.nodeEnv === 'test';

const baseOptions = {
  maxRetriesPerRequest: 3,
  lazyConnect: isTest,
  retryStrategy(times) {
    if (isTest) return null;
    return Math.min(times * 200, 5000);
  },
};

const redis = new Redis(config.redisUrl, {
  ...baseOptions,
  keyPrefix: 'user:',
});

redis.on('error', (err) => {
  if (!isTest) {
    console.error('Redis connection error:', err.message);
  }
});

// Separate client without keyPrefix for reading cross-service keys (e.g., auth:blacklist:{hash})
const authRedis = new Redis(config.redisUrl, {
  ...baseOptions,
  keyPrefix: 'auth:',
});

authRedis.on('error', (err) => {
  if (!isTest) {
    console.error('Auth Redis connection error:', err.message);
  }
});

const KEYS = {
  profile: (userId) => `profile:${userId}`,
  PROFILE_TTL: 600, // 10 minutes

  org: (orgId) => `org:${orgId}`,
  ORG_TTL: 600,

  orgMembers: (orgId) => `org_members:${orgId}`,
  ORG_MEMBERS_TTL: 300, // 5 minutes

  authBlacklist: (tokenHash) => `blacklist:${tokenHash}`,
};

module.exports = { redis, authRedis, KEYS };
