'use strict';

const { query, getClient } = require('../config/db');

const ConsumerSubscription = {
  async create({ consumerId, planId, apiId, billingCycle, periodStart, periodEnd }) {
    const { rows } = await query(
      `INSERT INTO subscriptions.consumer_subscriptions
         (consumer_id, plan_id, api_id, billing_cycle, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [consumerId, planId, apiId, billingCycle || 'monthly', periodStart, periodEnd]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM subscriptions.consumer_subscriptions WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async findByConsumer(consumerId) {
    const { rows } = await query(
      `SELECT cs.*, p.name AS plan_name, p.api_id
       FROM subscriptions.consumer_subscriptions cs
       JOIN subscriptions.plans p ON p.id = cs.plan_id
       WHERE cs.consumer_id = $1 AND cs.deleted_at IS NULL
       ORDER BY cs.created_at DESC`,
      [consumerId]
    );
    return rows;
  },

  async findActiveByConsumerAndApi(consumerId, apiId) {
    const { rows } = await query(
      `SELECT * FROM subscriptions.consumer_subscriptions
       WHERE consumer_id = $1 AND api_id = $2 AND status = 'active' AND deleted_at IS NULL`,
      [consumerId, apiId]
    );
    return rows[0] || null;
  },

  async updateStatus(id, status, extra = {}) {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const values = [id, status];
    let idx = 3;

    if (status === 'cancelled') {
      sets.push(`cancelled_at = NOW()`);
      if (extra.cancelReason) {
        sets.push(`cancel_reason = $${idx++}`);
        values.push(extra.cancelReason);
      }
    }

    const { rows } = await query(
      `UPDATE subscriptions.consumer_subscriptions SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async renew(id, periodStart, periodEnd) {
    const { rows } = await query(
      `UPDATE subscriptions.consumer_subscriptions
       SET current_period_start = $2, current_period_end = $3,
           status = 'active', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, periodStart, periodEnd]
    );
    return rows[0] || null;
  },

  async softDelete(id) {
    await query(
      'UPDATE subscriptions.consumer_subscriptions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = ConsumerSubscription;
