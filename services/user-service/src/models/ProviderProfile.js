'use strict';

const { query } = require('../config/db');

const ProviderProfile = {
  async create({ userId, companyName, companyWebsite, description, supportEmail }) {
    const { rows } = await query(
      `INSERT INTO users.provider_profiles (user_id, company_name, company_website, description, support_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, companyName, companyWebsite, description, supportEmail]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      'SELECT * FROM users.provider_profiles WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return rows[0] || null;
  },

  async update(userId, fields) {
    const allowed = ['company_name', 'company_website', 'company_logo_url', 'description', 'support_email', 'support_url'];
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
      `UPDATE users.provider_profiles SET ${sets.join(', ')} WHERE user_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async verify(userId) {
    const { rows } = await query(
      `UPDATE users.provider_profiles
       SET is_verified = true, verified_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [userId]
    );
    return rows[0] || null;
  },

  async softDelete(userId) {
    await query(
      'UPDATE users.provider_profiles SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  },
};

module.exports = ProviderProfile;
