'use strict';

const { query } = require('../config/db');

const NotificationTemplate = {
  async create({ name, channel, subjectTemplate, bodyTemplate, htmlTemplate }) {
    const { rows } = await query(
      `INSERT INTO notifications.notification_templates
         (name, channel, subject_template, body_template, html_template)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, channel || 'email', subjectTemplate || null, bodyTemplate, htmlTemplate || null]
    );
    return rows[0];
  },

  async findByName(name) {
    const { rows } = await query(
      'SELECT * FROM notifications.notification_templates WHERE name = $1 AND is_active = true',
      [name]
    );
    return rows[0] || null;
  },

  async findAll() {
    const { rows } = await query(
      'SELECT * FROM notifications.notification_templates ORDER BY name'
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = ['name', 'channel', 'subject_template', 'body_template', 'html_template', 'is_active'];
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
    values.push(id);

    const { rows } = await query(
      `UPDATE notifications.notification_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
};

module.exports = NotificationTemplate;
