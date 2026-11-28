'use strict';

const catalogService = require('../services/catalogService');
const providerConfigService = require('../services/providerConfigService');
const routeCacheService = require('../services/routeCacheService');
const AppError = require('../utils/AppError');

async function listApis(req, res, next) {
  try {
    const result = await catalogService.listApis(req.query, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function listFeaturedApis(req, res, next) {
  try {
    const apis = await catalogService.listFeaturedApis(req.query.limit);
    return res.status(200).json({ items: apis });
  } catch (err) {
    return next(err);
  }
}

async function getApiDetails(req, res, next) {
  try {
    const api = await catalogService.getApiDetails(req.params.id, req.user);
    return res.status(200).json(api);
  } catch (err) {
    return next(err);
  }
}

async function createApi(req, res, next) {
  try {
    const api = await catalogService.createApi(req.user.id, req.body);
    return res.status(201).json(api);
  } catch (err) {
    return next(err);
  }
}

async function updateApi(req, res, next) {
  try {
    const api = await catalogService.updateApi(req.params.id, req.user, req.body);
    return res.status(200).json(api);
  } catch (err) {
    return next(err);
  }
}

async function deleteApi(req, res, next) {
  try {
    await catalogService.deleteApi(req.params.id, req.user);
    return res.status(200).json({ message: 'API deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

async function listVersions(req, res, next) {
  try {
    const versions = await catalogService.listVersions(req.params.id, req.user);
    return res.status(200).json({ items: versions });
  } catch (err) {
    return next(err);
  }
}

async function createVersion(req, res, next) {
  try {
    const version = await catalogService.createVersion(req.params.id, req.user, req.body);
    return res.status(201).json(version);
  } catch (err) {
    return next(err);
  }
}

async function updateVersion(req, res, next) {
  try {
    const version = await catalogService.updateVersion(
      req.params.id,
      req.params.versionId,
      req.user,
      req.body
    );
    return res.status(200).json(version);
  } catch (err) {
    return next(err);
  }
}

async function listEndpoints(req, res, next) {
  try {
    const endpoints = await catalogService.listEndpoints(
      req.params.id,
      { versionId: req.query.versionId, version: req.query.version },
      req.user
    );
    return res.status(200).json({ items: endpoints });
  } catch (err) {
    return next(err);
  }
}

async function createEndpoint(req, res, next) {
  try {
    const endpoint = await catalogService.createEndpoint(req.params.id, req.user, req.body);
    return res.status(201).json(endpoint);
  } catch (err) {
    return next(err);
  }
}

async function updateEndpoint(req, res, next) {
  try {
    const endpoint = await catalogService.updateEndpoint(
      req.params.id,
      req.params.endpointId,
      req.user,
      req.body
    );
    return res.status(200).json(endpoint);
  } catch (err) {
    return next(err);
  }
}

async function deleteEndpoint(req, res, next) {
  try {
    await catalogService.deleteEndpoint(req.params.id, req.params.endpointId, req.user);
    return res.status(200).json({ message: 'Endpoint deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

async function listDocumentation(req, res, next) {
  try {
    const docs = await catalogService.listDocumentation(req.params.id, req.user);
    return res.status(200).json({ items: docs });
  } catch (err) {
    return next(err);
  }
}

async function createDocumentation(req, res, next) {
  try {
    const doc = await catalogService.createDocumentation(req.params.id, req.user, req.body);
    return res.status(201).json(doc);
  } catch (err) {
    return next(err);
  }
}

async function updateDocumentation(req, res, next) {
  try {
    const doc = await catalogService.updateDocumentation(
      req.params.id,
      req.params.docId,
      req.user,
      req.body
    );
    return res.status(200).json(doc);
  } catch (err) {
    return next(err);
  }
}

async function deleteDocumentation(req, res, next) {
  try {
    await catalogService.deleteDocumentation(req.params.id, req.params.docId, req.user);
    return res.status(200).json({ message: 'Documentation deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

async function getProviderConfig(req, res, next) {
  try {
    const cfg = await providerConfigService.getProviderConfig(req.params.id, req.user);
    return res.status(200).json(cfg);
  } catch (err) {
    return next(err);
  }
}

async function upsertProviderConfig(req, res, next) {
  try {
    const cfg = await providerConfigService.upsertProviderConfig(req.params.id, req.user, req.body);
    return res.status(200).json(cfg);
  } catch (err) {
    return next(err);
  }
}

async function resolveRoute(req, res, next) {
  try {
    const route = await routeCacheService.getRoute(req.params.slug, req.params.version);
    if (!route) {
      throw new AppError('Route not found or inactive', 404, 'ROUTE_NOT_FOUND');
    }
    return res.status(200).json(route);
  } catch (err) {
    return next(err);
  }
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
  getProviderConfig,
  upsertProviderConfig,
  resolveRoute,
};
