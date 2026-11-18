'use strict';

const { pool } = require('../config/db');

const ROLES = [
  { name: 'admin', description: 'Platform administrator with full access', isSystem: true },
  { name: 'provider', description: 'API provider who publishes and manages APIs', isSystem: true },
  { name: 'consumer', description: 'API consumer who subscribes to and uses APIs', isSystem: true },
];

const RESOURCES = ['api', 'subscription', 'user', 'api_key', 'analytics', 'notification', 'admin'];
const ACTIONS = ['create', 'read', 'update', 'delete'];

/** Map role name → array of "resource:action" strings. */
const ROLE_PERMISSIONS = {
  admin: RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}:${a}`)),
  provider: [
    'api:create', 'api:read', 'api:update', 'api:delete',
    'subscription:read',
    'api_key:read',
    'analytics:read',
    'user:read', 'user:update',
    'notification:read',
  ],
  consumer: [
    'api:read',
    'subscription:create', 'subscription:read', 'subscription:update',
    'api_key:create', 'api_key:read', 'api_key:delete',
    'analytics:read',
    'user:read', 'user:update',
    'notification:read',
  ],
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Seed roles ---
    const roleIds = {};
    for (const role of ROLES) {
      const { rows } = await client.query(
        `INSERT INTO auth.roles (name, description, is_system)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [role.name, role.description, role.isSystem]
      );
      roleIds[role.name] = rows[0].id;
    }
    console.log('  ✔ Roles seeded');

    // --- Seed permissions ---
    const permIds = {};
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        const permName = `${resource}:${action}`;
        const { rows } = await client.query(
          `INSERT INTO auth.permissions (name, description, resource, action)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
           RETURNING id`,
          [permName, `${action} ${resource}`, resource, action]
        );
        permIds[permName] = rows[0].id;
      }
    }
    console.log('  ✔ Permissions seeded');

    // --- Seed role-permission mappings ---
    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permName of perms) {
        await client.query(
          `INSERT INTO auth.role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleIds[roleName], permIds[permName]]
        );
      }
    }
    console.log('  ✔ Role-permission mappings seeded');

    await client.query('COMMIT');
    console.log('Auth service seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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
