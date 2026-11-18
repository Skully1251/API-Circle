'use strict';

const { query } = require('../config/db');

const UsageQuota = {
  async createOrGet({ subscriptionId, periodStart, periodEnd }) {
    // Upsert: create if not exists for this period
    const { rows } = await query(
      `INSERT INTO subscriptions.usage_quotas (subscription_id, period_start, period_end)
       VALUES ($1, $2, $3)
       ON CONFLICT (subscription_id, period_start) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [subscriptionId, periodStart, periodEnd]
    );
    return rows[0];
  },

  async findBySubscription(subscriptionId) {
    const { rows } = await query(
      'SELECT * FROM subscriptions.usage_quotas WHERE subscription_id = $1 ORDER BY period_start DESC LIMIT 1',
      [subscriptionId]
    );
    return rows[0] || null;
  },

  async incrementRequestCount(subscriptionId) {
    const { rows } = await query(
      `UPDATE subscriptions.usage_quotas
       SET request_count = request_count + 1,
           daily_request_count = CASE
             WHEN daily_reset_at IS NULL OR daily_reset_at < CURRENT_DATE THEN 1
             ELSE daily_request_count + 1
           END,
           daily_reset_at = CASE
             WHEN daily_reset_at IS NULL OR daily_reset_at < CURRENT_DATE THEN CURRENT_DATE + INTERVAL '1 day'
             ELSE daily_reset_at
           END,
           last_request_at = NOW(),
           updated_at = NOW()
       WHERE subscription_id = $1
         AND period_start <= NOW() AND period_end > NOW()
       RETURNING *`,
      [subscriptionId]
    );
    return rows[0] || null;
  },

  async getUsage(subscriptionId) {
    const { rows } = await query(
      `SELECT request_count, daily_request_count, last_request_at, period_start, period_end
       FROM subscriptions.usage_quotas
       WHERE subscription_id = $1
         AND period_start <= NOW() AND period_end > NOW()`,
      [subscriptionId]
    );
    return rows[0] || null;
  },
};

module.exports = UsageQuota;
