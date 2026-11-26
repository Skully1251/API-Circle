'use strict';

const profileService = require('../services/profileService');
const settingsService = require('../services/settingsService');
const rabbitmq = require('../utils/rabbitmq');
const logger = require('../utils/logger');

const userController = {
  async getMeByApiKey(req, res) {
    const apiKey = req.get('x-api-key') || req.get('x-api-circle-key');
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({
        error: 'x-api-key header is required',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      const result = await rabbitmq.validateApiKey(apiKey);
      if (!result || !result.valid) {
        return res.status(401).json({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
        });
      }

      return res.status(200).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        authenticatedBy: 'api-key-service via RabbitMQ',
      });
    } catch (error) {
      logger.error('Could not validate API key via RabbitMQ', { errMessage: error.message });
      return res.status(503).json({
        error: 'API key validation is unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  },

  async getProfile(req, res, next) {
    try {
      const profile = await profileService.getUserProfile(req.params.id);
      return res.status(200).json({ profile });
    } catch (err) {
      return next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const profile = await profileService.upsertUserProfile(req.params.id, req.body);
      return res.status(200).json({ profile });
    } catch (err) {
      return next(err);
    }
  },

  async deleteProfile(req, res, next) {
    try {
      await profileService.deleteUserProfile(req.params.id);
      return res.status(200).json({ message: 'User profile deleted' });
    } catch (err) {
      return next(err);
    }
  },

  async getProviderProfile(req, res, next) {
    try {
      const providerProfile = await profileService.getProviderProfile(req.params.id);
      return res.status(200).json({ providerProfile });
    } catch (err) {
      return next(err);
    }
  },

  async updateProviderProfile(req, res, next) {
    try {
      const providerProfile = await profileService.upsertProviderProfile(req.params.id, req.body);
      return res.status(200).json({ providerProfile });
    } catch (err) {
      return next(err);
    }
  },

  async verifyProviderProfile(req, res, next) {
    try {
      const providerProfile = await profileService.verifyProviderProfile(req.params.id);
      return res.status(200).json({ providerProfile });
    } catch (err) {
      return next(err);
    }
  },

  async getConsumerProfile(req, res, next) {
    try {
      const consumerProfile = await profileService.getConsumerProfile(req.params.id);
      return res.status(200).json({ consumerProfile });
    } catch (err) {
      return next(err);
    }
  },

  async updateConsumerProfile(req, res, next) {
    try {
      const consumerProfile = await profileService.upsertConsumerProfile(req.params.id, req.body);
      return res.status(200).json({ consumerProfile });
    } catch (err) {
      return next(err);
    }
  },

  async getSettings(req, res, next) {
    try {
      const settings = await settingsService.getSettings(req.params.id);
      return res.status(200).json({ settings });
    } catch (err) {
      return next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const settings = await settingsService.updateSettings(req.params.id, req.body);
      return res.status(200).json({ settings });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = userController;
