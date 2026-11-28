'use strict';

const { redis, KEYS } = require('../config/redis');
const Api = require('../models/Api');
const ApiVersion = require('../models/ApiVersion');
const ProviderConfig = require('../models/ProviderConfig');
const { decryptAuthConfig } = require('../utils/crypto');
const logger = require('../utils/logger');

function extractSecret(authConfig) {
  if (!authConfig || typeof authConfig !== 'object') return null;
  return (
    authConfig.secret ||
    authConfig.token ||
    authConfig.apiKey ||
    authConfig.api_key ||
    authConfig.accessToken ||
    authConfig.password ||
    null
  );
}

function buildRoutePayload(api, version, providerConfig) {
  const decryptedAuth = providerConfig ? decryptAuthConfig(providerConfig.auth_config) : {};
  return {
    apiId: api.id,
    slug: api.slug,
    version: version.version,
    isDefault: version.is_default,
    status: api.status,
    visibility: api.visibility,
    targetBaseUrl: version.base_url,
    authType: providerConfig?.auth_type || 'none',
    secret: extractSecret(decryptedAuth),
    authConfig: decryptedAuth,
    timeoutMs: providerConfig?.timeout_ms ?? 30000,
    retryCount: providerConfig?.retry_count ?? 0,
    rateLimitPerSecond: providerConfig?.rate_limit_per_second ?? null,
    customHeaders: providerConfig?.custom_headers || {},
  };
}

/**
 * Synchronizes all version routes for an API into Redis (`catalog:route:{slug}:{version}`).
 * Active versions of published APIs are cached; inactive/unpublished routes are evicted.
 */
async function syncApiRoutes(apiId) {
  const api = await Api.findById(apiId);
  if (!api) return;

  const [versions, providerConfig] = await Promise.all([
    ApiVersion.findByApi(apiId),
    ProviderConfig.findByApiId(apiId),
  ]);

  for (const ver of versions) {
    const key = KEYS.route(api.slug, ver.version);
    try {
      if (api.status === 'published' && ver.status === 'active') {
        const payload = buildRoutePayload(api, ver, providerConfig);
        await redis.set(key, JSON.stringify(payload), 'EX', KEYS.ROUTE_TTL);
      } else {
        await redis.del(key);
      }
    } catch (err) {
      logger.warn('Failed to sync route cache in Redis', {
        apiId,
        slug: api.slug,
        version: ver.version,
        errMessage: err.message,
      });
    }
  }
}

/**
 * Evicts Redis route entries for a given slug and version list.
 */
async function invalidateApiRoutes(slug, versions = []) {
  for (const ver of versions) {
    const versionName = typeof ver === 'string' ? ver : ver.version;
    if (!versionName) continue;
    try {
      await redis.del(KEYS.route(slug, versionName));
    } catch (err) {
      logger.warn('Failed to invalidate route cache in Redis', {
        slug,
        version: versionName,
        errMessage: err.message,
      });
    }
  }
}

/**
 * Resolves a route from Redis (`catalog:route:{slug}:{version}`), falling back to DB on miss.
 */
async function getRoute(slug, version) {
  const key = KEYS.route(slug, version);
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn('Redis route lookup failed, falling back to DB', {
      slug,
      version,
      errMessage: err.message,
    });
  }

  const api = await Api.findBySlug(slug);
  if (!api || api.status !== 'published') return null;

  const ver = await ApiVersion.findByApiAndVersion(api.id, version);
  if (!ver || ver.status !== 'active') return null;

  const providerConfig = await ProviderConfig.findByApiId(api.id);
  const payload = buildRoutePayload(api, ver, providerConfig);

  try {
    await redis.set(key, JSON.stringify(payload), 'EX', KEYS.ROUTE_TTL);
  } catch (err) {
    logger.warn('Failed to populate route cache in Redis', {
      slug,
      version,
      errMessage: err.message,
    });
  }

  return payload;
}

/**
 * Invalidates metadata caches for an API.
 */
async function invalidateApiCaches(apiId, categoryId = null) {
  const keysToDelete = [
    KEYS.api(apiId),
    KEYS.apiEndpoints(apiId),
    KEYS.featured(),
  ];
  if (categoryId) {
    keysToDelete.push(KEYS.categoryApis(categoryId));
  }
  try {
    await redis.del(...keysToDelete);
  } catch (err) {
    logger.warn('Failed to invalidate API caches in Redis', {
      apiId,
      errMessage: err.message,
    });
  }
}

module.exports = {
  syncApiRoutes,
  invalidateApiRoutes,
  getRoute,
  invalidateApiCaches,
  buildRoutePayload,
};
