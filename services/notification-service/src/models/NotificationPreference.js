'use strict';

const { query } = require('../config/db');

const NotificationPreference = {
  async upsert({ userId, notificationType, emailEnabled = true, inAppEnabled = true }) {
    const { rows } = await query(
      `INSERT INTO notifications.notification_preferences
         (user_id, notification_type, email_enabled, in_app_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, notification_type)
       DO UPDATE SET email_enabled = EXCLUDED.email_enabled,
                     in_app_enabled = EXCLUDED.in_app_enabled,
                     updated_at = NOW()
       RETURNING *`,
      [userId, notificationType, emailEnabled, inAppEnabled]
    );
    return rows[0];
  },

  async findByUser(userId) {
    const { rows } = await query(
      'SELECT * FROM notifications.notification_preferences WHERE user_id = $1 ORDER BY notification_type',
      [userId]
    );
    return rows;
  },

  async findByUserAndType(userId, notificationType) {
    const { rows } = await query(
      `SELECT * FROM notifications.notification_preferences
       WHERE user_id = $1 AND notification_type = $2`,
      [userId, notificationType]
    );
    return rows[0] || null;
  },

  async delete(userId, notificationType) {
    await query(
      'DELETE FROM notifications.notification_preferences WHERE user_id = $1 AND notification_type = $2',
      [userId, notificationType]
    );
  },
};

module.exports = NotificationPreference;
