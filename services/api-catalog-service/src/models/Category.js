'use strict';

const { query } = require('../config/db');

const Category = {
  async create({ name, slug, description, icon, parentId, sortOrder }) {
    const { rows } = await query(
      `INSERT INTO catalog.categories (name, slug, description, icon, parent_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, description, icon || null, parentId || null, sortOrder || 0]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM catalog.categories WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const { rows } = await query('SELECT * FROM catalog.categories WHERE slug = $1', [slug]);
    return rows[0] || null;
  },

  async findAll() {
    const { rows } = await query(
      'SELECT * FROM catalog.categories ORDER BY sort_order, name'
    );
    return rows;
  },

  async findTopLevel() {
    const { rows } = await query(
      'SELECT * FROM catalog.categories WHERE parent_id IS NULL ORDER BY sort_order, name'
    );
    return rows;
  },

  async findChildren(parentId) {
    const { rows } = await query(
      'SELECT * FROM catalog.categories WHERE parent_id = $1 ORDER BY sort_order, name',
      [parentId]
    );
    return rows;
  },
};

module.exports = Category;
