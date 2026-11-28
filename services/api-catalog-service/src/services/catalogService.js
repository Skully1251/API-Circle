'use strict';

const crypto = require('crypto');
const Api = require('../models/Api');
const Category = require('../models/Category');
const ApiVersion = require('../models/ApiVersion');
const ApiEndpoint = require('../models/ApiEndpoint');
const ApiDocumentation = require('../models/ApiDocumentation');
const { redis, KEYS } = require('../config/redis');
const { isUuid } = require('../middlewares/validate');
const { validateTargetUrl } = require('../utils/ssrf');
const routeCacheService = require('./routeCacheService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function isAdminUser(user) {
  return Boolean(user?.roles?.includes('admin'));
}

function assertOwnership(api, currentUser) {
  if (!api) {
    throw new AppError('API not found', 404, 'API_NOT_FOUND');
  }
  if (api.provider_id !== currentUser?.id && !isAdminUser(currentUser)) {
    throw new AppError('You do not have permission to modify this API', 403, 'FORBIDDEN');
  }
}

function assertCanViewApi(api, currentUser) {
  if (!api) {
    throw new AppError('API not found', 404, 'API_NOT_FOUND');
  }
  const isOwnerOrAdmin = api.provider_id === currentUser?.id || isAdminUser(currentUser);
  if ((api.status !== 'published' || api.visibility === 'private') && !isOwnerOrAdmin) {
    throw new AppError('API not found', 404, 'API_NOT_FOUND');
  }
}

async function resolveApi(idOrSlug) {
  return isUuid(idOrSlug) ? Api.findById(idOrSlug) : Api.findBySlug(idOrSlug);
}

function hashSearchParams(params) {
  return crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
}

async function listApis(queryParams, currentUser) {
  const isAdmin = isAdminUser(currentUser);
  const mine = queryParams.mine === 'true' || queryParams.mine === true;

  let status = queryParams.status;
  let visibility = queryParams.visibility;
  let providerId = queryParams.providerId || queryParams.provider_id;

  if (mine) {
    if (!currentUser) {
      throw new AppError('Authentication required to list your APIs', 401, 'UNAUTHORIZED');
    }
    providerId = currentUser.id;
  } else if (!isAdmin) {
    // Public catalog listing only exposes published & public APIs unless viewing own APIs
    if (!providerId || providerId !== currentUser?.id) {
      status = 'published';
      visibility = 'public';
    }
  }

  const filters = {
    categoryId: queryParams.categoryId || queryParams.category_id,
    categorySlug: queryParams.category || queryParams.categorySlug,
    search: queryParams.search || queryParams.q,
    visibility,
    status,
    providerId,
    isFeatured:
      queryParams.featured !== undefined
        ? queryParams.featured === 'true' || queryParams.featured === true
        : undefined,
    tag: queryParams.tag,
    limit: queryParams.limit ?? 20,
    offset: queryParams.offset ?? 0,
  };

  const isPublicCacheable = !mine && !providerId && status === 'published' && visibility === 'public';
  const cacheKey = isPublicCacheable ? KEYS.search(hashSearchParams(filters)) : null;

  if (cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn('Redis search lookup failed', { errMessage: err.message });
    }
  }

  const result = await Api.search(filters);

  if (cacheKey) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', KEYS.SEARCH_TTL);
    } catch (err) {
      logger.warn('Redis search cache set failed', { errMessage: err.message });
    }
  }

  return result;
}

async function listFeaturedApis(limit = 10) {
  try {
    const cached = await redis.get(KEYS.featured());
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn('Redis featured lookup failed', { errMessage: err.message });
  }

  const items = await Api.findFeatured(Math.min(Math.max(Number(limit) || 10, 1), 50));

  try {
    await redis.set(KEYS.featured(), JSON.stringify(items), 'EX', KEYS.FEATURED_TTL);
  } catch (err) {
    logger.warn('Redis featured cache set failed', { errMessage: err.message });
  }

  return items;
}

