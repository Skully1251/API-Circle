'use strict';

const { query } = require('../config/db');

const Plan = {
  async create({ apiId, name, slug, description, priceMonthly, priceYearly, currency, requestLimitDaily, requestLimitMonthly, rateLimitPerSecond, rateLimitPerMinute, features, sortOrder }) {
    const { rows } = await query(
      `INSERT INTO subscriptions.plans
         (api_id, name, slug, description, price_monthly, price_yearly, currency,
          request_limit_daily, request_limit_monthly, rate_limit_per_second, rate_limit_per_minute,
          features, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        apiId, name, slug, description || null,
        priceMonthly || 0, priceYearly || null, currency || 'USD',
        requestLimitDaily || null, requestLimitMonthly || null,
        rateLimitPerSecond || null, rateLimitPerMinute || null,
        JSON.stringify(features || []), sortOrder || 0,
      ]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM subscriptions.plans WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async findByApi(apiId) {
    const { rows } = await query(
      `SELECT * FROM subscriptions.plans
       WHERE api_id = $1 AND is_active = true AND deleted_at IS NULL
       ORDER BY sort_order, price_monthly`,
      [apiId]
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = [
      'name', 'slug', 'description', 'price_monthly', 'price_yearly', 'currency',
      'request_limit_daily', 'request_limit_monthly', 'rate_limit_per_second',
      'rate_limit_per_minute', 'is_active', 'is_featured', 'sort_order', 'features',
    ];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        const val = key === 'features' ? JSON.stringify(value) : value;
        sets.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (sets.length === 0) return null;

    sets.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE subscriptions.plans SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(id) {
    await query(
      'UPDATE subscriptions.plans SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = Plan;
