import { randomUUID } from 'crypto';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import type {
  AuditLogsQuery,
  InviteUserInput,
  RolesQuery,
  UpdateSettingsOverviewInput,
  UsersQuery
} from './settings.schemas';

interface SettingsContext {
  organizationId: string;
  userProfileId: string;
}

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const DEFAULT_NUMBER_SERIES = {
  grnPrefix: 'GRN',
  invoicePrefix: 'INV',
  paymentPrefix: 'PAY',
  poPrefix: 'PO',
  requisitionPrefix: 'REQ',
  salesOrderPrefix: 'SO'
};

interface LocalCompanyProfile {
  address: string | null;
  currency: string;
  email: string | null;
  logoUrl: string | null;
  name: string;
  phone: string | null;
  taxNumber: string | null;
}

interface LocalSettingsOverview {
  companyProfile: LocalCompanyProfile;
  notificationSettings: typeof DEFAULT_NOTIFICATION_SETTINGS;
  numberSeries: typeof DEFAULT_NUMBER_SERIES;
}

const DEFAULT_COMPANY_PROFILE: LocalCompanyProfile = {
  address: null,
  currency: 'USD',
  email: null,
  logoUrl: null,
  name: 'Absolute Quality Icecream',
  phone: null,
  taxNumber: null
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  expiryAlert: true,
  lowStock: true,
  paymentReceived: true,
  productionBatchReady: true,
  purchaseOrderApproved: true,
  shiftCloseSubmitted: true
};

const LOCAL_PERMISSION_GROUPS: Record<string, Array<{ code: string; id: string; name: string }>> = {
  FINANCE: [
    {
      code: 'finance.view',
      id: '64000000-0000-0000-0000-000000000001',
      name: 'View finance'
    },
    {
      code: 'finance.manage',
      id: '64000000-0000-0000-0000-000000000002',
      name: 'Manage finance'
    }
  ],
  PRODUCTION: [
    {
      code: 'production.view',
      id: '64000000-0000-0000-0000-000000000003',
      name: 'View production'
    },
    {
      code: 'production.manage',
      id: '64000000-0000-0000-0000-000000000004',
      name: 'Manage production'
    }
  ],
  SETTINGS: [
    {
      code: 'settings.view',
      id: '64000000-0000-0000-0000-000000000005',
      name: 'View settings'
    },
    {
      code: 'settings.manage',
      id: '64000000-0000-0000-0000-000000000006',
      name: 'Manage settings'
    }
  ]
};

let localSettingsOverview: LocalSettingsOverview = {
  companyProfile: { ...DEFAULT_COMPANY_PROFILE },
  notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
  numberSeries: { ...DEFAULT_NUMBER_SERIES }
};

function getLocalSettingsOverview() {
  return {
    companyProfile: { ...localSettingsOverview.companyProfile },
    notificationSettings: { ...localSettingsOverview.notificationSettings },
    numberSeries: { ...localSettingsOverview.numberSeries }
  };
}

function createPaginationResult<T>(data: T[], page: number, pageSize: number) {
  const total = data.length;
  const start = (page - 1) * pageSize;

  return {
    data: data.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total
    }
  };
}

function toDate(date?: string | null) {
  if (!date) {
    return undefined;
  }

  return new Date(`${date}T00:00:00.000Z`);
}

function toCsv(data: Array<Record<string, unknown>>) {
  if (!data.length) {
    return 'No data';
  }

  const headers = Object.keys(data[0] ?? {});
  const lines = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((key) => {
          const value = row[key];

          if (value === null || value === undefined) {
            return '';
          }

          const text = String(value).replace(/"/g, '""');

          return `"${text}"`;
        })
        .join(','),
    )
  ];

  return lines.join('\n');
}

