import { randomUUID } from 'crypto';

import { PERMISSION_CODES } from '@absolute-ice-cream/shared';
import bcrypt from 'bcryptjs';

export const allowedRoles = [
  'Super Admin',
  'Procurement Officer',
  'Store Keeper',
  'Production Manager',
  'Production Worker',
  'Sales Representative',
  'Branch Manager',
  'Accountant',
  'Auditor'
] as const;

export const fallbackRoles: Array<{ id: string; name: (typeof allowedRoles)[number] }> = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Super Admin' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Procurement Officer' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Store Keeper' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Production Manager' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'Production Worker' },
  { id: '66666666-6666-4666-8666-666666666666', name: 'Sales Representative' },
  { id: '77777777-7777-4777-8777-777777777777', name: 'Branch Manager' },
  { id: '88888888-8888-4888-8888-888888888888', name: 'Accountant' },
  { id: '99999999-9999-4999-8999-999999999999', name: 'Auditor' }
];

interface LocalUserAccount {
  id: string;
  createdAt: Date;
  deletedAt: Date | null;
  email: string;
  failedLoginAttempts: number;
  firstName: string;
  idNumber: string;
  isActive: boolean;
  lastLogin: Date | null;
  lastName: string;
  lockedUntil: Date | null;
  organizationId: string;
  passwordHash: string;
  roleId: string;
  roleName: (typeof allowedRoles)[number];
  workId: string;
}

interface LocalSession {
  expiresAt: Date;
  token: string;
  userId: string;
}

const localUsers: LocalUserAccount[] = [];
const localSessions: LocalSession[] = [];
const localSeedPassword = 'Demo@2026!';

const localSeedAccounts: Array<{
  email: string;
  firstName: string;
  idNumber: string;
  lastName: string;
  roleName: (typeof allowedRoles)[number];
  workId: string;
}> = [
  {
    workId: 'AQI-20261001',
    firstName: 'System',
    lastName: 'Owner',
    email: 'sample.superadmin@absoluteicecream.co.zw',
    idNumber: '63-610001-A01',
    roleName: 'Super Admin'
  },
  {
    workId: 'AQI-20261002',
    firstName: 'Patience',
    lastName: 'Buyer',
    email: 'sample.procurement@absoluteicecream.co.zw',
    idNumber: '63-610002-A02',
    roleName: 'Procurement Officer'
  },
  {
    workId: 'AQI-20261003',
    firstName: 'Tawanda',
    lastName: 'Store',
    email: 'sample.storekeeper@absoluteicecream.co.zw',
    idNumber: '63-610003-A03',
    roleName: 'Store Keeper'
  },
  {
    workId: 'AQI-20261004',
    firstName: 'Nyasha',
    lastName: 'Plant',
    email: 'sample.productionmanager@absoluteicecream.co.zw',
    idNumber: '63-610004-A04',
    roleName: 'Production Manager'
  },
  {
    workId: 'AQI-20261005',
    firstName: 'Tino',
    lastName: 'Operator',
    email: 'sample.productionworker@absoluteicecream.co.zw',
    idNumber: '63-610005-A05',
    roleName: 'Production Worker'
  },
  {
    workId: 'AQI-20261006',
    firstName: 'Rudo',
    lastName: 'Sales',
    email: 'sample.salesrep@absoluteicecream.co.zw',
    idNumber: '63-610006-A06',
    roleName: 'Sales Representative'
  },
  {
    workId: 'AQI-20261007',
    firstName: 'Tapiwa',
    lastName: 'Branch',
    email: 'sample.branchmanager@absoluteicecream.co.zw',
    idNumber: '63-610007-A07',
    roleName: 'Branch Manager'
  },
  {
    workId: 'AQI-20261008',
    firstName: 'Farai',
    lastName: 'Books',
    email: 'sample.accountant@absoluteicecream.co.zw',
    idNumber: '63-610008-A08',
    roleName: 'Accountant'
  },
  {
    workId: 'AQI-20261009',
    firstName: 'Munya',
    lastName: 'Audit',
    email: 'sample.auditor@absoluteicecream.co.zw',
    idNumber: '63-610009-A09',
    roleName: 'Auditor'
  }
];

