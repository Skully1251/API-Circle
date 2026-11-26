'use strict';

const express = require('express');
const organizationController = require('../controllers/organizationController');
const { authenticate } = require('../middlewares/authenticate');
const {
  UUID_REGEX,
  validateUuidParam,
  requireFields,
  validateSlug,
  validateMemberRole,
} = require('../middlewares/validate');
const AppError = require('../utils/AppError');

const router = express.Router();

function validateMemberUserId(req, _res, next) {
  const userId = req.body?.userId || req.body?.user_id;
  if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
    return next(new AppError("Invalid or missing UUID for 'userId'", 400, 'VALIDATION_ERROR'));
  }
  return next();
}

router.use(authenticate);

// Organizations
router.get('/', organizationController.listMine);
router.post(
  '/',
  requireFields(['name', 'slug']),
  validateSlug('slug'),
  organizationController.create
);
router.get('/:id', validateUuidParam('id'), organizationController.getById);
router.put('/:id', validateUuidParam('id'), validateSlug('slug'), organizationController.update);
router.delete('/:id', validateUuidParam('id'), organizationController.remove);

// Organization Members
router.get('/:id/members', validateUuidParam('id'), organizationController.listMembers);
router.post(
  '/:id/members',
  validateUuidParam('id'),
  validateMemberUserId,
  validateMemberRole('role'),
  organizationController.addMember
);
router.put(
  '/:id/members/:userId',
  validateUuidParam('id'),
  validateUuidParam('userId'),
  requireFields(['role']),
  validateMemberRole('role'),
  organizationController.updateMemberRole
);
router.delete(
  '/:id/members/:userId',
  validateUuidParam('id'),
  validateUuidParam('userId'),
  organizationController.removeMember
);

module.exports = router;
