import { randomInt, randomUUID } from 'crypto';

import { Prisma } from '@prisma/client';
import { prisma } from '@absolute-ice-cream/database';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { z } from 'zod';

import { authenticateRequest } from '../middleware/auth';
import {
  createSessionToken,
  getRequestToken,
  getSessionMaxAgeMs,
  normalizePermissionCodes,
  signAuthToken
} from '../lib/custom-auth';
import {
  allowedRoles,
  createLocalSession,
  createLocalUserAccount,
  deleteLocalSession,
  fallbackRoles,
  findLocalUserByWorkId,
  getFallbackPermissionsByRoleName,
  getFallbackRoleById,
  getLocalUsers
} from '../lib/local-auth-store';
import { sendWorkIdEmail } from '../services/email.service';

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const registerSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(2)
      .regex(/^[A-Za-z]+$/, 'First name must contain letters only'),
    last_name: z
      .string()
      .trim()
      .min(2)
      .regex(/^[A-Za-z]+$/, 'Surname must contain letters only'),
    id_number: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[0-9]{6,9}[A-Z][0-9]{2}$/.test(value), {
        message: 'ID number format is invalid'
      }),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/),
    confirm_password: z.string(),
    role_id: z.string().uuid(),
    admin_key: z.string().trim().min(1)
  })
  .refine((value) => value.password === value.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password']
  });

const loginSchema = z.object({
  work_id: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^AQI-[0-9]{8}$/.test(value), {
      message: 'Please enter a valid Work ID'
    }),
  password: z.string().min(1)
});

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

function isBranchScopedRole(roleName: string) {
  return roleName === 'Branch Manager' || roleName === 'Sales Representative' || roleName === 'Store Keeper';
}

async function writeAuditLog(input: {
  action: string;
  entityId: string;
  entityType: string;
  ipAddress?: string | null;
  newValues?: Record<string, unknown>;
  organizationId?: string | null;
  userAgent?: string | null;
  userProfileId?: string | null;
}) {
  if (!process.env.DATABASE_URL || !input.organizationId) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityId: input.entityId,
        entityType: input.entityType,
        ipAddress: input.ipAddress ?? null,
        newValues: input.newValues as Prisma.InputJsonValue | undefined,
        organizationId: input.organizationId,
        userAgent: input.userAgent ?? null,
        userProfileId: input.userProfileId ?? null
      }
    });
  } catch {
    // Intentionally swallow audit logging errors for auth flow resiliency.
  }
}

async function generateUniqueWorkId() {
  const year = new Date().getUTCFullYear();

  if (!isDatabaseConfigured) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = randomInt(0, 10_000).toString().padStart(4, '0');
      const workId = `AQI-${year}${suffix}`;
      const existing = getLocalUsers().find((account) => account.workId === workId);

      if (!existing) {
        return workId;
      }
    }

    throw new Error('Could not generate a unique Work ID. Please retry.');
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = randomInt(0, 10_000).toString().padStart(4, '0');
    const workId = `AQI-${year}${suffix}`;
    const existing = await prisma.userAccount.findUnique({
      where: {
        workId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return workId;
    }
  }

  throw new Error('Could not generate a unique Work ID. Please retry.');
}

function toCurrentUserResponse(account: {
  id: string;
  organizationId: string;
  workId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    permissions: Array<{
      permission: {
        code: string;
      };
    }>;
  };
  userProfile: {
    id: string;
    branchId: string | null;
    phone: string | null;
    avatarUrl: string | null;
    status: string;
    branch: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
}) {
  const rawPermissions = account.role.permissions.map((item) => item.permission.code);
  const permissions = normalizePermissionCodes(rawPermissions);

  return {
    branch: account.userProfile?.branch ?? null,
    clerkUserId: account.id,
    isBranchScoped: Boolean(account.userProfile?.branchId) && isBranchScopedRole(account.role.name),
    organizationId: account.organizationId,
    permissions,
    profile: {
      id: account.userProfile?.id ?? account.id,
      clerkUserId: account.id,
      organizationId: account.organizationId,
      firstName: account.firstName,
      lastName: account.lastName,
      fullName: `${account.firstName} ${account.lastName}`.trim(),
      email: account.email,
      phone: account.userProfile?.phone ?? null,
      avatarUrl: account.userProfile?.avatarUrl ?? null,
      branchId: account.userProfile?.branchId ?? null,
      status: account.userProfile?.status ?? 'ACTIVE',
      workId: account.workId
    },
    rawPermissions,
    roles: [
      {
        id: account.role.id,
        name: account.role.name,
        description: account.role.description,
        isSystemRole: account.role.isSystemRole
      }
    ]
  };
}

