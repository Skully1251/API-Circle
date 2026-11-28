'use strict';

const Category = require('../models/Category');
const { redis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function buildCategoryTree(rows) {
  const map = new Map();
  const roots = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function listCategories({ flat = false } = {}) {
  if (!flat) {
    try {
      const cached = await redis.get(KEYS.categoriesTree());
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn('Redis categories lookup failed', { errMessage: err.message });
    }
  }

  const rows = await Category.findAll();
  if (flat) return rows;

  const tree = buildCategoryTree(rows);
  try {
    await redis.set(KEYS.categoriesTree(), JSON.stringify(tree), 'EX', KEYS.CATEGORIES_TTL);
  } catch (err) {
    logger.warn('Redis categories cache set failed', { errMessage: err.message });
  }

  return tree;
}

async function getCategoryBySlug(slug) {
  const category = await Category.findBySlug(slug);
  if (!category) {
    throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
  }
  const children = await Category.findChildren(category.id);
  return { ...category, children };
}

async function createCategory({ name, slug, description, icon, parentId, sortOrder }) {
  const existing = await Category.findBySlug(slug);
  if (existing) {
    throw new AppError('Category slug already exists', 409, 'SLUG_TAKEN');
  }

  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      throw new AppError('Parent category not found', 404, 'PARENT_CATEGORY_NOT_FOUND');
    }
  }

  const created = await Category.create({
    name,
    slug,
    description: description || null,
    icon: icon || null,
    parentId: parentId || null,
    sortOrder: sortOrder ?? 0,
  });

  try {
    await redis.del(KEYS.categoriesTree());
  } catch (err) {
    logger.warn('Redis categories cache invalidation failed', { errMessage: err.message });
  }

  return created;
}

module.exports = {
  listCategories,
  getCategoryBySlug,
  createCategory,
  buildCategoryTree,
};
