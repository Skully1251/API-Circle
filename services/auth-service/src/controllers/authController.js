'use strict';

const authService = require('../services/authService');
const tokenService = require('../services/tokenService');

const authController = {
  async register(req, res, next) {
    try {
      const { email, password, role } = req.body;
      const result = await authService.register({ email, password, role });
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const userAgent = req.get('user-agent') || null;
      const result = await authService.login({ email, password, ipAddress, userAgent });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const userAgent = req.get('user-agent') || null;
      const result = await authService.refresh({ refreshToken, ipAddress, userAgent });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body || {};
      await authService.logout({
        accessToken: req.accessToken,
        refreshToken,
      });
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
      return next(err);
    }
  },

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail({ token });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const result = await authService.forgotPassword({ email, ipAddress });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword({ token, newPassword });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      return res.status(200).json({ user });
    } catch (err) {
      return next(err);
    }
  },

  async validateToken(req, res, next) {
    try {
      const { token } = req.body;
      const payload = await tokenService.verifyAccessToken(token);
      return res.status(200).json({
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || [],
        },
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = authController;
