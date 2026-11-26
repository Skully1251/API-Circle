'use strict';

const { query } = require('../config/db');

const PasswordReset = {
  /**
   * Store a hashed password reset token.
   */
  async create({ userId, tokenHash, expiresAt, ipAddress = null }) {
    const { rows } = await query(
      `INSERT INTO auth.password_resets (user_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, expires_at, created_at`,
      [userId, tokenHash, expiresAt, ipAddress]
    );
    return rows[0];
  },

  /**
   * Find a valid (unused, non-expired) reset record by token hash.
   */
  async findValidByHash(tokenHash) {
    const { rows } = await query(
      `SELECT id, user_id, expires_at, created_at
       FROM auth.password_resets
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  /**
   * Mark a reset token as used.
   */
  async markUsed(id) {
    await query(
      `UPDATE auth.password_resets
       SET used_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  /**
   * Invalidate any unused reset tokens for a user.
   */
  async invalidatePendingForUser(userId) {
    await query(
      `DELETE FROM auth.password_resets
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  },
};

module.exports = PasswordReset;
