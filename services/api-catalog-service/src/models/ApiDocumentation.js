'use strict';

const { query } = require('../config/db');

const ApiDocumentation = {
  async create({ apiId, type, title, content, format, sortOrder }) {
    const { rows } = await query(
      `INSERT INTO catalog.api_documentation (api_id, type, title, content, format, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [apiId, type, title || null, content || null, format || null, sortOrder || 0]
    );
    return rows[0];
  },

  async findByApi(apiId) {
    const { rows } = await query(
      'SELECT * FROM catalog.api_documentation WHERE api_id = $1 ORDER BY sort_order, created_at',
      [apiId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM catalog.api_documentation WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['type', 'title', 'content', 'format', 'sort_order'];
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
      `UPDATE catalog.api_documentation SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async delete(id) {
    await query('DELETE FROM catalog.api_documentation WHERE id = $1', [id]);
  },
};

module.exports = ApiDocumentation;
