'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/authenticate');
const rateLimiter = require('../middlewares/rateLimiter');
const { requireFields, validateEmail, validatePassword } = require('../middlewares/validate');

const router = express.Router();

// Public routes (protected by Redis rate limiting)
router.post(
  '/register',
  rateLimiter({ endpoint: 'register', maxRequests: 10, windowSeconds: 60 }),
  requireFields(['email', 'password']),
  validateEmail,
  validatePassword('password'),
  authController.register
);

router.post(
  '/login',
  rateLimiter({ endpoint: 'login', maxRequests: 15, windowSeconds: 60 }),
  requireFields(['email', 'password']),
  validateEmail,
  authController.login
);

router.post(
  '/refresh',
  rateLimiter({ endpoint: 'refresh', maxRequests: 30, windowSeconds: 60 }),
  requireFields(['refreshToken']),
  authController.refresh
);

router.post(
  '/verify-email',
  rateLimiter({ endpoint: 'verify-email', maxRequests: 15, windowSeconds: 60 }),
  requireFields(['token']),
  authController.verifyEmail
);

router.post(
  '/forgot-password',
  rateLimiter({ endpoint: 'forgot-password', maxRequests: 5, windowSeconds: 60 }),
  requireFields(['email']),
  validateEmail,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  rateLimiter({ endpoint: 'reset-password', maxRequests: 10, windowSeconds: 60 }),
  requireFields(['token', 'newPassword']),
  validatePassword('newPassword'),
  authController.resetPassword
);

// Internal/gateway token introspection endpoint
router.post(
  '/validate',
  requireFields(['token']),
  authController.validateToken
);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
