'use strict';

const { query } = require('../config/db');

const Notification = {
  async create({ userId, templateId, channel, type, title, body, data }) {
    const { rows } = await query(
      `INSERT INTO notifications.notifications
         (user_id, template_id, channel, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, templateId || null, channel, type || 'info', title, body, JSON.stringify(data || {})]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM notifications.notifications WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async findByUser(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    const params = [userId, limit, offset];
    let where = 'user_id = $1';
    if (unreadOnly) {
      where += ' AND is_read = false';
    }

    const { rows } = await query(
      `SELECT * FROM notifications.notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );
    return rows;
  },

  async countUnread(userId) {
    const { rows } = await query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM notifications.notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return rows[0].count;
  },

  async markAsRead(id) {
    const { rows } = await query(
      `UPDATE notifications.notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND is_read = false
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  async markAllAsRead(userId) {
    const { rowCount } = await query(
      `UPDATE notifications.notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return rowCount;
  },
};

module.exports = Notification;
