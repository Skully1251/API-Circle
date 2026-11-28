'use strict';

const { query } = require('../config/db');

const Api = {
  async create({
    providerId,
    name,
    slug,
    description,
    shortDescription,
    categoryId,
    logoUrl,
    websiteUrl,
    termsOfServiceUrl,
    visibility,
    status,
    isFeatured,
  }) {
    const effectiveStatus = status || 'draft';
    const publishedAt = effectiveStatus === 'published' ? new Date() : null;

    const { rows } = await query(
      `INSERT INTO catalog.apis
         (provider_id, name, slug, description, short_description, category_id,
          logo_url, website_url, terms_of_service_url, visibility, status, is_featured, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        providerId,
        name,
        slug,
        description || null,
        shortDescription || null,
        categoryId || null,
        logoUrl || null,
        websiteUrl || null,
        termsOfServiceUrl || null,
        visibility || 'private',
        effectiveStatus,
        Boolean(isFeatured),
        publishedAt,
      ]
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

  async search({
    categoryId,
    categorySlug,
    search,
    visibility,
    status,
    providerId,
    isFeatured,
    tag,
    limit = 20,
    offset = 0,
  } = {}) {
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    }
    if (visibility) {
      conditions.push(`a.visibility = $${idx++}`);
      params.push(visibility);
    }
    if (providerId) {
      conditions.push(`a.provider_id = $${idx++}`);
      params.push(providerId);
    }
    if (categoryId) {
      conditions.push(`a.category_id = $${idx++}`);
      params.push(categoryId);
    }
    if (categorySlug) {
      conditions.push(
        `EXISTS (SELECT 1 FROM catalog.categories c WHERE c.id = a.category_id AND c.slug = $${idx++})`
      );
      params.push(categorySlug);
    }
    if (isFeatured !== undefined) {
      conditions.push(`a.is_featured = $${idx++}`);
      params.push(Boolean(isFeatured));
    }
    if (tag) {
      conditions.push(
        `EXISTS (SELECT 1 FROM catalog.api_tags t WHERE t.api_id = a.id AND t.tag = $${idx++})`
      );
      params.push(tag.toLowerCase());
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        `(a.name ILIKE $${idx} OR a.slug ILIKE $${idx} OR a.short_description ILIKE $${idx} OR a.description ILIKE $${idx})`
      );
      params.push(pattern);
      idx++;
    }

    const where = conditions.join(' AND ');
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM catalog.apis a WHERE ${where}`,
      params
    );

    const dataParams = [...params, safeLimit, safeOffset];
    const { rows } = await query(
      `SELECT a.* FROM catalog.apis a
       WHERE ${where}
       ORDER BY a.is_featured DESC, a.published_at DESC NULLS LAST, a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams
    );

    return {
      items: rows,
      total: countResult.rows[0]?.total || 0,
      limit: safeLimit,
      offset: safeOffset,
    };
  },

  async findPublished({ categoryId, limit = 20, offset = 0 }) {
    const result = await Api.search({
      categoryId,
      status: 'published',
      visibility: 'public',
      limit,
      offset,
    });
    return result.items;
  },

  async findFeatured(limit = 10) {
    const { rows } = await query(
      `SELECT * FROM catalog.apis
       WHERE is_featured = true AND status = 'published' AND visibility = 'public' AND deleted_at IS NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = [
      'name',
      'slug',
      'description',
      'short_description',
      'category_id',
      'logo_url',
      'website_url',
      'terms_of_service_url',
      'visibility',
      'status',
      'is_featured',
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

    if (fields.status === 'published') {
      sets.push('published_at = COALESCE(published_at, NOW())');
    } else if (fields.status === 'deprecated') {
      sets.push('deprecated_at = COALESCE(deprecated_at, NOW())');
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
    for (const rawTag of tags) {
      const tag = String(rawTag).trim().toLowerCase();
      if (!tag) continue;
      await query(
        'INSERT INTO catalog.api_tags (api_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [apiId, tag]
      );
    }
  },

  async replaceTags(apiId, tags) {
    await query('DELETE FROM catalog.api_tags WHERE api_id = $1', [apiId]);
    await Api.addTags(apiId, tags);
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
