'use strict';

const { query } = require('../config/db');

const ProviderConfig = {
  async create({
    apiId,
    authType,
    authConfig,
    rateLimitPerSecond,
    timeoutMs,
    retryCount,
    customHeaders,
  }) {
    const { rows } = await query(
      `INSERT INTO catalog.provider_configs
         (api_id, auth_type, auth_config, rate_limit_per_second, timeout_ms, retry_count, custom_headers)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        apiId,
        authType,
        JSON.stringify(authConfig || {}),
        rateLimitPerSecond || null,
        timeoutMs || 30000,
        retryCount || 0,
        JSON.stringify(customHeaders || {}),
      ]
    );
    return rows[0];
  },

  async upsert({
    apiId,
    authType,
    authConfig,
    rateLimitPerSecond,
    timeoutMs,
    retryCount,
    customHeaders,
  }) {
    const { rows } = await query(
      `INSERT INTO catalog.provider_configs
         (api_id, auth_type, auth_config, rate_limit_per_second, timeout_ms, retry_count, custom_headers)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (api_id) DO UPDATE SET
         auth_type = EXCLUDED.auth_type,
         auth_config = EXCLUDED.auth_config,
         rate_limit_per_second = EXCLUDED.rate_limit_per_second,
         timeout_ms = EXCLUDED.timeout_ms,
         retry_count = EXCLUDED.retry_count,
         custom_headers = EXCLUDED.custom_headers,
         updated_at = NOW()
       RETURNING *`,
      [
        apiId,
        authType,
        JSON.stringify(authConfig || {}),
        rateLimitPerSecond ?? null,
        timeoutMs ?? 30000,
        retryCount ?? 0,
        JSON.stringify(customHeaders || {}),
      ]
    );
    return rows[0];
  },

  async findByApiId(apiId) {
    const { rows } = await query(
      'SELECT * FROM catalog.provider_configs WHERE api_id = $1',
      [apiId]
    );
    return rows[0] || null;
  },

  async update(apiId, fields) {
    const allowed = [
      'auth_type',
      'auth_config',
      'rate_limit_per_second',
      'timeout_ms',
      'retry_count',
      'custom_headers',
    ];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        const val = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
        sets.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (sets.length === 0) return null;

    sets.push('updated_at = NOW()');
    values.push(apiId);

    const { rows } = await query(
      `UPDATE catalog.provider_configs SET ${sets.join(', ')} WHERE api_id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async delete(apiId) {
    await query('DELETE FROM catalog.provider_configs WHERE api_id = $1', [apiId]);
  },
};

module.exports = ProviderConfig;
