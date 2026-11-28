'use strict';

const categoryService = require('../services/categoryService');

async function listCategories(req, res, next) {
  try {
    const flat = req.query.flat === 'true';
    const categories = await categoryService.listCategories({ flat });
    return res.status(200).json({ items: categories });
  } catch (err) {
    return next(err);
  }
}

async function getCategoryBySlug(req, res, next) {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    return res.status(200).json(category);
  } catch (err) {
    return next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await categoryService.createCategory(req.body);
    return res.status(201).json(category);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCategories,
  getCategoryBySlug,
  createCategory,
};
