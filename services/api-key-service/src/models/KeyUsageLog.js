'use strict';

const { query } = require('../config/db');

const KeyUsageLog = {
  /**
   * Log a single API key usage event.
   */
  async log({ apiKeyId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent }) {
    const { rows } = await query(
      `INSERT INTO api_keys.key_usage_log
         (api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [apiKeyId, endpoint || null, method || null, statusCode || null, responseTimeMs || null, ipAddress || null, userAgent || null]
    );
    return rows[0];
  },

  /**
   * Get recent usage logs for a key.
   */
  async findByKey(apiKeyId, limit = 100) {
    const { rows } = await query(
      `SELECT * FROM api_keys.key_usage_log
       WHERE api_key_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [apiKeyId, limit]
    );
    return rows;
  },

  /**
   * Count requests for a key within a time range.
   */
  async countByKeyInRange(apiKeyId, start, end) {
    const { rows } = await query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM api_keys.key_usage_log
       WHERE api_key_id = $1 AND created_at >= $2 AND created_at < $3`,
      [apiKeyId, start, end]
    );
    return rows[0].count;
  },

  /**
   * Delete logs older than a given number of days (retention cleanup).
   */
  async deleteOlderThan(days = 90) {
    const { rowCount } = await query(
      `DELETE FROM api_keys.key_usage_log
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [days]
    );
    return rowCount;
  },
};

module.exports = KeyUsageLog;
