'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  keyPrefix: 'sub:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const KEYS = {
  /** Quick lookup: does this consumer have an active sub for this API? */
  consumerApi: (consumerId, apiId) => `consumer:${consumerId}:api:${apiId}`,
  CONSUMER_API_TTL: 300,

  plan: (planId) => `plan:${planId}`,
  PLAN_TTL: 600,

  apiPlans: (apiId) => `api:${apiId}:plans`,
  API_PLANS_TTL: 300,

  quota: (subscriptionId) => `quota:${subscriptionId}`,
  QUOTA_TTL: 60,

  /** Rate limit sliding windows */
  rateSec: (subscriptionId) => `rate:${subscriptionId}:sec`,
  rateMin: (subscriptionId) => `rate:${subscriptionId}:min`,

  /** Daily request counter */
  daily: (subscriptionId, date) => `daily:${subscriptionId}:${date}`,
  DAILY_TTL: 90000, // 25 hours
};

module.exports = { redis, KEYS };
