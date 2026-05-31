import type { NextFunction, Request, Response } from 'express';

import { prisma } from '@absolute-ice-cream/database';

import { getRequestToken, normalizePermissionCodes, verifyAuthToken } from '../lib/custom-auth';
import {
  findLocalSession,
  findLocalUserById,
  getFallbackPermissionsByRoleName
} from '../lib/local-auth-store';

const branchScopedRoles = new Set(['Branch Manager', 'Sales Representative', 'Store Keeper']);
const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const payload = verifyAuthToken(token);
    if (!isDatabaseConfigured) {
      const session = findLocalSession(token);
      if (!session || session.expiresAt <= new Date()) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const account = findLocalUserById(payload.userId);
      if (!account || !account.isActive || account.deletedAt) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const rawPermissions = getFallbackPermissionsByRoleName(account.roleName);
      const permissions = normalizePermissionCodes(rawPermissions);
      const roles = [
        {
          id: account.roleId,
          name: account.roleName,
          description: `${account.roleName} role`,
          isSystemRole: account.roleName === 'Super Admin'
        }
      ];

      req.authContext = {
        branch: null,
        clerkUserId: account.id,
        isBranchScoped: roles.some((role) => branchScopedRoles.has(role.name)),
        organizationId: account.organizationId,
        permissions,
        profile: {
          id: account.id,
          clerkUserId: account.id,
          organizationId: account.organizationId,
          firstName: account.firstName,
          lastName: account.lastName,
          fullName: `${account.firstName} ${account.lastName}`.trim(),
          email: account.email,
          phone: null,
          avatarUrl: null,
          branchId: null,
          status: 'ACTIVE',
          workId: account.workId
        },
        rawPermissions,
        roles
      };

      return next();
    }

    const now = new Date();
    const session = await prisma.authSession.findFirst({
      where: {
        token,
        expiresAt: {
          gt: now
        }
      }
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const account = await prisma.userAccount.findFirst({
      where: {
        deletedAt: null,
        id: payload.userId,
        isActive: true,
        organizationId: payload.organizationId
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        },
        userProfile: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!account || !account.userProfile) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const rawPermissions = account.role.permissions.map((item) => item.permission.code);
    const permissions = normalizePermissionCodes(rawPermissions);
    const roles = [
      {
        id: account.role.id,
        name: account.role.name,
        description: account.role.description,
        isSystemRole: account.role.isSystemRole
      }
    ];

    req.authContext = {
      branch: account.userProfile.branch,
      clerkUserId: account.id,
      isBranchScoped:
        Boolean(account.userProfile.branchId) && roles.some((role) => branchScopedRoles.has(role.name)),
      organizationId: account.organizationId,
      permissions,
      profile: {
        id: account.userProfile.id,
        clerkUserId: account.id,
        organizationId: account.organizationId,
        firstName: account.firstName,
        lastName: account.lastName,
        fullName: `${account.firstName} ${account.lastName}`.trim(),
        email: account.email,
        phone: account.userProfile.phone,
        avatarUrl: account.userProfile.avatarUrl,
        branchId: account.userProfile.branchId,
        status: account.userProfile.status
      },
      rawPermissions,
      roles
    };

    return next();
  } catch (error) {
    void error;
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }
}
