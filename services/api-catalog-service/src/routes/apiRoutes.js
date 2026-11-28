'use strict';

const express = require('express');
const catalogController = require('../controllers/catalogController');
const { authenticate, optionalAuthenticate, requireRole } = require('../middlewares/authenticate');
const {
  validateUuidParam,
  requireFields,
  validateSlug,
  validateEnum,
  validateHttpMethod,
  validateVersionString,
  validateTargetUrlField,
  ALLOWED_VISIBILITIES,
  ALLOWED_API_STATUSES,
  ALLOWED_VERSION_STATUSES,
  ALLOWED_DOC_TYPES,
  ALLOWED_DOC_FORMATS,
  ALLOWED_AUTH_TYPES,
} = require('../middlewares/validate');

const router = express.Router();

// Public / optional-auth catalog discovery
router.get('/featured', catalogController.listFeaturedApis);
router.get('/', optionalAuthenticate, catalogController.listApis);
router.get('/:id', optionalAuthenticate, catalogController.getApiDetails);

// Provider / Admin API registration and lifecycle
router.post(
  '/',
  authenticate,
  requireRole('provider', 'admin'),
  requireFields(['name', 'slug']),
  validateSlug('slug'),
  validateEnum('visibility', ALLOWED_VISIBILITIES, 'INVALID_VISIBILITY'),
  validateEnum('status', ALLOWED_API_STATUSES, 'INVALID_STATUS'),
  validateTargetUrlField('website_url', { requireHttpsInProd: false }),
  validateTargetUrlField('websiteUrl', { requireHttpsInProd: false }),
  validateTargetUrlField('logo_url', { requireHttpsInProd: false }),
  validateTargetUrlField('logoUrl', { requireHttpsInProd: false }),
  validateTargetUrlField('terms_of_service_url', { requireHttpsInProd: false }),
  validateTargetUrlField('termsOfServiceUrl', { requireHttpsInProd: false }),
  catalogController.createApi
);

router.put(
  '/:id',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateSlug('slug'),
  validateEnum('visibility', ALLOWED_VISIBILITIES, 'INVALID_VISIBILITY'),
  validateEnum('status', ALLOWED_API_STATUSES, 'INVALID_STATUS'),
  validateTargetUrlField('website_url', { requireHttpsInProd: false }),
  validateTargetUrlField('websiteUrl', { requireHttpsInProd: false }),
  validateTargetUrlField('logo_url', { requireHttpsInProd: false }),
  validateTargetUrlField('logoUrl', { requireHttpsInProd: false }),
  validateTargetUrlField('terms_of_service_url', { requireHttpsInProd: false }),
  validateTargetUrlField('termsOfServiceUrl', { requireHttpsInProd: false }),
  catalogController.updateApi
);

router.delete(
  '/:id',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  catalogController.deleteApi
);

// API Versions
router.get('/:id/versions', optionalAuthenticate, catalogController.listVersions);

router.post(
  '/:id/versions',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  requireFields(['version']),
  validateVersionString('version'),
  validateEnum('status', ALLOWED_VERSION_STATUSES, 'INVALID_VERSION_STATUS'),
  (req, _res, next) => {
    const field = req.body?.base_url !== undefined ? 'base_url' : 'baseUrl';
    return validateTargetUrlField(field, { required: true, requireHttpsInProd: true })(req, _res, next);
  },
  catalogController.createVersion
);

router.put(
  '/:id/versions/:versionId',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateUuidParam('versionId'),
  validateEnum('status', ALLOWED_VERSION_STATUSES, 'INVALID_VERSION_STATUS'),
  validateTargetUrlField('base_url', { requireHttpsInProd: true }),
  validateTargetUrlField('baseUrl', { requireHttpsInProd: true }),
  catalogController.updateVersion
);

// API Endpoints
router.get('/:id/endpoints', optionalAuthenticate, catalogController.listEndpoints);

router.post(
  '/:id/endpoints',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  requireFields(['path', 'method']),
  validateHttpMethod('method'),
  catalogController.createEndpoint
);

router.put(
  '/:id/endpoints/:endpointId',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateUuidParam('endpointId'),
  validateHttpMethod('method'),
  catalogController.updateEndpoint
);

router.delete(
  '/:id/endpoints/:endpointId',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateUuidParam('endpointId'),
  catalogController.deleteEndpoint
);

// API Documentation (supports both /docs and /documentation)
router.get('/:id/docs', optionalAuthenticate, catalogController.listDocumentation);
router.get('/:id/documentation', optionalAuthenticate, catalogController.listDocumentation);

const createDocMiddlewares = [
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  requireFields(['type']),
  validateEnum('type', ALLOWED_DOC_TYPES, 'INVALID_DOC_TYPE'),
  validateEnum('format', ALLOWED_DOC_FORMATS, 'INVALID_DOC_FORMAT'),
  catalogController.createDocumentation,
];
router.post('/:id/docs', ...createDocMiddlewares);
router.post('/:id/documentation', ...createDocMiddlewares);

const updateDocMiddlewares = [
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateUuidParam('docId'),
  validateEnum('type', ALLOWED_DOC_TYPES, 'INVALID_DOC_TYPE'),
  validateEnum('format', ALLOWED_DOC_FORMATS, 'INVALID_DOC_FORMAT'),
  catalogController.updateDocumentation,
];
router.put('/:id/docs/:docId', ...updateDocMiddlewares);
router.put('/:id/documentation/:docId', ...updateDocMiddlewares);

const deleteDocMiddlewares = [
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateUuidParam('docId'),
  catalogController.deleteDocumentation,
];
router.delete('/:id/docs/:docId', ...deleteDocMiddlewares);
router.delete('/:id/documentation/:docId', ...deleteDocMiddlewares);

// Provider Upstream Auth Configuration
router.get(
  '/:id/provider-config',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  catalogController.getProviderConfig
);

router.put(
  '/:id/provider-config',
  authenticate,
  requireRole('provider', 'admin'),
  validateUuidParam('id'),
  validateEnum('auth_type', ALLOWED_AUTH_TYPES, 'INVALID_AUTH_TYPE'),
  validateEnum('authType', ALLOWED_AUTH_TYPES, 'INVALID_AUTH_TYPE'),
  catalogController.upsertProviderConfig
);

module.exports = router;
