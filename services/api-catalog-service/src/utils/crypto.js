'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('./AppError');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit recommended IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Derives a 32-byte AES-256 key from environment configuration.
 * In production, PROVIDER_CONFIG_ENCRYPTION_KEY (or ENCRYPTION_KEY) is required.
 */
function getMasterKey() {
  const rawKey = config.encryption.key;
  if (!rawKey) {
    if (config.nodeEnv === 'production') {
      throw new AppError('Provider config encryption key is not configured', 500, 'ENCRYPTION_CONFIG_ERROR');
    }
    return crypto.createHash('sha256').update('api-circle-dev-provider-key-change-in-prod').digest();
  }

  if (/^[0-9a-f]{64}$/i.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a JSON-serializable auth_config object using AES-256-GCM (128-bit auth tag).
 * @param {object} authConfig
 * @returns {{ encrypted: string, iv: string, tag: string, alg: string, v: number }}
 */
function encryptAuthConfig(authConfig) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const plaintext = JSON.stringify(authConfig || {});
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    encrypted: encrypted.toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted auth_config envelope.
 * Supports legacy plain objects gracefully if not yet encrypted.
 * @param {object} payload
 * @returns {object}
 */
function decryptAuthConfig(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (!payload.encrypted || !payload.iv || !payload.tag) {
    return payload;
  }

  const key = getMasterKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const encrypted = Buffer.from(payload.encrypted, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Redacts sensitive credential values when returning provider config to API callers.
 */
function sanitizeProviderConfig(record) {
  if (!record) return null;
  const hasEncrypted = Boolean(record.auth_config && record.auth_config.encrypted);
  return {
    id: record.id,
    api_id: record.api_id,
    auth_type: record.auth_type,
    has_credentials: hasEncrypted || Object.keys(record.auth_config || {}).length > 0,
    rate_limit_per_second: record.rate_limit_per_second,
    timeout_ms: record.timeout_ms,
    retry_count: record.retry_count,
    custom_headers: record.custom_headers || {},
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

module.exports = {
  encryptAuthConfig,
  decryptAuthConfig,
  sanitizeProviderConfig,
};