function decimalToNumber(value: Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

async function getSettingsBlob<T extends Record<string, unknown>>(
  context: SettingsContext,
  referenceType: string,
  defaults: T,
) {
  if (!isDatabaseConfigured) {
    return defaults;
  }

  const record = await prisma.documentFile.findFirst({
    where: {
      organizationId: context.organizationId,
      referenceId: context.organizationId,
      referenceType
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!record || !record.fileUrl.startsWith('json://')) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(record.fileUrl.replace('json://', ''))) as T;

    return {
      ...defaults,
      ...parsed
    };
  } catch {
    return defaults;
  }
}

async function saveSettingsBlob(
  context: SettingsContext,
  referenceType: string,
  payload: Record<string, unknown>,
) {
  if (!isDatabaseConfigured) {
    return;
  }

  const content = JSON.stringify(payload);
  const fileUrl = `json://${encodeURIComponent(content)}`;
  const existing = await prisma.documentFile.findFirst({
    where: {
      organizationId: context.organizationId,
      referenceId: context.organizationId,
      referenceType
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (existing) {
    await prisma.documentFile.update({
      where: {
        id: existing.id
      },
      data: {
        fileSize: Buffer.byteLength(content, 'utf8'),
        fileType: 'application/json',
        fileUrl,
        uploadedBy: context.userProfileId
      }
    });

    return;
  }

  await prisma.documentFile.create({
    data: {
      fileName: `${referenceType}.json`,
      fileSize: Buffer.byteLength(content, 'utf8'),
      fileType: 'application/json',
      fileUrl,
      organizationId: context.organizationId,
      referenceId: context.organizationId,
      referenceType,
      uploadedBy: context.userProfileId
    }
  });
}

export class SettingsService {
  static async getSettingsOverview(context: SettingsContext) {
    if (!isDatabaseConfigured) {
      void context;
      return getLocalSettingsOverview();
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: context.organizationId
      }
    });

    if (!organization) {
      throw new Error('Organization not found.');
    }

    const [numberSeries, notificationSettings] = await Promise.all([
      getSettingsBlob(context, 'number_series', DEFAULT_NUMBER_SERIES),
      getSettingsBlob(context, 'notification_settings', DEFAULT_NOTIFICATION_SETTINGS)
    ]);

    return {
      companyProfile: {
        address: organization.address,
        currency: organization.currency,
        email: organization.email,
        logoUrl: organization.logoUrl,
        name: organization.name,
        phone: organization.phone,
        taxNumber: organization.taxNumber
      },
      notificationSettings,
      numberSeries
    };
  }

  static async updateSettingsOverview(context: SettingsContext, input: UpdateSettingsOverviewInput) {
    if (!isDatabaseConfigured) {
      void context;
      localSettingsOverview = {
        companyProfile: {
          ...localSettingsOverview.companyProfile,
          ...(input.companyProfile ?? {})
        },
        notificationSettings: {
          ...localSettingsOverview.notificationSettings,
          ...(input.notificationSettings ?? {})
        },
        numberSeries: {
          ...localSettingsOverview.numberSeries,
          ...(input.numberSeries ?? {})
        }
      };

      return getLocalSettingsOverview();
    }

    if (input.companyProfile) {
      await prisma.organization.update({
        where: {
          id: context.organizationId
        },
        data: {
          address: input.companyProfile.address,
          currency: input.companyProfile.currency,
          email: input.companyProfile.email,
          logoUrl: input.companyProfile.logoUrl,
          name: input.companyProfile.name,
          phone: input.companyProfile.phone,
          taxNumber: input.companyProfile.taxNumber
        }
      });
    }

    if (input.numberSeries) {
      await saveSettingsBlob(context, 'number_series', input.numberSeries);
    }

    if (input.notificationSettings) {
      await saveSettingsBlob(context, 'notification_settings', input.notificationSettings);
    }

    return this.getSettingsOverview(context);
  }

  static async listUsers(context: SettingsContext, query: UsersQuery) {
    if (!isDatabaseConfigured) {
      void context;
      return createPaginationResult([], query.page, query.pageSize);
    }

    const users = await prisma.userProfile.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        status: query.status,
        OR: query.search
          ? [
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                email: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        branch: true,
        roleAssignments: {
          include: {
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = users.map((user) => ({
      id: user.id,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name
          }
        : null,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      roles: user.roleAssignments.map((assignment) => ({
        id: assignment.role.id,
        name: assignment.role.name
      })),
      status: user.status
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async getUser(context: SettingsContext, userId: string) {
    if (!isDatabaseConfigured) {
      void context;
      return {
        id: userId,
        branch: null,
        email: 'local@example.com',
        fullName: 'Local User',
        roles: [],
        status: 'ACTIVE'
      };
    }

    const user = await prisma.userProfile.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        organizationId: context.organizationId
      },
      include: {
        branch: true,
        roleAssignments: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return {
      id: user.id,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name
          }
        : null,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      roles: user.roleAssignments.map((assignment) => ({
        id: assignment.role.id,
        name: assignment.role.name
      })),
      status: user.status
    };
  }

  static async inviteUser(
    context: SettingsContext,
    input: InviteUserInput,
  ): Promise<{ email: string; id: string; status: string }> {
    if (!isDatabaseConfigured) {
      void context;
      return {
        email: input.email.toLowerCase(),
        id: randomUUID(),
        status: 'PENDING'
      };
    }

    const existing = await prisma.userProfile.findFirst({
      where: {
        email: input.email.toLowerCase(),
        organizationId: context.organizationId
      }
    });

    if (existing) {
      throw new Error('A user profile with this email already exists.');
    }

    const invitationId = randomUUID();

    await prisma.auditLog.create({
      data: {
        action: 'USER_INVITED',
        entityId: invitationId,
        entityType: 'user_invitation',
        newValues: {
          branchId: input.branchId ?? null,
          email: input.email,
          roleIds: input.roleIds,
          sendEmail: input.sendEmail
        },
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      }
    });

    return {
      email: input.email.toLowerCase(),
      id: invitationId,
      status: 'PENDING'
    };
  }

  static async assignUserRoles(context: SettingsContext, userId: string, roleIds: string[]) {
    if (!isDatabaseConfigured) {
      void context;
      void userId;
      void roleIds;
      return {
        success: true
      };
    }

    const user = await prisma.userProfile.findFirst({
      where: {
        id: userId,
        organizationId: context.organizationId
      }
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const roles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds
        },
        organizationId: context.organizationId
      }
    });

    if (roles.length !== roleIds.length) {
      throw new Error('One or more role IDs are invalid.');
    }

    await prisma.$transaction(async (db) => {
      await db.userRole.deleteMany({
        where: {
          userProfileId: userId
        }
      });

      if (roleIds.length) {
        await db.userRole.createMany({
          data: roleIds.map((roleId) => ({
            assignedBy: context.userProfileId,
            roleId,
            userProfileId: userId
          }))
        });
      }

      await db.auditLog.create({
        data: {
          action: 'USER_ROLES_UPDATED',
          entityId: userId,
          entityType: 'user_profile',
          newValues: {
            roleIds
          },
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });
    });

    return {
      success: true
    };
  }

  static async updateUserStatus(context: SettingsContext, userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    if (!isDatabaseConfigured) {
      void context;
      return {
        id: userId,
        status
      };
    }

    const user = await prisma.userProfile.findFirst({
      where: {
        id: userId,
        organizationId: context.organizationId
      }
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const updated = await prisma.userProfile.update({
      where: {
        id: userId
      },
      data: {
        status
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_STATUS_UPDATED',
        entityId: userId,
        entityType: 'user_profile',
        newValues: {
          status
        },
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      }
    });

    return {
      id: updated.id,
      status: updated.status
    };
  }

  static async listRoles(context: SettingsContext, query: RolesQuery) {
    if (!isDatabaseConfigured) {
      void context;
      return createPaginationResult([], query.page, query.pageSize);
    }

    const roles = await prisma.role.findMany({
      where: {
        organizationId: context.organizationId,
        name: query.search
          ? {
              contains: query.search,
              mode: 'insensitive'
            }
          : undefined
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const mapped = roles.map((role) => ({
      description: role.description,
      id: role.id,
      isSystemRole: role.isSystemRole,
      name: role.name,
      permissions: role.permissions.map((item) => ({
        code: item.permission.code,
        id: item.permission.id,
        module: item.permission.module
      })),
      userCount: role.users.length
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async getRole(context: SettingsContext, roleId: string) {
    if (!isDatabaseConfigured) {
      void context;
      return {
        id: roleId,
        name: 'Role',
        description: null,
        isSystemRole: false,
        permissions: [],
        userCount: 0
      };
    }

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId: context.organizationId
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: true
      }
    });

    if (!role) {
      throw new Error('Role not found.');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystemRole: role.isSystemRole,
      permissions: role.permissions.map((item) => ({
        id: item.permission.id,
        code: item.permission.code,
        module: item.permission.module
      })),
      userCount: role.users.length
    };
  }

  static async createRole(context: SettingsContext, input: { name: string; description?: string | null }) {
    if (!isDatabaseConfigured) {
      return {
        description: input.description ?? null,
        id: randomUUID(),
        isSystemRole: false,
        name: input.name,
        organizationId: context.organizationId
      };
    }

    const role = await prisma.role.create({
      data: {
        description: input.description ?? null,
        isSystemRole: false,
        name: input.name,
        organizationId: context.organizationId
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'ROLE_CREATED',
        entityId: role.id,
        entityType: 'role',
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      }
    });

    return role;
  }

  static async updateRole(
    context: SettingsContext,
    roleId: string,
    input: { name?: string; description?: string | null },
  ) {
    if (!isDatabaseConfigured) {
      void context;
      return {
        description: input.description ?? null,
        id: roleId,
        isSystemRole: false,
        name: input.name ?? 'Role'
      };
    }

    const existing = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId: context.organizationId
      }
    });

    if (!existing) {
      throw new Error('Role not found.');
    }

    const updated = await prisma.role.update({
      where: {
        id: roleId
      },
      data: {
        description: input.description,
        name: input.name
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'ROLE_UPDATED',
        entityId: roleId,
        entityType: 'role',
        organizationId: context.organizationId,
        userProfileId: context.userProfileId
      }
    });

    return updated;
  }

  static async assignRolePermissions(context: SettingsContext, roleId: string, permissionIds: string[]) {
    if (!isDatabaseConfigured) {
      void context;
      void roleId;
      void permissionIds;
      return {
        success: true
      };
    }

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        organizationId: context.organizationId
      }
    });

    if (!role) {
      throw new Error('Role not found.');
    }

    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds
        }
      }
    });

    if (permissions.length !== permissionIds.length) {
      throw new Error('One or more permission IDs are invalid.');
    }

    await prisma.$transaction(async (db) => {
      await db.rolePermission.deleteMany({
        where: {
          roleId
        }
      });

      if (permissionIds.length) {
        await db.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            permissionId,
            roleId
          }))
        });
      }

      await db.auditLog.create({
        data: {
          action: 'ROLE_PERMISSIONS_UPDATED',
          entityId: roleId,
          entityType: 'role',
          newValues: {
            permissionIds
          },
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });
    });

    return {
      success: true
    };
  }

  static async listPermissions(context: SettingsContext) {
    if (!isDatabaseConfigured) {
      void context;
      return LOCAL_PERMISSION_GROUPS;
    }

    void context;
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }]
    });
    const grouped = permissions.reduce<Record<string, Array<{ code: string; id: string; name: string }>>>(
      (acc, permission) => {
        const bucket = acc[permission.module] ?? [];
        bucket.push({
          code: permission.code,
          id: permission.id,
          name: permission.name
        });
        acc[permission.module] = bucket;

        return acc;
      },
      {},
    );

    return grouped;
  }

  static async listAuditLogs(context: SettingsContext, query: AuditLogsQuery) {
    if (!isDatabaseConfigured) {
      void context;
      return createPaginationResult([], query.page, query.pageSize);
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        action: query.action
          ? {
              contains: query.action,
              mode: 'insensitive'
            }
          : undefined,
        createdAt:
          query.startDate || query.endDate
            ? {
                gte: query.startDate ? toDate(query.startDate) : undefined,
                lte: query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : undefined
              }
            : undefined,
        entityType: query.entityType
          ? {
              contains: query.entityType,
              mode: 'insensitive'
            }
          : undefined,
        organizationId: context.organizationId,
        userProfileId: query.userProfileId
      },
      include: {
        userProfile: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = logs.map((log) => ({
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      entityId: log.entityId,
      entityType: log.entityType,
      id: log.id,
      user: log.userProfile
        ? `${log.userProfile.firstName} ${log.userProfile.lastName}`.trim()
        : 'System'
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async exportAuditLogsCsv(context: SettingsContext, query: AuditLogsQuery) {
    const logs = await this.listAuditLogs(context, {
      ...query,
      page: 1,
      pageSize: 10_000
    });
    const csv = toCsv(logs.data as Array<Record<string, unknown>>);

    return {
      content: csv,
      fileName: `audit-logs-${Date.now()}.csv`,
      mimeType: 'text/csv'
    };
  }

  static async getSummaryCounters(context: SettingsContext) {
    if (!isDatabaseConfigured) {
      void context;
      return {
        auditCount: 0,
        lowStockCount: 0,
        roleCount: 0,
        totalInventoryValue: 0,
        unreadCount: 0,
        userCount: 0
      };
    }

    const [userCount, roleCount, auditCount, unreadCount, lowStockCount, totalInventoryValue] = await Promise.all([
      prisma.userProfile.count({
        where: {
          deletedAt: null,
          organizationId: context.organizationId
        }
      }),
      prisma.role.count({
        where: {
          organizationId: context.organizationId
        }
      }),
      prisma.auditLog.count({
        where: {
          organizationId: context.organizationId
        }
      }),
      prisma.notification.count({
        where: {
          isRead: false,
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      }),
      prisma.stockBalance.count({
        where: {
          organizationId: context.organizationId,
          item: {
            reorderLevel: {
              not: null
            }
          }
        }
      }),
      prisma.stockBalance.findMany({
        where: {
          organizationId: context.organizationId
        },
        include: {
          item: true
        }
      }).then((rows) =>
        rows.reduce(
          (sum, row) => sum + decimalToNumber(row.quantityOnHand) * decimalToNumber(row.item.unitCost),
          0,
        ),
      )
    ]);

    return {
      auditCount,
      lowStockCount,
      roleCount,
      totalInventoryValue,
      unreadCount,
      userCount
    };
  }

  static async getNumberSeries(context: SettingsContext) {
    if (!isDatabaseConfigured) {
      void context;
      return { ...localSettingsOverview.numberSeries };
    }

    return getSettingsBlob(context, 'number_series', DEFAULT_NUMBER_SERIES);
  }

  static async updateNumberSeries(
    context: SettingsContext,
    input: typeof DEFAULT_NUMBER_SERIES,
  ) {
    if (!isDatabaseConfigured) {
      void context;
      localSettingsOverview = {
        ...localSettingsOverview,
        numberSeries: {
          ...localSettingsOverview.numberSeries,
          ...input
        }
      };

      return { ...localSettingsOverview.numberSeries };
    }

    await saveSettingsBlob(context, 'number_series', input);
    return getSettingsBlob(context, 'number_series', DEFAULT_NUMBER_SERIES);
  }
}
