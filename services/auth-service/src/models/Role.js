'use strict';

const { query } = require('../config/db');

const Role = {
  /**
   * Create a role.
   */
  async create({ name, description, isSystem = false }) {
    const { rows } = await query(
      `INSERT INTO auth.roles (name, description, is_system)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, isSystem]
    );
    return rows[0];
  },

  /**
   * Find a role by name.
   */
  async findByName(name) {
    const { rows } = await query(
      'SELECT * FROM auth.roles WHERE name = $1',
      [name]
    );
    return rows[0] || null;
  },

  /**
   * List all roles.
   */
  async findAll() {
    const { rows } = await query('SELECT * FROM auth.roles ORDER BY name');
    return rows;
  },

  /**
   * Assign a role to a user.
   */
  async assignToUser(userId, roleId, assignedBy = null) {
    await query(
      `INSERT INTO auth.user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId, assignedBy]
    );
  },

  /**
   * Remove a role from a user.
   */
  async removeFromUser(userId, roleId) {
    await query(
      'DELETE FROM auth.user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );
  },

  /**
   * Get all roles for a user (returns role names).
   */
  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT r.id, r.name, r.description, ur.assigned_at
       FROM auth.roles r
       JOIN auth.user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    return rows;
  },
};

module.exports = Role;
