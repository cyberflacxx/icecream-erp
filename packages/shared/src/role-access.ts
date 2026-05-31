export const scopedReportTypes = [
  'branch_sales',
  'branch_shift_close_summary',
  'daily_production',
  'expiry_alert',
  'inventory_valuation',
  'low_stock',
  'raw_material_usage',
  'supplier_purchase',
  'wastage',
  'worker_productivity'
] as const;

export type ScopedReportType = (typeof scopedReportTypes)[number];

export type ScopedRoleKey =
  | 'super_admin'
  | 'procurement_officer'
  | 'store_keeper'
  | 'production_manager'
  | 'production_worker'
  | 'sales_representative'
  | 'branch_manager'
  | 'accountant'
  | 'auditor'
  | 'unknown';

export type DashboardRoleBucket =
  | 'system_admin'
  | 'production_manager'
  | 'branch_manager'
  | 'operations_specialist';

export type OperationsFocus = 'procurement' | 'inventory' | 'finance' | 'audit' | 'general';

const rolePriority: ScopedRoleKey[] = [
  'super_admin',
  'branch_manager',
  'sales_representative',
  'production_manager',
  'production_worker',
  'procurement_officer',
  'store_keeper',
  'accountant',
  'auditor'
];

const reportsByRole: Record<ScopedRoleKey, ScopedReportType[]> = {
  super_admin: [...scopedReportTypes],
  procurement_officer: [
    'supplier_purchase',
    'raw_material_usage',
    'inventory_valuation',
    'low_stock',
    'expiry_alert'
  ],
  store_keeper: [
    'raw_material_usage',
    'inventory_valuation',
    'low_stock',
    'expiry_alert',
    'branch_shift_close_summary'
  ],
  production_manager: [
    'daily_production',
    'wastage',
    'raw_material_usage',
    'worker_productivity',
    'low_stock'
  ],
  production_worker: ['daily_production', 'wastage', 'worker_productivity'],
  sales_representative: ['branch_sales', 'branch_shift_close_summary'],
  branch_manager: [
    'branch_sales',
    'branch_shift_close_summary',
    'inventory_valuation',
    'low_stock',
    'expiry_alert'
  ],
  accountant: ['branch_sales', 'branch_shift_close_summary', 'inventory_valuation', 'supplier_purchase'],
  auditor: [
    'daily_production',
    'wastage',
    'branch_sales',
    'inventory_valuation',
    'low_stock',
    'expiry_alert',
    'supplier_purchase',
    'worker_productivity',
    'branch_shift_close_summary'
  ],
  unknown: []
};

function normalizeRoleName(roleName: string): ScopedRoleKey {
  const name = roleName.trim().toLowerCase();

  if (name.includes('super admin') || name === 'admin') {
    return 'super_admin';
  }
  if (name.includes('procurement')) {
    return 'procurement_officer';
  }
  if (name.includes('store keeper') || name.includes('storekeeper')) {
    return 'store_keeper';
  }
  if (name.includes('production manager')) {
    return 'production_manager';
  }
  if (name.includes('production worker')) {
    return 'production_worker';
  }
  if (name.includes('sales representative') || name.includes('sales rep')) {
    return 'sales_representative';
  }
  if (name.includes('branch manager')) {
    return 'branch_manager';
  }
  if (name.includes('accountant')) {
    return 'accountant';
  }
  if (name.includes('auditor')) {
    return 'auditor';
  }

  return 'unknown';
}

export function resolveScopedRoles(roleNames: string[]): ScopedRoleKey[] {
  const normalized = roleNames.map(normalizeRoleName).filter((value): value is ScopedRoleKey => Boolean(value));

  return Array.from(new Set(normalized));
}

export function resolvePrimaryScopedRole(roleNames: string[]): ScopedRoleKey {
  const normalized = resolveScopedRoles(roleNames);

  for (const role of rolePriority) {
    if (normalized.includes(role)) {
      return role;
    }
  }

  return 'unknown';
}

export function getAllowedReportTypesForRoles(roleNames: string[]): ScopedReportType[] {
  const scopedRoles = resolveScopedRoles(roleNames);

  if (scopedRoles.length === 0) {
    return [];
  }

  const allowed = new Set<ScopedReportType>();
  for (const role of scopedRoles) {
    const roleReports = reportsByRole[role] ?? [];
    for (const reportType of roleReports) {
      allowed.add(reportType);
    }
  }

  return scopedReportTypes.filter((type) => allowed.has(type));
}

export function resolveDashboardRoleBucket(roleNames: string[]): DashboardRoleBucket {
  const primary = resolvePrimaryScopedRole(roleNames);

  if (primary === 'super_admin') {
    return 'system_admin';
  }

  if (primary === 'production_manager' || primary === 'production_worker') {
    return 'production_manager';
  }

  if (primary === 'branch_manager' || primary === 'sales_representative') {
    return 'branch_manager';
  }

  return 'operations_specialist';
}

export function resolveOperationsFocus(roleNames: string[]): OperationsFocus {
  const primary = resolvePrimaryScopedRole(roleNames);

  if (primary === 'procurement_officer') {
    return 'procurement';
  }

  if (primary === 'store_keeper') {
    return 'inventory';
  }

  if (primary === 'accountant') {
    return 'finance';
  }

  if (primary === 'auditor') {
    return 'audit';
  }

  return 'general';
}
