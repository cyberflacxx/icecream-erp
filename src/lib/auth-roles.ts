export const ROLES = [
  { id: 'super_admin', name: 'Super Admin', description: 'Full system access' },
  { id: 'branch_manager', name: 'Branch Manager', description: 'Manage a single branch' },
  { id: 'manager', name: 'Manager', description: 'Operations management' },
  { id: 'staff', name: 'Staff', description: 'Standard staff access' },
] as const;

export type UserRole = (typeof ROLES)[number]['id'];

const ALL_PERMISSIONS = [
  'users.read', 'users.write', 'users.delete',
  'branches.read', 'branches.write',
  'inventory.read', 'inventory.write', 'inventory.delete',
  'procurement.read', 'procurement.write', 'procurement.approve',
  'procurement.supplier.view', 'procurement.supplier.write',
  'production.read', 'production.write',
  'sales.read', 'sales.write',
  'finance.read', 'finance.write',
  'reports.read',
  'settings.read', 'settings.write',
  'hr.read', 'hr.write',
  'quality.read', 'quality.write',
  'maintenance.read', 'maintenance.write',
  'cost-accounting.read', 'cost-accounting.write',
  'budget.read', 'budget.write',
];

const BRANCH_MANAGER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith('settings') && !p.startsWith('users.delete')
);

const MANAGER_PERMISSIONS = [
  'inventory.read', 'inventory.write',
  'procurement.read', 'procurement.write', 'procurement.supplier.view',
  'production.read', 'production.write',
  'sales.read', 'sales.write',
  'finance.read',
  'reports.read',
  'quality.read', 'quality.write',
  'maintenance.read',
  'hr.read',
];

const STAFF_PERMISSIONS = [
  'inventory.read',
  'production.read',
  'sales.read',
  'reports.read',
  'quality.read',
  'hr.read',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS,
  branch_manager: BRANCH_MANAGER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
};

/** Synthetic email used in Supabase Auth for Work ID login. */
export function workIdToEmail(workId: string) {
  return `${workId.toLowerCase()}@ice.erp`;
}

/** Generate a Work ID for the current year, given the last sequence number used. */
export function generateWorkId(lastSeq: number) {
  const year = new Date().getFullYear();
  return `AQI-${year}${String(lastSeq + 1).padStart(4, '0')}`;
}
