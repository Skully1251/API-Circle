'use strict';

const app = require('./src/app');
const config = require('./src/config/env');
const { pool } = require('./src/config/db');
const { redis } = require('./src/config/redis');
const logger = require('./src/utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`Auth service listening on port ${config.port}`, { env: config.nodeEnv });
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down auth-service gracefully`);
  server.close(async () => {
    try {
      await pool.end();
      await redis.quit();
    } catch (err) {
      logger.error('Error during graceful shutdown', { errMessage: err.message });
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
