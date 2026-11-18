'use strict';

const { query } = require('../config/db');

const EmailDelivery = {
  async create({ notificationId, recipientEmail, subject, provider }) {
    const { rows } = await query(
      `INSERT INTO notifications.email_deliveries
         (notification_id, recipient_email, subject, provider)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [notificationId, recipientEmail, subject, provider || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM notifications.email_deliveries WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async findByNotification(notificationId) {
    const { rows } = await query(
      'SELECT * FROM notifications.email_deliveries WHERE notification_id = $1 ORDER BY created_at',
      [notificationId]
    );
    return rows;
  },

  /**
   * Update delivery status after a send attempt.
   */
  async updateStatus(id, { status, providerMessageId, errorMessage }) {
    const sets = ['status = $2', 'attempts = attempts + 1', 'updated_at = NOW()'];
    const values = [id, status];
    let idx = 3;

    if (providerMessageId) {
      sets.push(`provider_message_id = $${idx++}`);
      values.push(providerMessageId);
    }
    if (errorMessage) {
      sets.push(`error_message = $${idx++}`);
      values.push(errorMessage);
    }
    if (status === 'sent') {
      sets.push('sent_at = NOW()');
    } else if (status === 'delivered') {
      sets.push('delivered_at = NOW()');
    }

    const { rows } = await query(
      `UPDATE notifications.email_deliveries SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  /**
   * Schedule a retry for a failed delivery.
   */
  async scheduleRetry(id, nextRetryAt) {
    const { rows } = await query(
      `UPDATE notifications.email_deliveries
       SET next_retry_at = $2, updated_at = NOW()
       WHERE id = $1 AND attempts < max_attempts
       RETURNING *`,
      [id, nextRetryAt]
    );
    return rows[0] || null;
  },

  /**
   * Get deliveries pending retry.
   */
  async findPendingRetries(limit = 50) {
    const { rows } = await query(
      `SELECT * FROM notifications.email_deliveries
       WHERE status IN ('pending', 'sent')
         AND next_retry_at <= NOW()
         AND attempts < max_attempts
       ORDER BY next_retry_at
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

module.exports = EmailDelivery;
