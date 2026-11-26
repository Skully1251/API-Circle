'use strict';

const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MEMBER_ROLES = new Set(['owner', 'admin', 'member']);
const ALLOWED_THEMES = new Set(['light', 'dark', 'system']);

function validateUuidParam(paramName = 'id') {
  return (req, _res, next) => {
    const val = req.params[paramName];
    if (!val || !UUID_REGEX.test(val)) {
      return next(new AppError(`Invalid UUID for parameter '${paramName}'`, 400, 'INVALID_UUID'));
    }
    return next();
  };
}

function validateUuidBody(field) {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (!val || typeof val !== 'string' || !UUID_REGEX.test(val)) {
      return next(new AppError(`Invalid UUID for field '${field}'`, 400, 'VALIDATION_ERROR'));
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

function validateMemberRole(field = 'role') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined) return next();
    if (typeof val !== 'string' || !ALLOWED_MEMBER_ROLES.has(val)) {
      return next(
        new AppError('Role must be one of: owner, admin, member', 400, 'INVALID_ROLE')
      );
    }
    return next();
  };
}

function validateOptionalEmail(field) {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined || val === null || val === '') return next();
    if (typeof val !== 'string' || !EMAIL_REGEX.test(val.trim())) {
      return next(new AppError(`Invalid email address for '${field}'`, 400, 'INVALID_EMAIL'));
    }
    req.body[field] = val.trim().toLowerCase();
    return next();
  };
}

function validateTheme(field = 'theme') {
  return (req, _res, next) => {
    const val = req.body?.[field];
    if (val === undefined) return next();
    if (typeof val !== 'string' || !ALLOWED_THEMES.has(val)) {
      return next(
        new AppError('Theme must be one of: light, dark, system', 400, 'VALIDATION_ERROR')
      );
    }
    return next();
  };
}

module.exports = {
  UUID_REGEX,
  SLUG_REGEX,
  ALLOWED_MEMBER_ROLES,
  ALLOWED_THEMES,
  validateUuidParam,
  validateUuidBody,
  requireFields,
  validateSlug,
  validateMemberRole,
  validateOptionalEmail,
  validateTheme,
};
