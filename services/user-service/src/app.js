'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const rabbitmq = require('./utils/rabbitmq');
const userController = require('./controllers/userController');
const userRoutes = require('./routes/userRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const status = { service: 'user-service', status: 'ok', checks: {} };

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

  status.checks.rabbitmq = rabbitmq.isConnected() ? 'up' : 'idle';

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(status);
});

// API-key authenticated user context endpoint (via RabbitMQ RPC)
app.get('/users/me', userController.getMeByApiKey);

// User, profile, and organization REST routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
