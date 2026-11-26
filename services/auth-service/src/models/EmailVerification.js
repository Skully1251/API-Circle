'use strict';

const { query } = require('../config/db');

const EmailVerification = {
  /**
   * Store a hashed email verification token.
   */
  async create({ userId, tokenHash, expiresAt }) {
    const { rows } = await query(
      `INSERT INTO auth.email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, expires_at, created_at`,
      [userId, tokenHash, expiresAt]
    );
    return rows[0];
  },

  /**
   * Find a valid (unused, non-expired) verification record by token hash.
   */
  async findValidByHash(tokenHash) {
    const { rows } = await query(
      `SELECT id, user_id, expires_at, created_at
       FROM auth.email_verifications
       WHERE token_hash = $1
         AND verified_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  /**
   * Mark a verification token as verified.
   */
  async markVerified(id) {
    await query(
      `UPDATE auth.email_verifications
       SET verified_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  /**
   * Invalidate any pending verification tokens for a user.
   */
  async invalidatePendingForUser(userId) {
    await query(
      `DELETE FROM auth.email_verifications
       WHERE user_id = $1 AND verified_at IS NULL`,
      [userId]
    );
  },
};

module.exports = EmailVerification;