async function getApiDetails(idOrSlug, currentUser) {
  const api = await resolveApi(idOrSlug);
  assertCanViewApi(api, currentUser);

  const isPublicPublished = api.status === 'published' && api.visibility === 'public';
  if (isPublicPublished) {
    try {
      const cached = await redis.get(KEYS.api(api.id));
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn('Redis API detail lookup failed', { apiId: api.id, errMessage: err.message });
    }
  }

  const [tags, versions, endpoints, documentation] = await Promise.all([
    Api.getTags(api.id),
    ApiVersion.findByApi(api.id),
    ApiEndpoint.findByApi(api.id),
    ApiDocumentation.findByApi(api.id),
  ]);

  const details = {
    ...api,
    tags,
    versions,
    endpoints,
    documentation,
  };

  if (isPublicPublished) {
    try {
      await redis.set(KEYS.api(api.id), JSON.stringify(details), 'EX', KEYS.API_TTL);
    } catch (err) {
      logger.warn('Redis API detail cache set failed', { apiId: api.id, errMessage: err.message });
    }
  }

  return details;
}

async function createApi(providerId, payload) {
  const existing = await Api.findBySlug(payload.slug);
  if (existing) {
    throw new AppError('API slug is already taken', 409, 'SLUG_TAKEN');
  }

  const categoryId = payload.category_id || payload.categoryId || null;
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }
  }

  const created = await Api.create({
    providerId,
    name: payload.name.trim(),
    slug: payload.slug.trim(),
    description: payload.description,
    shortDescription: payload.short_description ?? payload.shortDescription,
    categoryId,
    logoUrl: payload.logo_url ?? payload.logoUrl,
    websiteUrl: payload.website_url ?? payload.websiteUrl,
    termsOfServiceUrl: payload.terms_of_service_url ?? payload.termsOfServiceUrl,
    visibility: payload.visibility || 'private',
    status: payload.status || 'draft',
    isFeatured: payload.is_featured ?? payload.isFeatured ?? false,
  });

  if (Array.isArray(payload.tags) && payload.tags.length > 0) {
    await Api.addTags(created.id, payload.tags);
  }

  const tags = await Api.getTags(created.id);
  await routeCacheService.invalidateApiCaches(created.id, categoryId);

  return { ...created, tags };
}

async function updateApi(apiId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const oldSlug = api.slug;
  const oldCategoryId = api.category_id;

  if (payload.slug && payload.slug !== api.slug) {
    const existing = await Api.findBySlug(payload.slug);
    if (existing && existing.id !== apiId) {
      throw new AppError('API slug is already taken', 409, 'SLUG_TAKEN');
    }
  }

  const categoryId = payload.category_id ?? payload.categoryId;
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }
  }

  const updateFields = {};
  const fieldMap = {
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    short_description: payload.short_description ?? payload.shortDescription,
    category_id: categoryId,
    logo_url: payload.logo_url ?? payload.logoUrl,
    website_url: payload.website_url ?? payload.websiteUrl,
    terms_of_service_url: payload.terms_of_service_url ?? payload.termsOfServiceUrl,
    visibility: payload.visibility,
    status: payload.status,
  };

  if (isAdminUser(currentUser) && (payload.is_featured !== undefined || payload.isFeatured !== undefined)) {
    fieldMap.is_featured = payload.is_featured ?? payload.isFeatured;
  }

  for (const [key, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      updateFields[key] = val;
    }
  }

  let updated = api;
  if (Object.keys(updateFields).length > 0) {
    updated = await Api.update(apiId, updateFields);
  }

  if (Array.isArray(payload.tags)) {
    await Api.replaceTags(apiId, payload.tags);
  }

  const tags = await Api.getTags(apiId);

  if (oldSlug !== updated.slug) {
    const versions = await ApiVersion.findByApi(apiId);
    await routeCacheService.invalidateApiRoutes(oldSlug, versions);
  }

  await routeCacheService.invalidateApiCaches(apiId, oldCategoryId);
  if (updated.category_id && updated.category_id !== oldCategoryId) {
    await routeCacheService.invalidateApiCaches(apiId, updated.category_id);
  }
  await routeCacheService.syncApiRoutes(apiId);

  return { ...updated, tags };
}

