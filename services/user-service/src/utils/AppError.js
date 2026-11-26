'use strict';

class AppError extends Error {
  /**
   * @param {string} message Human-readable error message
   * @param {number} statusCode HTTP status code
   * @param {string} code Machine-readable error code
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
