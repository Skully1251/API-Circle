'use strict';

const { query } = require('../config/db');

const Api = {
  async create({ providerId, name, slug, description, shortDescription, categoryId, visibility }) {
    const { rows } = await query(
      `INSERT INTO catalog.apis
         (provider_id, name, slug, description, short_description, category_id, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [providerId, name, slug, description, shortDescription || null, categoryId || null, visibility || 'private']
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM catalog.apis WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const { rows } = await query(
      'SELECT * FROM catalog.apis WHERE slug = $1 AND deleted_at IS NULL',
      [slug]
    );
    return rows[0] || null;
  },

  async findByProvider(providerId) {
    const { rows } = await query(
      `SELECT * FROM catalog.apis
       WHERE provider_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [providerId]
    );
    return rows;
  },

  async findPublished({ categoryId, limit = 20, offset = 0 }) {
    const params = [limit, offset];
    let where = "status = 'published' AND visibility = 'public' AND deleted_at IS NULL";

    if (categoryId) {
      where += ` AND category_id = $${params.length + 1}`;
      params.push(categoryId);
    }

    const { rows } = await query(
      `SELECT * FROM catalog.apis WHERE ${where} ORDER BY is_featured DESC, published_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    return rows;
  },

  async findFeatured(limit = 10) {
    const { rows } = await query(
      `SELECT * FROM catalog.apis
       WHERE is_featured = true AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
       ORDER BY published_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = [
      'name', 'slug', 'description', 'short_description', 'category_id',
      'logo_url', 'website_url', 'terms_of_service_url', 'visibility',
      'status', 'is_featured',
    ];
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

    // Auto-set published_at / deprecated_at
    if (fields.status === 'published') {
      sets.push(`published_at = COALESCE(published_at, NOW())`);
    } else if (fields.status === 'deprecated') {
      sets.push(`deprecated_at = COALESCE(deprecated_at, NOW())`);
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE catalog.apis SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async addTags(apiId, tags) {
    for (const tag of tags) {
      await query(
        'INSERT INTO catalog.api_tags (api_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [apiId, tag]
      );
    }
  },

  async getTags(apiId) {
    const { rows } = await query(
      'SELECT tag FROM catalog.api_tags WHERE api_id = $1 ORDER BY tag',
      [apiId]
    );
    return rows.map((r) => r.tag);
  },

  async removeTags(apiId, tags) {
    await query(
      'DELETE FROM catalog.api_tags WHERE api_id = $1 AND tag = ANY($2)',
      [apiId, tags]
    );
  },

  async softDelete(id) {
    await query(
      'UPDATE catalog.apis SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = Api;
