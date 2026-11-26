'use strict';

const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, requireSelfOrAdmin, requireRole } = require('../middlewares/authenticate');
const {
  validateUuidParam,
  validateOptionalEmail,
  validateTheme,
} = require('../middlewares/validate');

const router = express.Router();

// All /api/v1/users routes require a valid JWT
router.use(authenticate);

// User Profile
router.get('/:id/profile', validateUuidParam('id'), userController.getProfile);
router.put('/:id/profile', validateUuidParam('id'), requireSelfOrAdmin('id'), userController.updateProfile);
router.delete('/:id/profile', validateUuidParam('id'), requireSelfOrAdmin('id'), userController.deleteProfile);

// Provider Profile
router.get('/:id/provider-profile', validateUuidParam('id'), userController.getProviderProfile);
router.put(
  '/:id/provider-profile',
  validateUuidParam('id'),
  requireSelfOrAdmin('id'),
  validateOptionalEmail('support_email'),
  validateOptionalEmail('supportEmail'),
  userController.updateProviderProfile
);
router.post(
  '/:id/provider-profile/verify',
  validateUuidParam('id'),
  requireRole('admin'),
  userController.verifyProviderProfile
);

// Consumer Profile
router.get('/:id/consumer-profile', validateUuidParam('id'), requireSelfOrAdmin('id'), userController.getConsumerProfile);
router.put('/:id/consumer-profile', validateUuidParam('id'), requireSelfOrAdmin('id'), userController.updateConsumerProfile);

// Account Settings
router.get('/:id/settings', validateUuidParam('id'), requireSelfOrAdmin('id'), userController.getSettings);
router.put(
  '/:id/settings',
  validateUuidParam('id'),
  requireSelfOrAdmin('id'),
  validateTheme('theme'),
  userController.updateSettings
);

module.exports = router;
