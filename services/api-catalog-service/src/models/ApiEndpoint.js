'use strict';

const { query } = require('../config/db');

const ApiEndpoint = {
  async create({ apiVersionId, path, method, summary, description, requestBodySchema, responseSchema, queryParameters, pathParameters, headers }) {
    const { rows } = await query(
      `INSERT INTO catalog.api_endpoints
         (api_version_id, path, method, summary, description,
          request_body_schema, response_schema, query_parameters, path_parameters, headers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        apiVersionId, path, method.toUpperCase(), summary || null, description || null,
        requestBodySchema ? JSON.stringify(requestBodySchema) : null,
        responseSchema ? JSON.stringify(responseSchema) : null,
        queryParameters ? JSON.stringify(queryParameters) : null,
        pathParameters ? JSON.stringify(pathParameters) : null,
        headers ? JSON.stringify(headers) : null,
      ]
    );
    return rows[0];
  },

  async findByVersion(apiVersionId) {
    const { rows } = await query(
      'SELECT * FROM catalog.api_endpoints WHERE api_version_id = $1 ORDER BY path, method',
      [apiVersionId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM catalog.api_endpoints WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['path', 'method', 'summary', 'description', 'request_body_schema', 'response_schema', 'query_parameters', 'path_parameters', 'headers', 'is_deprecated'];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        const val = (typeof value === 'object' && value !== null && !Array.isArray(value))
          ? JSON.stringify(value) : value;
        sets.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (sets.length === 0) return null;

    sets.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE catalog.api_endpoints SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async delete(id) {
    await query('DELETE FROM catalog.api_endpoints WHERE id = $1', [id]);
  },
};

module.exports = ApiEndpoint;
