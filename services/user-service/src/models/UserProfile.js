'use strict';

const { query } = require('../config/db');

const UserProfile = {
  async create({ userId, firstName, lastName, displayName }) {
    const { rows } = await query(
      `INSERT INTO users.user_profiles (user_id, first_name, last_name, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, firstName, lastName, displayName]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM users.user_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return rows[0] || null;
  },

  async update(userId, fields) {
    const allowed = ['first_name', 'last_name', 'display_name', 'avatar_url', 'bio', 'phone', 'timezone', 'locale'];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }
    if (sets.length === 0) return null;

    sets.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await query(
      `UPDATE users.user_profiles SET ${sets.join(', ')} WHERE user_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(userId) {
    await query(
      'UPDATE users.user_profiles SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  },
};

module.exports = UserProfile;
