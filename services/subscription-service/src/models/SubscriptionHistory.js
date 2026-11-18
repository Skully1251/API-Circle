'use strict';

const { query } = require('../config/db');

const SubscriptionHistory = {
  async record({ subscriptionId, eventType, fromPlanId, toPlanId, metadata }) {
    const { rows } = await query(
      `INSERT INTO subscriptions.subscription_history
         (subscription_id, event_type, from_plan_id, to_plan_id, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [subscriptionId, eventType, fromPlanId || null, toPlanId || null, JSON.stringify(metadata || {})]
    );
    return rows[0];
  },

  async findBySubscription(subscriptionId, limit = 50) {
    const { rows } = await query(
      `SELECT * FROM subscriptions.subscription_history
       WHERE subscription_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [subscriptionId, limit]
    );
    return rows;
  },

  async findByEventType(eventType, limit = 50) {
    const { rows } = await query(
      `SELECT * FROM subscriptions.subscription_history
       WHERE event_type = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [eventType, limit]
    );
    return rows;
  },
};

module.exports = SubscriptionHistory;
