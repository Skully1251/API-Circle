'use strict';

const Api = require('../models/Api');
const ProviderConfig = require('../models/ProviderConfig');
const { redis, KEYS } = require('../config/redis');
const { encryptAuthConfig, sanitizeProviderConfig } = require('../utils/crypto');
const routeCacheService = require('./routeCacheService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function assertApiOwnership(api, currentUser) {
  if (!api) {
    throw new AppError('API not found', 404, 'API_NOT_FOUND');
  }
  const isAdmin = currentUser?.roles?.includes('admin');
  if (api.provider_id !== currentUser?.id && !isAdmin) {
    throw new AppError('You do not have permission to configure this API', 403, 'FORBIDDEN');
  }
}

async function upsertProviderConfig(apiId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertApiOwnership(api, currentUser);

  const authType = payload.auth_type || payload.authType || 'none';
  const rawAuthConfig = payload.auth_config || payload.authConfig || {};
  const encryptedAuthConfig = encryptAuthConfig(rawAuthConfig);

  const saved = await ProviderConfig.upsert({
    apiId,
    authType,
    authConfig: encryptedAuthConfig,
    rateLimitPerSecond: payload.rate_limit_per_second ?? payload.rateLimitPerSecond ?? null,
    timeoutMs: payload.timeout_ms ?? payload.timeoutMs ?? 30000,
    retryCount: payload.retry_count ?? payload.retryCount ?? 0,
    customHeaders: payload.custom_headers || payload.customHeaders || {},
  });

  try {
    await redis.del(KEYS.providerConfig(apiId));
  } catch (err) {
    logger.warn('Failed to invalidate provider_config cache', { apiId, errMessage: err.message });
  }

  await routeCacheService.syncApiRoutes(apiId);

  return sanitizeProviderConfig(saved);
}

async function getProviderConfig(apiId, currentUser) {
  const api = await Api.findById(apiId);
  assertApiOwnership(api, currentUser);

  const record = await ProviderConfig.findByApiId(apiId);
  if (!record) {
    throw new AppError('Provider configuration not found', 404, 'PROVIDER_CONFIG_NOT_FOUND');
  }

  return sanitizeProviderConfig(record);
}

module.exports = {
  upsertProviderConfig,
  getProviderConfig,
};
