'use strict';

const { query } = require('../config/db');

const OrganizationMember = {
  async add({ organizationId, userId, role = 'member', invitedBy = null }) {
    const { rows } = await query(
      `INSERT INTO users.organization_members (organization_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, user_id) DO NOTHING
       RETURNING *`,
      [organizationId, userId, role, invitedBy]
    );
    return rows[0] || null;
  },

  async findByOrganization(organizationId) {
    const { rows } = await query(
      `SELECT * FROM users.organization_members
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY joined_at`,
      [organizationId]
    );
    return rows;
  },

  async findMembership(organizationId, userId) {
    const { rows } = await query(
      `SELECT * FROM users.organization_members
       WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [organizationId, userId]
    );
    return rows[0] || null;
  },

  async updateRole(organizationId, userId, role) {
    const { rows } = await query(
      `UPDATE users.organization_members
       SET role = $3, updated_at = NOW()
       WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [organizationId, userId, role]
    );
    return rows[0] || null;
  },

  async remove(organizationId, userId) {
    await query(
      `UPDATE users.organization_members
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [organizationId, userId]
    );
  },
};

module.exports = OrganizationMember;
