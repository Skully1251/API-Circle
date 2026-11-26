'use strict';

const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const { redis, KEYS } = require('../config/redis');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

async function invalidateOrgCache(orgId) {
  try {
    await redis.del(KEYS.org(orgId));
  } catch (err) {
    logger.warn('Redis del org failed', { orgId, errMessage: err.message });
  }
}

async function invalidateMembersCache(orgId) {
  try {
    await redis.del(KEYS.orgMembers(orgId));
  } catch (err) {
    logger.warn('Redis del orgMembers failed', { orgId, errMessage: err.message });
  }
}

async function requireOrgAdminOrOwner(orgId, userId, isPlatformAdmin = false) {
  if (isPlatformAdmin) return;
  const membership = await OrganizationMember.findMembership(orgId, userId);
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    throw new AppError('Organization owner or admin permissions required', 403, 'FORBIDDEN');
  }
  return membership;
}

const organizationService = {
  async createOrganization({ name, slug, description, logoUrl, website, ownerUserId }) {
    const existing = await Organization.findBySlug(slug);
    if (existing) {
      throw new AppError('An organization with this slug already exists', 409, 'SLUG_EXISTS');
    }

    return Organization.createWithOwner({
      name: name.trim(),
      slug,
      description: description ?? null,
      logoUrl: logoUrl ?? null,
      website: website ?? null,
      ownerUserId,
    });
  },

  async listUserOrganizations(userId) {
    return Organization.findByMember(userId);
  },

  async getOrganization(orgId, requesterId, isPlatformAdmin = false) {
    let org = null;
    try {
      const cached = await redis.get(KEYS.org(orgId));
      if (cached) {
        org = JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Redis get org failed', { orgId, errMessage: err.message });
    }

    if (!org) {
      org = await Organization.findById(orgId);
      if (!org) {
        throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
      }
      try {
        await redis.set(KEYS.org(orgId), JSON.stringify(org), 'EX', KEYS.ORG_TTL);
      } catch (err) {
        logger.warn('Redis set org failed', { orgId, errMessage: err.message });
      }
    }

    if (!isPlatformAdmin) {
      const membership = await OrganizationMember.findMembership(orgId, requesterId);
      if (!membership) {
        throw new AppError('You are not a member of this organization', 403, 'FORBIDDEN');
      }
    }

    return org;
  },

  async updateOrganization(orgId, rawFields, requesterId, isPlatformAdmin = false) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    await requireOrgAdminOrOwner(orgId, requesterId, isPlatformAdmin);

    const fields = {
      name: rawFields.name,
      slug: rawFields.slug,
      description: rawFields.description,
      logo_url: rawFields.logo_url ?? rawFields.logoUrl,
      website: rawFields.website,
      is_active: rawFields.is_active ?? rawFields.isActive,
    };

    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    );

    if (cleanFields.slug && cleanFields.slug !== org.slug) {
      const slugOwner = await Organization.findBySlug(cleanFields.slug);
      if (slugOwner) {
        throw new AppError('An organization with this slug already exists', 409, 'SLUG_EXISTS');
      }
    }

    const updated = await Organization.update(orgId, cleanFields);
    if (!updated) {
      return org;
    }

    await invalidateOrgCache(orgId);
    return updated;
  },

  async deleteOrganization(orgId, requesterId, isPlatformAdmin = false) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    if (!isPlatformAdmin && org.owner_user_id !== requesterId) {
      throw new AppError('Only the organization owner can delete this organization', 403, 'FORBIDDEN');
    }

    await Organization.softDelete(orgId);
    await Promise.all([invalidateOrgCache(orgId), invalidateMembersCache(orgId)]);
  },

  async listMembers(orgId, requesterId, isPlatformAdmin = false) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    if (!isPlatformAdmin) {
      const membership = await OrganizationMember.findMembership(orgId, requesterId);
      if (!membership) {
        throw new AppError('You are not a member of this organization', 403, 'FORBIDDEN');
      }
    }

    try {
      const cached = await redis.get(KEYS.orgMembers(orgId));
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Redis get orgMembers failed', { orgId, errMessage: err.message });
    }

    const members = await OrganizationMember.findByOrganization(orgId);

    try {
      await redis.set(KEYS.orgMembers(orgId), JSON.stringify(members), 'EX', KEYS.ORG_MEMBERS_TTL);
    } catch (err) {
      logger.warn('Redis set orgMembers failed', { orgId, errMessage: err.message });
    }

    return members;
  },

  async addMember({ orgId, userId, role = 'member', invitedBy, isPlatformAdmin = false }) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const requesterMembership = await requireOrgAdminOrOwner(orgId, invitedBy, isPlatformAdmin);

    if (role === 'owner' && !isPlatformAdmin && requesterMembership?.role !== 'owner') {
      throw new AppError('Only an owner can assign the owner role', 403, 'FORBIDDEN');
    }

    const existing = await OrganizationMember.findMembership(orgId, userId);
    if (existing) {
      throw new AppError('User is already a member of this organization', 409, 'MEMBER_EXISTS');
    }

    const member = await OrganizationMember.add({
      organizationId: orgId,
      userId,
      role,
      invitedBy,
    });

    await invalidateMembersCache(orgId);
    return member;
  },

  async updateMemberRole({ orgId, targetUserId, role, requesterId, isPlatformAdmin = false }) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const requesterMembership = await requireOrgAdminOrOwner(orgId, requesterId, isPlatformAdmin);

    if (org.owner_user_id === targetUserId && role !== 'owner') {
      throw new AppError('Cannot demote the primary organization owner', 400, 'CANNOT_DEMOTE_OWNER');
    }

    if (role === 'owner' && !isPlatformAdmin && requesterMembership?.role !== 'owner') {
      throw new AppError('Only an owner can assign the owner role', 403, 'FORBIDDEN');
    }

    const updated = await OrganizationMember.updateRole(orgId, targetUserId, role);
    if (!updated) {
      throw new AppError('Organization member not found', 404, 'MEMBER_NOT_FOUND');
    }

    await invalidateMembersCache(orgId);
    return updated;
  },

  async removeMember({ orgId, targetUserId, requesterId, isPlatformAdmin = false }) {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    if (org.owner_user_id === targetUserId) {
      throw new AppError('Cannot remove the primary organization owner', 400, 'CANNOT_REMOVE_OWNER');
    }

    if (!isPlatformAdmin && requesterId !== targetUserId) {
      await requireOrgAdminOrOwner(orgId, requesterId, false);
    }

    const existing = await OrganizationMember.findMembership(orgId, targetUserId);
    if (!existing) {
      throw new AppError('Organization member not found', 404, 'MEMBER_NOT_FOUND');
    }

    await OrganizationMember.remove(orgId, targetUserId);
    await invalidateMembersCache(orgId);
  },
};

module.exports = organizationService;
