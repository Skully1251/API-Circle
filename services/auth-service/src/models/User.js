'use strict';

const { query, getClient } = require('../config/db');

const User = {
  /**
   * Create a new user record.
   */
  async create({ email, passwordHash }) {
    const { rows } = await query(
      `INSERT INTO auth.users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, is_email_verified, is_active, created_at`,
      [email, passwordHash]
    );
    return rows[0];
  },

  /**
   * Find a user by email (excludes soft-deleted).
   */
  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, email, password_hash, is_email_verified, is_active,
              failed_login_attempts, locked_until, last_login_at, created_at, updated_at
       FROM auth.users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by id (excludes soft-deleted).
   */
  async findById(id) {
    const { rows } = await query(
      `SELECT id, email, is_email_verified, is_active,
              last_login_at, created_at, updated_at
       FROM auth.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Update the last login timestamp and IP, reset failed attempts.
   */
  async recordLogin(id, ip) {
    await query(
      `UPDATE auth.users
       SET last_login_at = NOW(),
           last_login_ip = $2,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id, ip]
    );
  },

  /**
   * Increment failed login attempts and optionally lock the account.
   */
  async recordFailedLogin(id, lockUntil = null) {
    await query(
      `UPDATE auth.users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = COALESCE($2, locked_until),
           updated_at = NOW()
       WHERE id = $1`,
      [id, lockUntil]
    );
  },

  /**
   * Mark email as verified.
   */
  async verifyEmail(id) {
    await query(
      `UPDATE auth.users
       SET is_email_verified = true,
           email_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  /**
   * Update password hash.
   */
  async updatePassword(id, passwordHash) {
    await query(
      `UPDATE auth.users
       SET password_hash = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, passwordHash]
    );
  },

  /**
   * Soft-delete a user.
   */
  async softDelete(id) {
    await query(
      `UPDATE auth.users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },
};

module.exports = User;
