export interface BranchAuthorizationContext {
  branchAssignments: string[];
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  permissions: string[];
  warehouseAssignments?: string[];
}

export interface BranchSelectorRecord {
  code?: string | null;
  defaultWarehouseId?: string | null;
  id: string;
  name?: string | null;
  organizationId: string;
  status?: string | null;
}

export interface WarehouseSelectorRecord {
  branchId: string | null;
  id: string;
  isActive?: boolean | null;
  name?: string | null;
  organizationId: string;
}

export interface BranchAuthorizationFailure {
  message: string;
  ok: false;
  status: 400 | 403;
}

export interface BranchAuthorizationSuccess {
  branchId: string | null;
  ok: true;
}

export type BranchAuthorizationResult =
  | BranchAuthorizationFailure
  | BranchAuthorizationSuccess;

export function normalizeBranchStatus(status: string | null | undefined) {
  return String(status ?? 'ACTIVE').trim().toUpperCase();
}

export function hasGlobalBranchAccess(ctx: Pick<BranchAuthorizationContext, 'permissions'>) {
  return ctx.permissions.includes('view_all_branches') || ctx.permissions.includes('settings.manage');
}

export function getAuthorizedBranchIds(
  ctx: Pick<BranchAuthorizationContext, 'branchAssignments' | 'branchId'>,
) {
  return [...new Set([ctx.branchId, ...ctx.branchAssignments].filter(Boolean).map(String))];
}

export function getAuthorizedWarehouseIds(
  ctx: Pick<BranchAuthorizationContext, 'warehouseAssignments'>,
) {
  return [...new Set((ctx.warehouseAssignments ?? []).filter(Boolean).map(String))];
}

export function isBranchAvailableToContext(
  ctx: BranchAuthorizationContext,
  branch: BranchSelectorRecord | null | undefined,
  options: { includeInactive?: boolean } = {},
) {
  if (!branch || branch.organizationId !== ctx.organizationId) return false;
  if (!options.includeInactive && normalizeBranchStatus(branch.status) !== 'ACTIVE') return false;

  if (hasGlobalBranchAccess(ctx) || !ctx.isBranchScoped) {
    return true;
  }

  const authorizedIds = new Set(getAuthorizedBranchIds(ctx));
  return authorizedIds.has(branch.id);
}

export function filterAuthorizedBranches(
  ctx: BranchAuthorizationContext,
  branches: BranchSelectorRecord[],
  options: { includeInactive?: boolean } = {},
) {
  return branches.filter((branch) => isBranchAvailableToContext(ctx, branch, options));
}

export function isWarehouseAvailableToContext(
  ctx: BranchAuthorizationContext,
  warehouse: WarehouseSelectorRecord | null | undefined,
  options: { includeInactive?: boolean } = {},
) {
  if (!warehouse || warehouse.organizationId !== ctx.organizationId) return false;
  if (!options.includeInactive && warehouse.isActive === false) return false;

  if (hasGlobalBranchAccess(ctx) || !ctx.isBranchScoped) {
    return true;
  }

  const authorizedWarehouseIds = new Set(getAuthorizedWarehouseIds(ctx));
  if (authorizedWarehouseIds.has(warehouse.id)) {
    return true;
  }

  if (!warehouse.branchId) {
    return false;
  }

  const authorizedBranchIds = new Set(getAuthorizedBranchIds(ctx));
  return authorizedBranchIds.has(warehouse.branchId);
}

export function filterAuthorizedWarehouses(
  ctx: BranchAuthorizationContext,
  warehouses: WarehouseSelectorRecord[],
  options: { includeInactive?: boolean } = {},
) {
  return warehouses.filter((warehouse) => isWarehouseAvailableToContext(ctx, warehouse, options));
}

export function resolveRequestedBranchId(
  ctx: BranchAuthorizationContext,
  requestedBranchId: string | null | undefined,
  branches: BranchSelectorRecord[] = [],
  options: { includeInactive?: boolean } = {},
): BranchAuthorizationResult {
  const normalizedRequestedBranchId = requestedBranchId ? String(requestedBranchId) : null;
  const authorizedBranches = filterAuthorizedBranches(ctx, branches, options);
  const authorizedIds = authorizedBranches.map((branch) => branch.id);

  if (ctx.isBranchScoped) {
    if (authorizedIds.length === 0) {
      return {
        message: 'No branch assignment is available for this user.',
        ok: false,
        status: 403,
      };
    }

    if (!normalizedRequestedBranchId && authorizedIds.length === 1) {
      return { branchId: authorizedIds[0] ?? null, ok: true };
    }

    if (!normalizedRequestedBranchId) {
      return {
        message: 'branchId is required for this user.',
        ok: false,
        status: 400,
      };
    }

    if (!authorizedIds.includes(normalizedRequestedBranchId)) {
      return {
        message: 'This role is limited to its assigned branch.',
        ok: false,
        status: 403,
      };
    }

    return { branchId: normalizedRequestedBranchId, ok: true };
  }

  if (!normalizedRequestedBranchId) {
    return { branchId: null, ok: true };
  }

  if (!authorizedIds.includes(normalizedRequestedBranchId)) {
    return {
      message: 'Selected branch is not available.',
      ok: false,
      status: 400,
    };
  }

  return { branchId: normalizedRequestedBranchId, ok: true };
}

export function getDefaultAuthorizedBranchId(
  ctx: BranchAuthorizationContext,
  branches: BranchSelectorRecord[],
  options: { includeInactive?: boolean } = {},
) {
  const authorizedBranches = filterAuthorizedBranches(ctx, branches, options);
  return authorizedBranches.length === 1 ? authorizedBranches[0]?.id ?? null : null;
}
