'use strict';

const app = require('./src/app');
const config = require('./src/config/env');
const { pool } = require('./src/config/db');
const { redis, authRedis } = require('./src/config/redis');
const logger = require('./src/utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`API Catalog service listening on port ${config.port}`);
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    try {
      await Promise.allSettled([
        pool.end(),
        redis.quit(),
        authRedis.quit(),
      ]);
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
