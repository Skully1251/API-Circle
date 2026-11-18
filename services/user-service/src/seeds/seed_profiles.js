'use strict';

/**
 * Optional seed for development – creates a sample user profile.
 * In production, profiles are created via the user-service API
 * when a user registers through auth-service.
 */
const { pool } = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('  ℹ User service seed is a no-op in this release.');
    console.log('  ℹ Profiles are created at registration time via the API.');
    await client.query('COMMIT');
    console.log('User service seed complete.');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
