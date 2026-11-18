'use strict';

const { query } = require('../config/db');

const ApiKey = {
  /**
   * Store a new API key record. The plaintext key is NEVER stored —
   * only the SHA-256 hash and a human-readable prefix.
   */
  async create({ consumerId, subscriptionId, apiId, keyPrefix, keyHash, name, expiresAt }) {
    const { rows } = await query(
      `INSERT INTO api_keys.api_keys
         (consumer_id, subscription_id, api_id, key_prefix, key_hash, name, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, consumer_id, subscription_id, api_id, key_prefix, name, status, expires_at, created_at`,
      [consumerId, subscriptionId, apiId, keyPrefix, keyHash, name || null, expiresAt || null]
    );
    return rows[0];
  },

  /**
   * Look up a key by its SHA-256 hash (the hot validation path).
   */
  async findByHash(keyHash) {
    const { rows } = await query(
      `SELECT id, consumer_id, subscription_id, api_id, key_prefix, name, status,
              last_used_at, expires_at, created_at
       FROM api_keys.api_keys
       WHERE key_hash = $1 AND deleted_at IS NULL`,
      [keyHash]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, consumer_id, subscription_id, api_id, key_prefix, name, status,
              last_used_at, last_used_ip, expires_at, revoked_at, revoked_reason, created_at, updated_at
       FROM api_keys.api_keys
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByConsumer(consumerId) {
    const { rows } = await query(
      `SELECT id, consumer_id, subscription_id, api_id, key_prefix, name, status,
              last_used_at, expires_at, created_at
       FROM api_keys.api_keys
       WHERE consumer_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [consumerId]
    );
    return rows;
  },

  async findBySubscription(subscriptionId) {
    const { rows } = await query(
      `SELECT id, consumer_id, subscription_id, api_id, key_prefix, name, status,
              last_used_at, expires_at, created_at
       FROM api_keys.api_keys
       WHERE subscription_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [subscriptionId]
    );
    return rows;
  },

  /**
   * Record that a key was just used (timestamp + IP).
   */
  async recordUsage(id, ip) {
    await query(
      `UPDATE api_keys.api_keys
       SET last_used_at = NOW(), last_used_ip = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, ip]
    );
  },

  /**
   * Revoke a key.
   */
  async revoke(id, reason) {
    const { rows } = await query(
      `UPDATE api_keys.api_keys
       SET status = 'revoked', revoked_at = NOW(), revoked_reason = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, reason || null]
    );
    return rows[0] || null;
  },

  /**
   * Revoke all keys for a subscription (e.g. when subscription is cancelled).
   */
  async revokeBySubscription(subscriptionId, reason) {
    const { rowCount } = await query(
      `UPDATE api_keys.api_keys
       SET status = 'revoked', revoked_at = NOW(), revoked_reason = $2, updated_at = NOW()
       WHERE subscription_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [subscriptionId, reason || 'subscription_cancelled']
    );
    return rowCount;
  },

  /**
   * Soft-delete a key.
   */
  async softDelete(id) {
    await query(
      'UPDATE api_keys.api_keys SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = ApiKey;
