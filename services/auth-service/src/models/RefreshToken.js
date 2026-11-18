'use strict';

const { query } = require('../config/db');

const RefreshToken = {
  /**
   * Store a hashed refresh token.
   */
  async create({ userId, tokenHash, familyId, expiresAt, userAgent, ipAddress }) {
    const { rows } = await query(
      `INSERT INTO auth.refresh_tokens
         (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, family_id, expires_at, created_at`,
      [userId, tokenHash, familyId, expiresAt, userAgent, ipAddress]
    );
    return rows[0];
  },

  /**
   * Find an active (non-revoked, non-expired) token by its hash.
   */
  async findActiveByHash(tokenHash) {
    const { rows } = await query(
      `SELECT id, user_id, family_id, expires_at, created_at
       FROM auth.refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  /**
   * Revoke a single token.
   */
  async revoke(id, reason = 'rotation') {
    await query(
      `UPDATE auth.refresh_tokens
       SET revoked_at = NOW(), revoked_reason = $2
       WHERE id = $1`,
      [id, reason]
    );
  },

  /**
   * Revoke all tokens in a family (reuse detection).
   */
  async revokeFamily(familyId, reason = 'security') {
    await query(
      `UPDATE auth.refresh_tokens
       SET revoked_at = NOW(), revoked_reason = $2
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId, reason]
    );
  },

  /**
   * Revoke all tokens for a user (e.g., on password change).
   */
  async revokeAllForUser(userId, reason = 'logout') {
    await query(
      `UPDATE auth.refresh_tokens
       SET revoked_at = NOW(), revoked_reason = $2
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, reason]
    );
  },

  /**
   * Clean up expired tokens older than the given number of days.
   */
  async deleteExpired(daysOld = 30) {
    const { rowCount } = await query(
      `DELETE FROM auth.refresh_tokens
       WHERE expires_at < NOW() - INTERVAL '1 day' * $1`,
      [daysOld]
    );
    return rowCount;
  },
};

module.exports = RefreshToken;
