'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  keyPrefix: 'notif:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const KEYS = {
  /** Unread notification count per user. */
  unread: (userId) => `unread:${userId}`,
  UNREAD_TTL: 120, // 2 minutes

  /** Cached user notification preferences. */
  prefs: (userId) => `prefs:${userId}`,
  PREFS_TTL: 600,

  /** Cached notification template by name. */
  template: (name) => `template:${name}`,
  TEMPLATE_TTL: 1800, // 30 minutes

  /**
   * Email retry queue – a Redis sorted set with next_retry_at as score.
   * Members are email_delivery IDs.
   */
  RETRY_QUEUE: 'retry_queue',

  /** Rate limiting: prevent notification flooding per user per type. */
  rate: (userId, type) => `rate:${userId}:${type}`,
  RATE_TTL: 60,
};

module.exports = { redis, KEYS };
