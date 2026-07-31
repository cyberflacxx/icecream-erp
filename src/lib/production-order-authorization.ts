export const PRODUCTION_BRANCH_NOT_AVAILABLE = 'Selected branch is not available.';
export const PRODUCTION_ORDER_NOT_FOUND = 'Production order not found.';

export interface ProductionAuthorizationContext {
  branchAssignments: string[];
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  permissions: string[];
}

export interface ProductionOrderAuthorizationRecord {
  branchId: string | null;
  id: string;
  isLocked: boolean;
  organizationId: string;
  status: string | null;
}

export interface ProductionBranchAuthorizationRecord {
  id: string;
  organizationId: string;
  status: string | null;
}

export type ProductionAuthorizationFailure = {
  message: string;
  ok: false;
  status: 400 | 403 | 404;
};

export type ProductionAuthorizationSuccess<T> = {
  ok: true;
  value: T;
};

export type ProductionAuthorizationResult<T> =
  | ProductionAuthorizationFailure
  | ProductionAuthorizationSuccess<T>;

function authorizationFailure(status: 400 | 403 | 404, message: string): ProductionAuthorizationFailure {
  return { message, ok: false, status };
}

function authorizationSuccess<T>(value: T): ProductionAuthorizationSuccess<T> {
  return { ok: true, value };
}

function normalizeBranchStatus(status: string | null | undefined) {
  return String(status ?? 'ACTIVE').toUpperCase();
}

export function isProductionBranchAvailable(branch: ProductionBranchAuthorizationRecord | null | undefined) {
  if (!branch) return false;
  return normalizeBranchStatus(branch.status) === 'ACTIVE';
}

export function authorizeProductionOrderForWrite(
  ctx: ProductionAuthorizationContext,
  order: ProductionOrderAuthorizationRecord | null | undefined,
): ProductionAuthorizationResult<ProductionOrderAuthorizationRecord> {
  if (!order || order.organizationId !== ctx.organizationId) {
    return authorizationFailure(404, PRODUCTION_ORDER_NOT_FOUND);
  }

  if (!ctx.isBranchScoped) {
    return authorizationSuccess(order);
  }

  if (!ctx.branchId || !order.branchId || order.branchId !== ctx.branchId) {
    return authorizationFailure(403, 'Forbidden');
  }

  return authorizationSuccess(order);
}

export function resolveProductionCreateBranchAuthorization(
  ctx: ProductionAuthorizationContext,
  requestedBranchId: string | null | undefined,
  branch: ProductionBranchAuthorizationRecord | null | undefined,
): ProductionAuthorizationResult<{ branchId: string | null }> {
  if (ctx.isBranchScoped) {
    if (!ctx.branchId) return authorizationFailure(403, 'Forbidden');
    return authorizationSuccess({ branchId: ctx.branchId });
  }

  if (!requestedBranchId) {
    return authorizationSuccess({ branchId: null });
  }

  if (!branch || !isProductionBranchAvailable(branch) || branch.organizationId !== ctx.organizationId) {
    return authorizationFailure(400, PRODUCTION_BRANCH_NOT_AVAILABLE);
  }

  return authorizationSuccess({ branchId: branch.id });
}

export function resolveProductionUpdateBranchAuthorization(input: {
  branch: ProductionBranchAuthorizationRecord | null | undefined;
  ctx: ProductionAuthorizationContext;
  order: ProductionOrderAuthorizationRecord;
  requestedBranchId: string | null | undefined;
}): ProductionAuthorizationResult<{ branchId: string | null; order: ProductionOrderAuthorizationRecord }> {
  const orderAuthorization = authorizeProductionOrderForWrite(input.ctx, input.order);
  if (!orderAuthorization.ok) {
    const failure = orderAuthorization as ProductionAuthorizationFailure;
    return authorizationFailure(failure.status, failure.message);
  }

  if (input.ctx.isBranchScoped) {
    if (input.requestedBranchId && input.requestedBranchId !== input.order.branchId) {
      return authorizationFailure(403, 'Forbidden');
    }

    return authorizationSuccess({
      branchId: input.order.branchId,
      order: input.order,
    });
  }

  if (!input.requestedBranchId) {
    return authorizationSuccess({
      branchId: input.order.branchId,
      order: input.order,
    });
  }

  if (!input.branch || !isProductionBranchAvailable(input.branch) || input.branch.organizationId !== input.ctx.organizationId) {
    return authorizationFailure(400, PRODUCTION_BRANCH_NOT_AVAILABLE);
  }

  return authorizationSuccess({
    branchId: input.branch.id,
    order: input.order,
  });
}
