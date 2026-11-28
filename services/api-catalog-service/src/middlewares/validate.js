'use strict';

const AppError = require('../utils/AppError');
const { validateTargetUrl } = require('../utils/ssrf');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_REGEX = /^v?\d+(?:\.\d+){0,2}(?:-[a-zA-Z0-9.-]+)?$/;

const ALLOWED_VISIBILITIES = new Set(['private', 'public', 'unlisted']);
const ALLOWED_API_STATUSES = new Set(['draft', 'pending_review', 'published', 'deprecated', 'archived']);
const ALLOWED_VERSION_STATUSES = new Set(['active', 'deprecated', 'retired']);
const ALLOWED_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const ALLOWED_DOC_TYPES = new Set(['openapi', 'swagger', 'markdown', 'link']);
const ALLOWED_DOC_FORMATS = new Set(['json', 'yaml', 'md', 'url']);
const ALLOWED_AUTH_TYPES = new Set(['api_key', 'oauth2', 'basic', 'bearer', 'none']);

function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

function validateUuidParam(paramName = 'id') {
  return (req, _res, next) => {
    const val = req.params[paramName];
    if (!isUuid(val)) {
      return next(new AppError(`Invalid UUID for parameter '${paramName}'`, 400, 'INVALID_UUID'));
    }
    return next();
  };
}

function requireFields(fields) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => {
      const val = req.body?.[f];
      return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    });

    if (missing.length > 0) {
      return next(
        new AppError(`Missing required field(s): ${missing.join(', ')}`, 400, 'VALIDATION_ERROR')
      );
    }
    return next();
  };
}

function validateSlug(field = 'slug') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined) return next();
    if (typeof val !== 'string' || val.length < 2 || val.length > 200 || !SLUG_REGEX.test(val)) {
      return next(
        new AppError(
          'Slug must be 2-200 lowercase alphanumeric characters with single hyphens',
          400,
          'INVALID_SLUG'
        )
      );
    }
    return next();
  };
}

function validateEnum(field, allowedSet, code = 'VALIDATION_ERROR') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined || val === null) return next();
    const normalized = typeof val === 'string' ? val.trim() : val;
    if (!allowedSet.has(normalized)) {
      return next(
        new AppError(
          `Field '${field}' must be one of: ${Array.from(allowedSet).join(', ')}`,
          400,
          code
        )
      );
    }
    req.body[field] = normalized;
    return next();
  };
}

function validateHttpMethod(field = 'method') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined) return next();
    if (typeof val !== 'string' || !ALLOWED_HTTP_METHODS.has(val.trim().toUpperCase())) {
      return next(
        new AppError(
          `Method must be one of: ${Array.from(ALLOWED_HTTP_METHODS).join(', ')}`,
          400,
          'INVALID_METHOD'
        )
      );
    }
    req.body[field] = val.trim().toUpperCase();
    return next();
  };
}

function validateVersionString(field = 'version') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined) return next();
    if (typeof val !== 'string' || val.length > 50 || !SEMVER_REGEX.test(val.trim())) {
      return next(
        new AppError('Version must be a valid semantic version (e.g., v1, v1.0, 2.0.1)', 400, 'INVALID_VERSION')
      );
    }
    req.body[field] = val.trim();
    return next();
  };
}

function validateTargetUrlField(field, { required = false, requireHttpsInProd = true } = {}) {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined || val === null || val === '') {
      if (required) {
        return next(new AppError(`Field '${field}' is required`, 400, 'VALIDATION_ERROR'));
      }
      return next();
    }
    try {
      req.body[field] = validateTargetUrl(val, { requireHttpsInProd });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  isUuid,
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
  ALLOWED_HTTP_METHODS,
  ALLOWED_DOC_TYPES,
  ALLOWED_DOC_FORMATS,
  ALLOWED_AUTH_TYPES,
};
