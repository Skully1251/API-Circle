'use strict';

const logger = require('../utils/logger');

/**
 * Centralized Express error handler.
 * Returns structured JSON { error, code } without leaking stack traces.
 */
function errorHandler(err, req, res, _next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Request body must be valid JSON',
      code: 'INVALID_JSON',
    });
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : 'An unexpected internal error occurred';

  if (statusCode >= 500) {
    logger.error('Unhandled service error', {
      path: req.originalUrl,
      method: req.method,
      statusCode,
      code,
      errMessage: err.message,
    });
  }

  return res.status(statusCode).json({
    error: message,
    code,
  });
}

module.exports = errorHandler;
