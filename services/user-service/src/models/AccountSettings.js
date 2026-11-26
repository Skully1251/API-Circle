'use strict';

const { query } = require('../config/db');

const AccountSettings = {
  async create(userId) {
    const { rows } = await query(
      `INSERT INTO users.account_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const { rows } = await query(
      'SELECT * FROM users.account_settings WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  },

  async update(userId, fields) {
    const allowed = ['email_notifications', 'marketing_emails', 'two_factor_enabled', 'theme'];
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
      `UPDATE users.account_settings SET ${sets.join(', ')} WHERE user_id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
  async upsert(userId, fields) {
    const allowed = ['email_notifications', 'marketing_emails', 'two_factor_enabled', 'theme'];
    const cols = ['user_id'];
    const placeholders = ['$1'];
    const updates = ['updated_at = NOW()'];
    const values = [userId];
    let idx = 2;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key) && value !== undefined) {
        cols.push(key);
        placeholders.push(`$${idx++}`);
        values.push(value);
        updates.push(`${key} = EXCLUDED.${key}`);
      }
    }

    const { rows } = await query(
      `INSERT INTO users.account_settings (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}
       RETURNING *`,
      values
    );
    return rows[0];
  },
};

module.exports = AccountSettings;