function toCurrentUserResponseLocal(account: {
  id: string;
  organizationId: string;
  workId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  roleName: (typeof allowedRoles)[number];
}) {
  const permissions = getFallbackPermissionsByRoleName(account.roleName);

  return {
    branch: null,
    clerkUserId: account.id,
    isBranchScoped: isBranchScopedRole(account.roleName),
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
    rawPermissions: permissions,
    roles: [
      {
        id: account.roleId,
        name: account.roleName,
        description: `${account.roleName} role`,
        isSystemRole: account.roleName === 'Super Admin'
      }
    ]
  };
}

export const authRouter = Router();

authRouter.get('/roles', async (_req, res, next) => {
  try {
    if (!isDatabaseConfigured) {
      return res.status(200).json(fallbackRoles);
    }

    const roles = await prisma.role.findMany({
      where: {
        name: {
          in: [...allowedRoles]
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    roles.sort((a, b) => allowedRoles.indexOf(a.name as (typeof allowedRoles)[number]) - allowedRoles.indexOf(b.name as (typeof allowedRoles)[number]));

    return res.status(200).json(roles);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/register', registerLimiter, async (req, res, next) => {
  try {
    if (!isDatabaseConfigured) {
      const payload = registerSchema.parse(req.body);
      const role = getFallbackRoleById(payload.role_id);

      if (!role) {
        return res.status(400).json({
          error: 'Please select a valid role'
        });
      }

      const existingByEmail = getLocalUsers().find((user) => user.email === payload.email);
      if (existingByEmail) {
        return res.status(409).json({
          error: 'Email address is already registered.'
        });
      }

      const existingByIdNumber = getLocalUsers().find((user) => user.idNumber === payload.id_number);
      if (existingByIdNumber) {
        return res.status(409).json({
          error: 'ID number is already registered.'
        });
      }

      const workId = await generateUniqueWorkId();
      const passwordHash = await bcrypt.hash(payload.password, 12);
      createLocalUserAccount({
        workId,
        firstName: payload.first_name,
        lastName: payload.last_name,
        idNumber: payload.id_number,
        email: payload.email,
        passwordHash,
        roleId: role.id,
        roleName: role.name,
        organizationId: 'local-dev-org'
      });
      const emailResult = await sendWorkIdEmail(payload.email, payload.first_name, workId, role.name);

      const message = emailResult.sent
        ? `Account created successfully! Your Work ID has been sent to ${payload.email}. Check your inbox and use your Work ID to log in.`
        : `Account created successfully, but we could not send email right now. Your Work ID is ${workId}. Use it to log in.`;

      return res.status(201).json({
        message,
        redirectTo: '/auth/login'
      });
    }

    const payload = registerSchema.parse(req.body);
    const role = await prisma.role.findUnique({
      where: {
        id: payload.role_id
      }
    });

    if (!role || !allowedRoles.includes(role.name as (typeof allowedRoles)[number])) {
      return res.status(400).json({
        error: 'Please select a valid role'
      });
    }

    const adminKey = await prisma.adminKey.findFirst({
      where: {
        isActive: true,
        keyValue: payload.admin_key
      }
    });

    if (
      !adminKey ||
      (adminKey.expiresAt && adminKey.expiresAt <= new Date()) ||
      (adminKey.maxUsage !== null && adminKey.maxUsage !== undefined && adminKey.usageCount >= adminKey.maxUsage)
    ) {
      return res.status(400).json({
        error: 'Invalid admin key. Please contact your administrator.'
      });
    }

    const existingByEmail = await prisma.userAccount.findUnique({
      where: {
        email: payload.email
      },
      select: {
        id: true
      }
    });
    if (existingByEmail) {
      return res.status(409).json({
        error: 'Email address is already registered.'
      });
    }

    const existingByIdNumber = await prisma.userAccount.findUnique({
      where: {
        idNumber: payload.id_number
      },
      select: {
        id: true
      }
    });
    if (existingByIdNumber) {
      return res.status(409).json({
        error: 'ID number is already registered.'
      });
    }

    const workId = await generateUniqueWorkId();
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const profileClerkId = `local-${randomUUID()}`;

    const result = await prisma.$transaction(async (db) => {
      const userProfile = await db.userProfile.create({
        data: {
          clerkUserId: profileClerkId,
          organizationId: role.organizationId,
          firstName: payload.first_name,
          lastName: payload.last_name,
          email: payload.email
        }
      });

      await db.userRole.create({
        data: {
          userProfileId: userProfile.id,
          roleId: role.id,
          assignedBy: userProfile.id
        }
      });

      const userAccount = await db.userAccount.create({
        data: {
          workId,
          firstName: payload.first_name,
          lastName: payload.last_name,
          idNumber: payload.id_number,
          email: payload.email,
          passwordHash,
          roleId: role.id,
          organizationId: role.organizationId,
          userProfileId: userProfile.id
        }
      });

      await db.adminKey.update({
        where: {
          id: adminKey.id
        },
        data: {
          usageCount: {
            increment: 1
          }
        }
      });

      return {
        userAccount,
        userProfile
      };
    });

    const emailResult = await sendWorkIdEmail(payload.email, payload.first_name, workId, role.name);

    await writeAuditLog({
      action: 'REGISTRATION_SUCCESS',
      entityId: result.userAccount.id,
      entityType: 'user_account',
      ipAddress: req.ip,
      newValues: {
        email: payload.email,
        roleName: role.name,
        workId
      },
      organizationId: role.organizationId,
      userAgent: req.header('user-agent'),
      userProfileId: result.userProfile.id
    });

    const message = emailResult.sent
      ? `Account created successfully! Your Work ID has been sent to ${payload.email}. Check your inbox and use your Work ID to log in.`
      : `Account created successfully, but we could not send email right now. Your Work ID is ${workId}. Use it to log in.`;

    return res.status(201).json({
      message,
      redirectTo: '/auth/login'
    });
  } catch (error) {
    await writeAuditLog({
      action: 'REGISTRATION_FAILED',
      entityId: 'unknown',
      entityType: 'user_account',
      ipAddress: req.ip,
      newValues: {
        email: typeof req.body?.email === 'string' ? req.body.email : undefined
      },
      organizationId: null,
      userAgent: req.header('user-agent')
    });

    return next(error);
  }
});

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    if (!isDatabaseConfigured) {
      const payload = loginSchema.parse(req.body);
      const account = findLocalUserByWorkId(payload.work_id);
      const genericAuthError = {
        error: 'Invalid Work ID or password'
      };

      if (!account || account.deletedAt) {
        return res.status(401).json(genericAuthError);
      }

      if (!account.isActive) {
        return res.status(401).json({
          error: 'Your account has been deactivated. Contact your administrator.'
        });
      }

      if (account.lockedUntil && account.lockedUntil > new Date()) {
        return res.status(401).json({
          error: 'Too many failed attempts. Your account is locked for 30 minutes.'
        });
      }

      const isPasswordValid = await bcrypt.compare(payload.password, account.passwordHash);
      if (!isPasswordValid) {
        account.failedLoginAttempts += 1;
        if (account.failedLoginAttempts >= 5) {
          account.failedLoginAttempts = 0;
          account.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        return res.status(401).json(genericAuthError);
      }

      account.failedLoginAttempts = 0;
      account.lockedUntil = null;
      account.lastLogin = new Date();

      const sessionId = createSessionToken();
      const token = signAuthToken({
        userId: account.id,
        workId: account.workId,
        roleId: account.roleId,
        organizationId: account.organizationId,
        sessionId
      });
      const sessionMaxAgeMs = getSessionMaxAgeMs();
      const expiresAt = new Date(Date.now() + sessionMaxAgeMs);
      createLocalSession(token, account.id, expiresAt);

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: sessionMaxAgeMs,
        path: '/'
      });

      return res.status(200).json(toCurrentUserResponseLocal(account));
    }

    const payload = loginSchema.parse(req.body);
    const account = await prisma.userAccount.findUnique({
      where: {
        workId: payload.work_id
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

    const now = new Date();
    const genericAuthError = {
      error: 'Invalid Work ID or password'
    };

    if (!account || account.deletedAt) {
      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entityId: payload.work_id,
        entityType: 'user_account',
        ipAddress: req.ip,
        newValues: {
          reason: 'NOT_FOUND',
          workId: payload.work_id
        },
        organizationId: null,
        userAgent: req.header('user-agent')
      });

      return res.status(401).json(genericAuthError);
    }

    if (!account.isActive) {
      return res.status(401).json({
        error: 'Your account has been deactivated. Contact your administrator.'
      });
    }

    if (account.lockedUntil && account.lockedUntil > now) {
      return res.status(401).json({
        error: 'Too many failed attempts. Your account is locked for 30 minutes.'
      });
    }

    const isPasswordValid = await bcrypt.compare(payload.password, account.passwordHash);

    if (!isPasswordValid) {
      const failedAttempts = account.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= 5;

      await prisma.userAccount.update({
        where: {
          id: account.id
        },
        data: {
          failedLoginAttempts: shouldLock ? 0 : failedAttempts,
          lockedUntil: shouldLock ? new Date(now.getTime() + 30 * 60 * 1000) : null
        }
      });

      await writeAuditLog({
        action: 'LOGIN_FAILED',
        entityId: account.id,
        entityType: 'user_account',
        ipAddress: req.ip,
        newValues: {
          reason: 'INVALID_PASSWORD',
          workId: payload.work_id
        },
        organizationId: account.organizationId,
        userAgent: req.header('user-agent'),
        userProfileId: account.userProfile?.id ?? null
      });

      return res.status(401).json(genericAuthError);
    }

    const sessionId = createSessionToken();
    const token = signAuthToken({
      userId: account.id,
      workId: account.workId,
      roleId: account.roleId,
      organizationId: account.organizationId,
      sessionId
    });
    const sessionMaxAgeMs = getSessionMaxAgeMs();
    const expiresAt = new Date(now.getTime() + sessionMaxAgeMs);

    await prisma.$transaction(async (db) => {
      await db.userAccount.update({
        where: {
          id: account.id
        },
        data: {
          failedLoginAttempts: 0,
          lastLogin: now,
          lockedUntil: null
        }
      });

      await db.authSession.create({
        data: {
          id: sessionId,
          userAccountId: account.id,
          token,
          ipAddress: req.ip,
          userAgent: req.header('user-agent'),
          expiresAt
        }
      });
    });

    await writeAuditLog({
      action: 'LOGIN_SUCCESS',
      entityId: account.id,
      entityType: 'user_account',
      ipAddress: req.ip,
      newValues: {
        workId: payload.work_id
      },
      organizationId: account.organizationId,
      userAgent: req.header('user-agent'),
      userProfileId: account.userProfile?.id ?? null
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: sessionMaxAgeMs,
      path: '/'
    });

    return res.status(200).json(toCurrentUserResponse(account));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', authenticateRequest, async (req, res, next) => {
  try {
    const token = getRequestToken(req);

    if (token) {
      if (!isDatabaseConfigured) {
        deleteLocalSession(token);
      } else {
        await prisma.authSession.deleteMany({
          where: {
            token
          }
        });
      }
    }

    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    return res.status(200).json({
      ok: true
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', authenticateRequest, (req, res) => {
  return res.status(200).json(req.authContext);
});
