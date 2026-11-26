'use strict';

module.exports = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    accessExpiresSeconds: Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 900),
    refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
    issuer: process.env.JWT_ISSUER || 'api-circle-auth',
  },
  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
    maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5),
    lockoutMinutes: Number(process.env.LOCKOUT_MINUTES || 15),
    emailVerificationExpiresHours: Number(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || 24),
    passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60),
  },
};
