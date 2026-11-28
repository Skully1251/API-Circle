'use strict';

const { query } = require('../config/db');

const ApiVersion = {
  async create({ apiId, version, baseUrl, status, isDefault, changelog }) {
    const { rows } = await query(
      `INSERT INTO catalog.api_versions (api_id, version, base_url, status, is_default, changelog)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [apiId, version, baseUrl, status || 'active', isDefault || false, changelog || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM catalog.api_versions WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByApi(apiId) {
    const { rows } = await query(
      'SELECT * FROM catalog.api_versions WHERE api_id = $1 ORDER BY is_default DESC, created_at DESC',
      [apiId]
    );
    return rows;
  },

  async findByApiAndVersion(apiId, version) {
    const { rows } = await query(
      'SELECT * FROM catalog.api_versions WHERE api_id = $1 AND version = $2',
      [apiId, version]
    );
    return rows[0] || null;
  },

  async findDefault(apiId) {
    const { rows } = await query(
      'SELECT * FROM catalog.api_versions WHERE api_id = $1 AND is_default = true',
      [apiId]
    );
    return rows[0] || null;
  },

  async clearDefaultForApi(apiId, excludeVersionId = null) {
    if (excludeVersionId) {
      await query(
        'UPDATE catalog.api_versions SET is_default = false, updated_at = NOW() WHERE api_id = $1 AND id <> $2 AND is_default = true',
        [apiId, excludeVersionId]
      );
    } else {
      await query(
        'UPDATE catalog.api_versions SET is_default = false, updated_at = NOW() WHERE api_id = $1 AND is_default = true',
        [apiId]
      );
    }
  },

  async update(id, fields) {
    const allowed = ['version', 'base_url', 'status', 'is_default', 'changelog'];
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

    if (fields.status === 'deprecated') {
      sets.push('deprecated_at = COALESCE(deprecated_at, NOW())');
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE catalog.api_versions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
};

module.exports = ApiVersion;
