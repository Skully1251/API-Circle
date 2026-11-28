'use strict';

const express = require('express');
const catalogController = require('../controllers/catalogController');

const router = express.Router();

// Internal gateway route resolution (reads/populates catalog:route:{slug}:{version} in Redis)
router.get('/routes/:slug/:version', catalogController.resolveRoute);

module.exports = router;