async function deleteApi(apiId, currentUser) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const versions = await ApiVersion.findByApi(apiId);
  await routeCacheService.invalidateApiRoutes(api.slug, versions);
  await Api.softDelete(apiId);
  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
}

async function listVersions(apiId, currentUser) {
  const api = await resolveApi(apiId);
  assertCanViewApi(api, currentUser);
  return ApiVersion.findByApi(api.id);
}

async function createVersion(apiId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiVersion.findByApiAndVersion(apiId, payload.version);
  if (existing) {
    throw new AppError(`Version '${payload.version}' already exists for this API`, 409, 'VERSION_EXISTS');
  }

  const rawBaseUrl = payload.base_url || payload.baseUrl;
  const validatedBaseUrl = validateTargetUrl(rawBaseUrl, { requireHttpsInProd: true });
  const isDefault = Boolean(payload.is_default ?? payload.isDefault);

  if (isDefault) {
    await ApiVersion.clearDefaultForApi(apiId);
  }

  const version = await ApiVersion.create({
    apiId,
    version: payload.version,
    baseUrl: validatedBaseUrl,
    status: payload.status || 'active',
    isDefault,
    changelog: payload.changelog,
  });

  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  await routeCacheService.syncApiRoutes(apiId);

  return version;
}

async function updateVersion(apiId, versionId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiVersion.findById(versionId);
  if (!existing || existing.api_id !== apiId) {
    throw new AppError('API version not found', 404, 'VERSION_NOT_FOUND');
  }

  const updateFields = {};
  const rawBaseUrl = payload.base_url ?? payload.baseUrl;
  if (rawBaseUrl !== undefined) {
    updateFields.base_url = validateTargetUrl(rawBaseUrl, { requireHttpsInProd: true });
  }
  if (payload.status !== undefined) updateFields.status = payload.status;
  if (payload.changelog !== undefined) updateFields.changelog = payload.changelog;

  const isDefault = payload.is_default ?? payload.isDefault;
  if (isDefault !== undefined) {
    updateFields.is_default = Boolean(isDefault);
    if (updateFields.is_default) {
      await ApiVersion.clearDefaultForApi(apiId, versionId);
    }
  }

  const updated = Object.keys(updateFields).length > 0
    ? await ApiVersion.update(versionId, updateFields)
    : existing;

  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  await routeCacheService.syncApiRoutes(apiId);

  return updated;
}

async function listEndpoints(apiId, { versionId, version } = {}, currentUser) {
  const api = await resolveApi(apiId);
  assertCanViewApi(api, currentUser);

  if (versionId) {
    const ver = await ApiVersion.findById(versionId);
    if (!ver || ver.api_id !== api.id) {
      throw new AppError('API version not found', 404, 'VERSION_NOT_FOUND');
    }
    return ApiEndpoint.findByVersion(ver.id);
  }

  if (version) {
    const ver = await ApiVersion.findByApiAndVersion(api.id, version);
    if (!ver) {
      throw new AppError('API version not found', 404, 'VERSION_NOT_FOUND');
    }
    return ApiEndpoint.findByVersion(ver.id);
  }

  return ApiEndpoint.findByApi(api.id);
}

async function createEndpoint(apiId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  let targetVersionId = payload.api_version_id || payload.apiVersionId;
  if (targetVersionId) {
    const ver = await ApiVersion.findById(targetVersionId);
    if (!ver || ver.api_id !== apiId) {
      throw new AppError('API version not found for this API', 404, 'VERSION_NOT_FOUND');
    }
  } else {
    const defaultVer = await ApiVersion.findDefault(apiId);
    if (defaultVer) {
      targetVersionId = defaultVer.id;
    } else {
      const versions = await ApiVersion.findByApi(apiId);
      if (versions.length === 0) {
        throw new AppError(
          'Create an API version before adding endpoints',
          400,
          'NO_API_VERSION'
        );
      }
      targetVersionId = versions[0].id;
    }
  }

  const endpointPath = payload.path.startsWith('/') ? payload.path : `/${payload.path}`;

  const created = await ApiEndpoint.create({
    apiVersionId: targetVersionId,
    path: endpointPath,
    method: payload.method,
    summary: payload.summary,
    description: payload.description,
    requestBodySchema: payload.request_body_schema ?? payload.requestBodySchema,
    responseSchema: payload.response_schema ?? payload.responseSchema,
    queryParameters: payload.query_parameters ?? payload.queryParameters,
    pathParameters: payload.path_parameters ?? payload.pathParameters,
    headers: payload.headers,
  });

  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  return created;
}

