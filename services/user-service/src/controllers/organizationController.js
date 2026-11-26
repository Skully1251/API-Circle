'use strict';

const organizationService = require('../services/organizationService');

function isPlatformAdmin(req) {
  return Boolean(req.user?.roles?.includes('admin'));
}

const organizationController = {
  async listMine(req, res, next) {
    try {
      const organizations = await organizationService.listUserOrganizations(req.user.id);
      return res.status(200).json({ organizations });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { name, slug, description, logoUrl, logo_url, website } = req.body;
      const organization = await organizationService.createOrganization({
        name,
        slug,
        description,
        logoUrl: logoUrl ?? logo_url,
        website,
        ownerUserId: req.user.id,
      });
      return res.status(201).json({ organization });
    } catch (err) {
      return next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const organization = await organizationService.getOrganization(
        req.params.id,
        req.user.id,
        isPlatformAdmin(req)
      );
      return res.status(200).json({ organization });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const organization = await organizationService.updateOrganization(
        req.params.id,
        req.body,
        req.user.id,
        isPlatformAdmin(req)
      );
      return res.status(200).json({ organization });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await organizationService.deleteOrganization(
        req.params.id,
        req.user.id,
        isPlatformAdmin(req)
      );
      return res.status(200).json({ message: 'Organization deleted' });
    } catch (err) {
      return next(err);
    }
  },

  async listMembers(req, res, next) {
    try {
      const members = await organizationService.listMembers(
        req.params.id,
        req.user.id,
        isPlatformAdmin(req)
      );
      return res.status(200).json({ members });
    } catch (err) {
      return next(err);
    }
  },

  async addMember(req, res, next) {
    try {
      const targetUserId = req.body.userId || req.body.user_id;
      const member = await organizationService.addMember({
        orgId: req.params.id,
        userId: targetUserId,
        role: req.body.role || 'member',
        invitedBy: req.user.id,
        isPlatformAdmin: isPlatformAdmin(req),
      });
      return res.status(201).json({ member });
    } catch (err) {
      return next(err);
    }
  },

  async updateMemberRole(req, res, next) {
    try {
      const member = await organizationService.updateMemberRole({
        orgId: req.params.id,
        targetUserId: req.params.userId,
        role: req.body.role,
        requesterId: req.user.id,
        isPlatformAdmin: isPlatformAdmin(req),
      });
      return res.status(200).json({ member });
    } catch (err) {
      return next(err);
    }
  },

  async removeMember(req, res, next) {
    try {
      await organizationService.removeMember({
        orgId: req.params.id,
        targetUserId: req.params.userId,
        requesterId: req.user.id,
        isPlatformAdmin: isPlatformAdmin(req),
      });
      return res.status(200).json({ message: 'Member removed from organization' });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = organizationController;
