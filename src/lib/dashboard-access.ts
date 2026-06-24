export type DashboardPersona =
  | 'system_admin'
  | 'branch_manager'
  | 'operations_manager'
  | 'production_manager'
  | 'sales_lead'
  | 'finance_lead'
  | 'procurement_lead'
  | 'inventory_lead'
  | 'hr_lead'
  | 'quality_lead'
  | 'operations_specialist';

function normalize(values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

export function hasAnyPermission(permissions: readonly string[], required: readonly string[]) {
  return required.some((permission) => permissions.includes(permission));
}

export function isSuperAdminPermissions(permissions: readonly string[]) {
  return hasAnyPermission(permissions, ['manage_roles', 'settings.manage']);
}

export function resolveDashboardPersona(input: {
  permissions: string[];
  role?: string | null;
  roleNames?: string[];
}) {
  const permissions = input.permissions ?? [];
  const roleNames = normalize([input.role, ...(input.roleNames ?? [])]);

  if (
    isSuperAdminPermissions(permissions) ||
    roleNames.some((name) => name.includes('super admin') || name.includes('system admin'))
  ) {
    return 'system_admin' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('branch'))) {
    return 'branch_manager' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('operations'))) {
    return 'operations_manager' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('production'))) {
    return 'production_manager' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('sales'))) {
    return 'sales_lead' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('finance') || name.includes('account'))) {
    return 'finance_lead' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('procurement') || name.includes('purchase'))) {
    return 'procurement_lead' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('inventory') || name.includes('store'))) {
    return 'inventory_lead' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('hr') || name.includes('payroll'))) {
    return 'hr_lead' satisfies DashboardPersona;
  }

  if (roleNames.some((name) => name.includes('quality'))) {
    return 'quality_lead' satisfies DashboardPersona;
  }

  if (permissions.includes('sales.read')) return 'sales_lead';
  if (permissions.includes('finance.read')) return 'finance_lead';
  if (permissions.includes('procurement.read')) return 'procurement_lead';
  if (permissions.includes('inventory.read')) return 'inventory_lead';
  if (permissions.includes('hr.read')) return 'hr_lead';
  if (permissions.includes('quality.read')) return 'quality_lead';
  if (permissions.includes('production.read')) return 'production_manager';

  return 'operations_specialist';
}

export function getDashboardRoleLabel(persona: DashboardPersona) {
  switch (persona) {
    case 'system_admin':
      return 'Super Admin';
    case 'branch_manager':
      return 'Branch Manager';
    case 'operations_manager':
      return 'Operations Manager';
    case 'production_manager':
      return 'Production Manager';
    case 'sales_lead':
      return 'Sales Lead';
    case 'finance_lead':
      return 'Finance Lead';
    case 'procurement_lead':
      return 'Procurement Lead';
    case 'inventory_lead':
      return 'Inventory Lead';
    case 'hr_lead':
      return 'HR Lead';
    case 'quality_lead':
      return 'Quality Lead';
    default:
      return 'Operations Specialist';
  }
}

export function canAccessDashboardPath(persona: DashboardPersona, pathname: string) {
  if (!pathname.startsWith('/')) return true;
  if (pathname === '/dashboard') return true;
  if (persona === 'system_admin') return true;

  const routeGroups: Array<{ match: string; personas: DashboardPersona[] }> = [
    { match: '/sales', personas: ['sales_lead', 'branch_manager', 'operations_manager'] },
    { match: '/branches', personas: ['branch_manager', 'operations_manager'] },
    { match: '/procurement', personas: ['procurement_lead', 'operations_manager'] },
    { match: '/inventory', personas: ['inventory_lead', 'production_manager', 'procurement_lead', 'branch_manager', 'operations_manager'] },
    { match: '/production', personas: ['production_manager', 'quality_lead', 'operations_manager'] },
    { match: '/finance', personas: ['finance_lead'] },
    { match: '/cost-accounting', personas: ['finance_lead'] },
    { match: '/budget', personas: ['finance_lead'] },
    { match: '/hr', personas: ['hr_lead'] },
    { match: '/quality', personas: ['quality_lead', 'production_manager', 'operations_manager'] },
    { match: '/reports', personas: ['sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'production_manager', 'hr_lead', 'quality_lead', 'branch_manager', 'operations_manager', 'operations_specialist'] },
    { match: '/notifications', personas: ['sales_lead', 'finance_lead', 'procurement_lead', 'inventory_lead', 'production_manager', 'hr_lead', 'quality_lead', 'branch_manager', 'operations_manager', 'operations_specialist'] },
    { match: '/settings', personas: [] },
    { match: '/admin', personas: [] },
    { match: '/workflows', personas: [] },
    { match: '/testing', personas: [] },
  ];

  const route = routeGroups.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`));
  if (!route) return true;
  return route.personas.includes(persona);
}
