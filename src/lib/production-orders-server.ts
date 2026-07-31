import type { AuthContext } from '@/lib/api-auth';
import { productionErrorMessage, productionService } from '@/lib/production-server';

export type ProductionRpcResult = {
  code?: string;
  message?: string;
  success: boolean;
  [key: string]: unknown;
};

function userAccountId(ctx: AuthContext) {
  return ctx.userAccountId ?? null;
}

export function mapProductionRpcError(error: unknown) {
  const message = productionErrorMessage(error) || 'Production workflow operation failed.';
  if (message.includes('not found') || message.includes('No active Bill of Materials')) return { message, status: 404 };
  if (message.includes('already') || message.includes('Only ') || message.includes('Cannot ') || message.includes('requires') || message.includes('Insufficient')) {
    return { message, status: 409 };
  }
  return { message, status: 400 };
}

export async function savePlannedProductionOrder(input: {
  branchId: string | null;
  finishedGoodsWarehouseId: string;
  orderId?: string | null;
  plannedDueDate?: string | null;
  plannedQuantity: number;
  plannedStartDate?: string | null;
  priority?: string | null;
  productId: string;
  productionWarehouseId: string;
  remarks?: string | null;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('save_planned_production_order', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_branch_id: input.branchId,
    p_finished_goods_warehouse_id: input.finishedGoodsWarehouseId,
    p_order_id: input.orderId ?? null,
    p_organization_id: ctx.organizationId,
    p_planned_due_date: input.plannedDueDate ?? null,
    p_planned_quantity: input.plannedQuantity,
    p_planned_start_date: input.plannedStartDate ?? null,
    p_priority: input.priority ?? 'NORMAL',
    p_product_id: input.productId,
    p_production_warehouse_id: input.productionWarehouseId,
    p_remarks: input.remarks ?? null,
  });

  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function releaseProductionOrder(input: {
  allowOverRelease?: boolean;
  orderId: string;
  releaseNotes?: string | null;
  releasedQuantity: number;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('release_production_order', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_allow_over_release: input.allowOverRelease ?? false,
    p_order_id: input.orderId,
    p_organization_id: ctx.organizationId,
    p_release_notes: input.releaseNotes ?? null,
    p_released_quantity: input.releasedQuantity,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function postProductionIssue(input: {
  department?: string | null;
  idempotencyKey?: string | null;
  issueDate?: string | null;
  lines: Array<Record<string, unknown>>;
  orderId: string;
  remarks?: string | null;
  shift?: string | null;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('post_production_issue', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_department: input.department ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_issue_date: input.issueDate ?? null,
    p_lines: input.lines,
    p_order_id: input.orderId,
    p_organization_id: ctx.organizationId,
    p_remarks: input.remarks ?? null,
    p_shift: input.shift ?? null,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function postProductionReceipt(input: {
  batchNumber?: string | null;
  completedQuantity: number;
  expiryDate?: string | null;
  idempotencyKey?: string | null;
  orderId: string;
  productionDate?: string | null;
  receiptDate?: string | null;
  rejectedQuantity?: number;
  remarks?: string | null;
  wastageQuantity?: number;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('post_production_receipt', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_batch_number: input.batchNumber ?? null,
    p_completed_quantity: input.completedQuantity,
    p_expiry_date: input.expiryDate ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_order_id: input.orderId,
    p_organization_id: ctx.organizationId,
    p_production_date: input.productionDate ?? null,
    p_receipt_date: input.receiptDate ?? null,
    p_rejected_quantity: input.rejectedQuantity ?? 0,
    p_remarks: input.remarks ?? null,
    p_wastage_quantity: input.wastageQuantity ?? 0,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function closeProductionOrder(input: {
  closingNotes?: string | null;
  orderId: string;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('close_production_order', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_closing_notes: input.closingNotes ?? null,
    p_order_id: input.orderId,
    p_organization_id: ctx.organizationId,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function reverseProductionIssue(input: {
  issueId: string;
  reason: string;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('reverse_production_issue', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_issue_id: input.issueId,
    p_organization_id: ctx.organizationId,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function reverseProductionReceipt(input: {
  reason: string;
  receiptId: string;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('reverse_production_receipt', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_reason: input.reason,
    p_receipt_id: input.receiptId,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}

export async function reopenProductionOrder(input: {
  orderId: string;
  reason: string;
}, ctx: AuthContext) {
  const service = productionService();
  const { data, error } = await service.rpc('reopen_production_order', {
    p_actor_user_account_id: userAccountId(ctx),
    p_actor_user_profile_id: ctx.userId,
    p_order_id: input.orderId,
    p_organization_id: ctx.organizationId,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data as ProductionRpcResult;
}
