'use strict';

const UserProfile = require('../models/UserProfile');
const ProviderProfile = require('../models/ProviderProfile');
const ConsumerProfile = require('../models/ConsumerProfile');
const { redis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function mapFields(input, fieldMap) {
  const mapped = {};
  for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
    if (input[snakeKey] !== undefined) {
      mapped[snakeKey] = input[snakeKey];
    } else if (input[camelKey] !== undefined) {
      mapped[snakeKey] = input[camelKey];
    }
  }
  return mapped;
}

const USER_PROFILE_FIELDS = {
  firstName: 'first_name',
  lastName: 'last_name',
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  bio: 'bio',
  phone: 'phone',
  timezone: 'timezone',
  locale: 'locale',
};

const PROVIDER_PROFILE_FIELDS = {
  companyName: 'company_name',
  companyWebsite: 'company_website',
  companyLogoUrl: 'company_logo_url',
  description: 'description',
  supportEmail: 'support_email',
  supportUrl: 'support_url',
};

const CONSUMER_PROFILE_FIELDS = {
  companyName: 'company_name',
  useCase: 'use_case',
};

const profileService = {
  async getUserProfile(userId) {
    const cacheKey = KEYS.profile(userId);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Redis get profile failed (falling back to DB)', { userId, errMessage: err.message });
    }

    const profile = await UserProfile.findByUserId(userId);
    if (!profile) {
      throw new AppError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    try {
      await redis.set(cacheKey, JSON.stringify(profile), 'EX', KEYS.PROFILE_TTL);
    } catch (err) {
      logger.warn('Redis set profile failed', { userId, errMessage: err.message });
    }

    return profile;
  },

  async upsertUserProfile(userId, rawFields) {
    const fields = mapFields(rawFields, USER_PROFILE_FIELDS);
    const profile = await UserProfile.upsert(userId, fields);

    try {
      await redis.del(KEYS.profile(userId));
    } catch (err) {
      logger.warn('Redis del profile failed', { userId, errMessage: err.message });
    }

    return profile;
  },

  async deleteUserProfile(userId) {
    const existing = await UserProfile.findByUserId(userId);
    if (!existing) {
      throw new AppError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    await UserProfile.softDelete(userId);

    try {
      await redis.del(KEYS.profile(userId));
    } catch (err) {
      logger.warn('Redis del profile failed', { userId, errMessage: err.message });
    }
  },

  async getProviderProfile(userId) {
    const profile = await ProviderProfile.findByUserId(userId);
    if (!profile) {
      throw new AppError('Provider profile not found', 404, 'PROVIDER_PROFILE_NOT_FOUND');
    }
    return profile;
  },

  async upsertProviderProfile(userId, rawFields) {
    const fields = mapFields(rawFields, PROVIDER_PROFILE_FIELDS);
    return ProviderProfile.upsert(userId, fields);
  },

  async verifyProviderProfile(userId) {
    const profile = await ProviderProfile.verify(userId);
    if (!profile) {
      throw new AppError('Provider profile not found', 404, 'PROVIDER_PROFILE_NOT_FOUND');
    }
    return profile;
  },

  async getConsumerProfile(userId) {
    const profile = await ConsumerProfile.findByUserId(userId);
    if (!profile) {
      throw new AppError('Consumer profile not found', 404, 'CONSUMER_PROFILE_NOT_FOUND');
    }
    return profile;
  },

  async upsertConsumerProfile(userId, rawFields) {
    const fields = mapFields(rawFields, CONSUMER_PROFILE_FIELDS);
    return ConsumerProfile.upsert(userId, fields);
  },
};

module.exports = profileService;
