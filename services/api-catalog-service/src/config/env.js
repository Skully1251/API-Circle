'use strict';

module.exports = {
  port: Number(process.env.PORT || 3004),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    issuer: process.env.JWT_ISSUER || 'api-circle-auth',
  },
  encryption: {
    key: process.env.PROVIDER_CONFIG_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '',
  },
};
