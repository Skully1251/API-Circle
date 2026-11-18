'use strict';

const { query } = require('../config/db');

const ConsumerProfile = {
  async create({ userId, companyName, useCase }) {
    const { rows } = await query(
      `INSERT INTO users.consumer_profiles (user_id, company_name, use_case)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, companyName, useCase]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      'SELECT * FROM users.consumer_profiles WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return rows[0] || null;
  },

  async update(userId, fields) {
    const allowed = ['company_name', 'use_case'];
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

    sets.push('updated_at = NOW()');
    values.push(userId);

    const { rows } = await query(
      `UPDATE users.consumer_profiles SET ${sets.join(', ')} WHERE user_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(userId) {
    await query(
      'UPDATE users.consumer_profiles SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  },
};

module.exports = ConsumerProfile;
