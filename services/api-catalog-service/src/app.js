'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const apiRoutes = require('./routes/apiRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const internalRoutes = require('./routes/internalRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '512kb' }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const status = { service: 'api-catalog-service', status: 'ok', checks: {} };

  try {
    await pool.query('SELECT 1');
    status.checks.postgres = 'up';
  } catch (_err) {
    status.checks.postgres = 'down';
    status.status = 'degraded';
  }

  try {
    await redis.ping();
    status.checks.redis = 'up';
  } catch (_err) {
    status.checks.redis = 'down';
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(status);
});

// REST routes
app.use('/api/v1/apis', apiRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/internal', internalRoutes);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
