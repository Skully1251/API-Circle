'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  keyPrefix: 'catalog:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

const KEYS = {
  api: (apiId) => `api:${apiId}`,
  API_TTL: 600, // 10 minutes

  categoryApis: (categoryId) => `category:${categoryId}:apis`,
  CATEGORY_APIS_TTL: 300,

  apiEndpoints: (apiId) => `api:${apiId}:endpoints`,
  API_ENDPOINTS_TTL: 600,

  featured: () => 'featured',
  FEATURED_TTL: 300,

  search: (hash) => `search:${hash}`,
  SEARCH_TTL: 120, // 2 minutes

  providerConfig: (apiId) => `provider_config:${apiId}`,
  PROVIDER_CONFIG_TTL: 300,
};

module.exports = { redis, KEYS };