const rolePermissionMap: Record<(typeof allowedRoles)[number], string[]> = {
  'Super Admin': Object.values(PERMISSION_CODES),
  'Procurement Officer': [
    'dashboard.read',
    'supplier.read',
    'supplier.create',
    'supplier.update',
    'purchase_order.read',
    'purchase_order.create',
    'purchase_order.approve',
    'inventory.read',
    'reports.read'
  ],
  'Store Keeper': [
    'dashboard.read',
    'inventory.read',
    'inventory.adjust',
    'stock_transfer.create',
    'stock_transfer.approve',
    'reports.read'
  ],
  'Production Manager': [
    'dashboard.read',
    'production_batch.create',
    'production_batch.close',
    'production_batch.read',
    'inventory.read',
    'reports.read'
  ],
  'Production Worker': ['dashboard.read', 'production_batch.read', 'production_batch.update_output'],
  'Sales Representative': [
    'dashboard.read',
    'branch_sales.create',
    'branch_sales.read',
    'customer.read',
    'customer.create',
    'customer.manage',
    'inventory.read'
  ],
  'Branch Manager': [
    'dashboard.read',
    'branch_sales.create',
    'branch_sales.read',
    'branch_shift.close',
    'branch_shift.read',
    'inventory.read',
    'reports.read',
    'branch_expense.create'
  ],
  Accountant: [
    'dashboard.read',
    'finance.read',
    'finance.manage',
    'reports.read',
    'branch_shift.approve',
    'invoice.read',
    'payment.read'
  ],
  Auditor: ['dashboard.read', 'reports.read', 'audit_log.read', 'inventory.read', 'finance.read']
};

export function getFallbackRoleById(roleId: string) {
  return fallbackRoles.find((role) => role.id === roleId) ?? null;
}

export function getFallbackPermissionsByRoleName(roleName: (typeof allowedRoles)[number]) {
  return rolePermissionMap[roleName] ?? [];
}

export function createLocalUserAccount(input: {
  email: string;
  firstName: string;
  idNumber: string;
  organizationId: string;
  passwordHash: string;
  roleId: string;
  roleName: (typeof allowedRoles)[number];
  workId: string;
  lastName: string;
}) {
  const account: LocalUserAccount = {
    id: randomUUID(),
    createdAt: new Date(),
    deletedAt: null,
    email: input.email,
    failedLoginAttempts: 0,
    firstName: input.firstName,
    idNumber: input.idNumber,
    isActive: true,
    lastLogin: null,
    lastName: input.lastName,
    lockedUntil: null,
    organizationId: input.organizationId,
    passwordHash: input.passwordHash,
    roleId: input.roleId,
    roleName: input.roleName,
    workId: input.workId
  };
  localUsers.push(account);
  return account;
}

export function getLocalUsers() {
  return localUsers;
}

export function findLocalUserByWorkId(workId: string) {
  return localUsers.find((account) => account.workId === workId) ?? null;
}

export function findLocalUserById(userId: string) {
  return localUsers.find((account) => account.id === userId) ?? null;
}

export function createLocalSession(token: string, userId: string, expiresAt: Date) {
  localSessions.push({
    token,
    userId,
    expiresAt
  });
}

export function findLocalSession(token: string) {
  return localSessions.find((session) => session.token === token) ?? null;
}

export function deleteLocalSession(token: string) {
  const index = localSessions.findIndex((session) => session.token === token);
  if (index >= 0) {
    localSessions.splice(index, 1);
  }
}

function seedLocalUsers() {
  if (localUsers.length > 0) {
    return;
  }

  const roleByName = new Map(fallbackRoles.map((role) => [role.name, role] as const));
  const passwordHash = bcrypt.hashSync(localSeedPassword, 12);

  for (const seed of localSeedAccounts) {
    const role = roleByName.get(seed.roleName);

    if (!role) {
      continue;
    }

    localUsers.push({
      id: randomUUID(),
      createdAt: new Date(),
      deletedAt: null,
      email: seed.email,
      failedLoginAttempts: 0,
      firstName: seed.firstName,
      idNumber: seed.idNumber,
      isActive: true,
      lastLogin: null,
      lastName: seed.lastName,
      lockedUntil: null,
      organizationId: 'local-dev-org',
      passwordHash,
      roleId: role.id,
      roleName: role.name,
      workId: seed.workId
    });
  }
}

seedLocalUsers();
