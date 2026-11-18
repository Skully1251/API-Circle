'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  keyPrefix: 'apikey:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const KEYS = {
  /** Cached key metadata by hash – the hot path for every API request. */
  hash: (keyHash) => `hash:${keyHash}`,
  HASH_TTL: 300, // 5 minutes

  /** Quick existence check by prefix. */
  exists: (keyPrefix) => `exists:${keyPrefix}`,
  EXISTS_TTL: 600,

  /** All keys belonging to a consumer. */
  consumer: (consumerId) => `consumer:${consumerId}`,
  CONSUMER_TTL: 300,

  /** Key status cache. */
  status: (apiKeyId) => `status:${apiKeyId}`,
  STATUS_TTL: 300,

  /** Rate limit sliding windows per key. */
  rateSec: (apiKeyId) => `rate:${apiKeyId}:sec`,
  rateMin: (apiKeyId) => `rate:${apiKeyId}:min`,
};

module.exports = { redis, KEYS };
