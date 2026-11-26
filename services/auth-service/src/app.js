'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '16kb' }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const status = { service: 'auth-service', status: 'ok', checks: {} };
  try {
    await pool.query('SELECT 1');
    status.checks.postgres = 'up';
  } catch (err) {
    status.checks.postgres = 'down';
    status.status = 'degraded';
  }

  try {
    await redis.ping();
    status.checks.redis = 'up';
  } catch (err) {
    status.checks.redis = 'down';
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(status);
});

// Auth API routes
app.use('/api/v1/auth', authRoutes);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
