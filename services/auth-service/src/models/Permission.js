'use strict';

const { query } = require('../config/db');

const Permission = {
  /**
   * Create a permission.
   */
  async create({ name, description, resource, action }) {
    const { rows } = await query(
      `INSERT INTO auth.permissions (name, description, resource, action)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, resource, action]
    );
    return rows[0];
  },

  /**
   * Find a permission by name.
   */
  async findByName(name) {
    const { rows } = await query(
      'SELECT * FROM auth.permissions WHERE name = $1',
      [name]
    );
    return rows[0] || null;
  },

  /**
   * List all permissions.
   */
  async findAll() {
    const { rows } = await query(
      'SELECT * FROM auth.permissions ORDER BY resource, action'
    );
    return rows;
  },

  /**
   * Grant a permission to a role.
   */
  async grantToRole(roleId, permissionId) {
    await query(
      `INSERT INTO auth.role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleId, permissionId]
    );
  },

  /**
   * Get all permissions for a role.
   */
  async findByRoleId(roleId) {
    const { rows } = await query(
      `SELECT p.*
       FROM auth.permissions p
       JOIN auth.role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );
    return rows;
  },

  /**
   * Get all permissions for a user (via their roles).
   */
  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT DISTINCT p.*
       FROM auth.permissions p
       JOIN auth.role_permissions rp ON rp.permission_id = p.id
       JOIN auth.user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1
       ORDER BY p.resource, p.action`,
      [userId]
    );
    return rows;
  },
};

module.exports = Permission;
