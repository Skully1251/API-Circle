'use strict';

const { query } = require('../config/db');

const Organization = {
  async create({ name, slug, description, ownerUserId }) {
    const { rows } = await query(
      `INSERT INTO users.organizations (name, slug, description, owner_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, description, ownerUserId]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM users.organizations WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const { rows } = await query(
      'SELECT * FROM users.organizations WHERE slug = $1 AND deleted_at IS NULL',
      [slug]
    );
    return rows[0] || null;
  },

  async findByOwner(ownerUserId) {
    const { rows } = await query(
      'SELECT * FROM users.organizations WHERE owner_user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [ownerUserId]
    );
    return rows;
  },

  async findByMember(userId) {
    const { rows } = await query(
      `SELECT o.*
       FROM users.organizations o
       JOIN users.organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1 AND o.deleted_at IS NULL AND om.deleted_at IS NULL
       ORDER BY o.name`,
      [userId]
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = ['name', 'slug', 'description', 'logo_url', 'website', 'is_active'];
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
      `UPDATE users.organizations SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async softDelete(id) {
    await query(
      'UPDATE users.organizations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = Organization;
