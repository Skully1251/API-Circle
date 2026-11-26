'use strict';

const AppError = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function validateEmail(req, _res, next) {
  const { email } = req.body;
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return next(new AppError('Please provide a valid email address', 400, 'INVALID_EMAIL'));
  }
  req.body.email = email.trim().toLowerCase();
  return next();
}

function validatePassword(field = 'password') {
  return (req, _res, next) => {
    const password = req.body?.[field];
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return next(
        new AppError('Password must be between 8 and 128 characters', 400, 'WEAK_PASSWORD')
      );
    }
    return next();
  };
}

module.exports = {
  requireFields,
  validateEmail,
  validatePassword,
};
