'use strict';

const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middlewares/authenticate');
const { requireFields, validateSlug } = require('../middlewares/validate');

const router = express.Router();

router.get('/categories', categoryController.listCategories);
router.get('/categories/:slug', categoryController.getCategoryBySlug);
router.post(
  '/categories',
  authenticate,
  requireRole('admin'),
  requireFields(['name', 'slug']),
  validateSlug('slug'),
  categoryController.createCategory
);

module.exports = router;
