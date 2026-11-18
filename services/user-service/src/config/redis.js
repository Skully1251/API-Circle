'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  keyPrefix: 'user:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const KEYS = {
  profile: (userId) => `profile:${userId}`,
  PROFILE_TTL: 600, // 10 minutes

  org: (orgId) => `org:${orgId}`,
  ORG_TTL: 600,

  orgMembers: (orgId) => `org_members:${orgId}`,
  ORG_MEMBERS_TTL: 300, // 5 minutes
};

module.exports = { redis, KEYS };
