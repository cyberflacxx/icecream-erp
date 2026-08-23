import { badRequest, canAccessBranchScope } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/api-auth';

export function branchService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export function ensureBranchScope(ctx: AuthContext, branchId: string) {
  if (!canAccessBranchScope(ctx, branchId)) {
    throw new Error('This action is outside the current branch scope.');
  }
}

type BranchWarehouseRow = {
  branch_id: string | null;
  code: string | null;
  id: string;
  is_active?: boolean | null;
  name: string | null;
  type: string | null;
  warehouse_type: string | null;
};

type BranchWarehouseResolution = BranchWarehouseRow & {
  resolutionReason: 'branch-linked-single' | 'branch-operational-evidence' | 'branch-default';
  score: number;
};

async function collectBranchWarehouseEvidence(branchId: string, warehouseIds: string[]) {
  const service = branchService();
  const scoreByWarehouseId = new Map<string, number>(warehouseIds.map((warehouseId) => [warehouseId, 0]));
  const bump = (warehouseId: string | null | undefined, amount: number) => {
    if (!warehouseId || !scoreByWarehouseId.has(warehouseId)) return;
    scoreByWarehouseId.set(warehouseId, (scoreByWarehouseId.get(warehouseId) ?? 0) + amount);
  };

  const [salesOrders, invoices, dispatches, salesIssues, balances] = await Promise.all([
    service
      .from('sales_orders')
      .select('warehouse_id')
      .eq('branch_id', branchId)
      .in('warehouse_id', warehouseIds)
      .limit(200),
    service
      .from('invoices')
      .select('warehouse_id')
      .eq('branch_id', branchId)
      .in('warehouse_id', warehouseIds)
      .limit(200),
    service
      .from('sales_dispatch_notes')
      .select('warehouse_id')
      .eq('branch_id', branchId)
      .in('warehouse_id', warehouseIds)
      .limit(200),
    service
      .from('stock_movements')
      .select('warehouse_id, movement_type')
      .eq('movement_type', 'SALES_ISSUE')
      .in('warehouse_id', warehouseIds)
      .limit(500),
    service
      .from('stock_balances')
      .select('warehouse_id, quantity_on_hand, quantity_available')
      .in('warehouse_id', warehouseIds)
      .limit(500),
  ]);

  for (const result of [salesOrders, invoices, dispatches, salesIssues, balances]) {
    if (!result.error) continue;
    const message = String((result.error as { message?: unknown }).message ?? '');
    if (message.includes('does not exist') || message.includes("Could not find the table 'icecream_erp.")) {
      continue;
    }
    throw result.error;
  }

  for (const row of salesOrders.data ?? []) bump(String(row.warehouse_id ?? ''), 3);
  for (const row of invoices.data ?? []) bump(String(row.warehouse_id ?? ''), 4);
  for (const row of dispatches.data ?? []) bump(String(row.warehouse_id ?? ''), 5);
  for (const row of salesIssues.data ?? []) bump(String(row.warehouse_id ?? ''), 6);
  for (const row of balances.data ?? []) {
    const quantityOnHand = Number(row.quantity_on_hand ?? 0);
    const quantityAvailable = Number(row.quantity_available ?? 0);
    if (quantityOnHand > 0 || quantityAvailable > 0) {
      bump(String(row.warehouse_id ?? ''), 1);
    }
  }

  return scoreByWarehouseId;
}

export async function resolveBranchWarehouse(branchId: string): Promise<BranchWarehouseResolution> {
  const service = branchService();
  const branchResult = await service
    .from('branches')
    .select('id, name, code, default_warehouse_id')
    .eq('id', branchId)
    .maybeSingle();
  if (branchResult.error) throw branchResult.error;
  if (!branchResult.data) throw new Error('Branch was not found.');

  const warehousesResult = await service
    .from('warehouses')
    .select('id, branch_id, code, name, type, warehouse_type, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (warehousesResult.error) throw warehousesResult.error;

  const warehouses = (warehousesResult.data ?? []) as BranchWarehouseRow[];
  if (warehouses.length === 0) {
    throw new Error('No active warehouse is linked to this branch.');
  }

  const defaultWarehouseId = String(branchResult.data.default_warehouse_id ?? '').trim();
  if (defaultWarehouseId) {
    const defaultWarehouse = warehouses.find((warehouse) => warehouse.id === defaultWarehouseId);
    if (defaultWarehouse) {
      return {
        ...defaultWarehouse,
        resolutionReason: 'branch-default',
        score: Number.MAX_SAFE_INTEGER,
      };
    }
  }

  if (warehouses.length === 1) {
    return {
      ...warehouses[0]!,
      resolutionReason: 'branch-linked-single',
      score: 1,
    };
  }

  const scoreByWarehouseId = await collectBranchWarehouseEvidence(
    branchId,
    warehouses.map((warehouse) => warehouse.id),
  );
  const ranked = warehouses
    .map((warehouse) => ({
      ...warehouse,
      score: scoreByWarehouseId.get(warehouse.id) ?? 0,
    }))
    .sort((left, right) => right.score - left.score || String(left.name ?? '').localeCompare(String(right.name ?? '')));

  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  if (top && top.score > 0 && (!runnerUp || top.score > runnerUp.score)) {
    return {
      ...top,
      resolutionReason: 'branch-operational-evidence',
    };
  }

  const warehouseNames = warehouses.map((warehouse) => warehouse.name ?? warehouse.code ?? warehouse.id).join(', ');
  throw new Error(
    `Unable to resolve one operational warehouse for this branch. Active warehouses: ${warehouseNames}. Configure branches.default_warehouse_id to remove ambiguity.`,
  );
}

export async function getActiveBranchWarehouse(branchId: string) {
  return resolveBranchWarehouse(branchId);
}

export async function generateBranchReferenceNumber(table: string, prefix: string) {
  const service = branchService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeBranchAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'branch',
) {
  const service = branchService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function requireOpenShift(branchId: string, shiftType: string, shiftDate: string) {
  const service = branchService();
  const { data, error } = await service
    .from('branch_shift_closes')
    .select('id, shift_type, shift_date, status')
    .eq('branch_id', branchId)
    .eq('shift_type', shiftType)
    .eq('shift_date', `${shiftDate}T00:00:00.000Z`)
    .eq('status', 'OPEN')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('An OPEN branch shift is required before this transaction can be recorded.');
  return data;
}
