'use strict';

const AccountSettings = require('../models/AccountSettings');

const SETTINGS_FIELDS = {
  emailNotifications: 'email_notifications',
  marketingEmails: 'marketing_emails',
  twoFactorEnabled: 'two_factor_enabled',
  theme: 'theme',
};

const settingsService = {
  async getSettings(userId) {
    const existing = await AccountSettings.findByUserId(userId);
    if (existing) {
      return existing;
    }
    // Initialize default settings row if not yet created
    return AccountSettings.upsert(userId, {});
  },

  async updateSettings(userId, rawFields) {
    const fields = {};
    for (const [camelKey, snakeKey] of Object.entries(SETTINGS_FIELDS)) {
      if (rawFields[snakeKey] !== undefined) {
        fields[snakeKey] = rawFields[snakeKey];
      } else if (rawFields[camelKey] !== undefined) {
        fields[snakeKey] = rawFields[camelKey];
      }
    }

    return AccountSettings.upsert(userId, fields);
  },
};

module.exports = settingsService;
