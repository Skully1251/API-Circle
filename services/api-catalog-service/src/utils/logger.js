'use strict';

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'apiKey',
  'api_key',
  'x-api-key',
  'x-api-circle-key',
  'secret',
  'clientSecret',
  'client_secret',
  'authConfig',
  'auth_config',
  'encryptionKey',
  'privateKey',
]);

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key) || REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redact(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'api-catalog-service',
    level,
    message,
    ...redact(meta),
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
