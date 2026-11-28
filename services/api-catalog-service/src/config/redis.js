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
  keyPrefix: 'catalog:',
});

redis.on('error', (err) => {
  if (!isTest) {
    console.error('Redis connection error:', err.message);
  }
});

// Separate client for reading cross-service keys (e.g., auth:blacklist:{hash})
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
  api: (apiId) => `api:${apiId}`,
  API_TTL: 600, // 10 minutes

  route: (slug, version) => `route:${slug}:${version}`,
  ROUTE_TTL: 600, // 10 minutes

  categoryApis: (categoryId) => `category:${categoryId}:apis`,
  CATEGORY_APIS_TTL: 300,

  categoriesTree: () => 'categories:tree',
  CATEGORIES_TTL: 600,

  apiEndpoints: (apiId) => `api:${apiId}:endpoints`,
  API_ENDPOINTS_TTL: 600,

  featured: () => 'featured',
  FEATURED_TTL: 300,

  search: (hash) => `search:${hash}`,
  SEARCH_TTL: 120, // 2 minutes

  providerConfig: (apiId) => `provider_config:${apiId}`,
  PROVIDER_CONFIG_TTL: 300,

  authBlacklist: (tokenHash) => `blacklist:${tokenHash}`,
};

module.exports = { redis, authRedis, KEYS };