async function updateEndpoint(apiId, endpointId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiEndpoint.findById(endpointId);
  if (!existing) {
    throw new AppError('Endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
  }
  const ver = await ApiVersion.findById(existing.api_version_id);
  if (!ver || ver.api_id !== apiId) {
    throw new AppError('Endpoint not found for this API', 404, 'ENDPOINT_NOT_FOUND');
  }

  const fields = {};
  const map = {
    path: payload.path !== undefined ? (payload.path.startsWith('/') ? payload.path : `/${payload.path}`) : undefined,
    method: payload.method,
    summary: payload.summary,
    description: payload.description,
    request_body_schema: payload.request_body_schema ?? payload.requestBodySchema,
    response_schema: payload.response_schema ?? payload.responseSchema,
    query_parameters: payload.query_parameters ?? payload.queryParameters,
    path_parameters: payload.path_parameters ?? payload.pathParameters,
    headers: payload.headers,
    is_deprecated: payload.is_deprecated ?? payload.isDeprecated,
  };

  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) fields[k] = v;
  }

  const updated = Object.keys(fields).length > 0 ? await ApiEndpoint.update(endpointId, fields) : existing;
  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  return updated;
}

async function deleteEndpoint(apiId, endpointId, currentUser) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiEndpoint.findById(endpointId);
  if (!existing) {
    throw new AppError('Endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
  }
  const ver = await ApiVersion.findById(existing.api_version_id);
  if (!ver || ver.api_id !== apiId) {
    throw new AppError('Endpoint not found for this API', 404, 'ENDPOINT_NOT_FOUND');
  }

  await ApiEndpoint.delete(endpointId);
  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
}

async function listDocumentation(apiId, currentUser) {
  const api = await resolveApi(apiId);
  assertCanViewApi(api, currentUser);
  return ApiDocumentation.findByApi(api.id);
}

async function createDocumentation(apiId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const created = await ApiDocumentation.create({
    apiId,
    type: payload.type,
    title: payload.title,
    content: payload.content,
    format: payload.format,
    sortOrder: payload.sort_order ?? payload.sortOrder ?? 0,
  });

  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  return created;
}

async function updateDocumentation(apiId, docId, currentUser, payload) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiDocumentation.findById(docId);
  if (!existing || existing.api_id !== apiId) {
    throw new AppError('Documentation not found', 404, 'DOC_NOT_FOUND');
  }

  const fields = {};
  const map = {
    type: payload.type,
    title: payload.title,
    content: payload.content,
    format: payload.format,
    sort_order: payload.sort_order ?? payload.sortOrder,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) fields[k] = v;
  }

  const updated = Object.keys(fields).length > 0 ? await ApiDocumentation.update(docId, fields) : existing;
  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
  return updated;
}

async function deleteDocumentation(apiId, docId, currentUser) {
  const api = await Api.findById(apiId);
  assertOwnership(api, currentUser);

  const existing = await ApiDocumentation.findById(docId);
  if (!existing || existing.api_id !== apiId) {
    throw new AppError('Documentation not found', 404, 'DOC_NOT_FOUND');
  }

  await ApiDocumentation.delete(docId);
  await routeCacheService.invalidateApiCaches(apiId, api.category_id);
}

module.exports = {
  listApis,
  listFeaturedApis,
  getApiDetails,
  createApi,
  updateApi,
  deleteApi,
  listVersions,
  createVersion,
  updateVersion,
  listEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listDocumentation,
  createDocumentation,
  updateDocumentation,
  deleteDocumentation,
};
