import { createServiceRoleClient } from '@/lib/supabase/server';

export function productionService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export function productionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingProductionTable(error: unknown) {
  const message = productionErrorMessage(error);
  return (
    message.includes("Could not find the table 'icecream_erp.") ||
    message.includes('Could not find a relationship between') ||
    message.includes('does not exist')
  );
}

export async function resolveBranchWarehouseIds(branchId: string | null) {
  if (!branchId) return null;

  const service = productionService();
  const { data, error } = await service
    .from('warehouses')
    .select('id')
    .eq('branch_id', branchId);

  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function fetchStockBalanceMap(warehouseIds?: string[] | null) {
  const service = productionService();
  let query = service
    .from('stock_balances')
    .select('item_id, quantity_available');

  if (warehouseIds && warehouseIds.length > 0) {
    query = query.in('warehouse_id', warehouseIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(String(row.item_id), Number(row.quantity_available ?? 0));
  }

  return map;
}

export async function generateReferenceNumber(
  table: string,
  prefix: string,
  column = 'id',
) {
  const service = productionService();
  const { count, error } = await service
    .from(table)
    .select(column, { count: 'exact', head: true });

  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`;
}

export async function writeProductionAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'production',
) {
  const service = productionService();

  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function loadProductionReportBatches(filters: {
  branchId?: string | null;
  endDate?: string | undefined;
  startDate?: string | undefined;
  status?: string | undefined;
}) {
  const service = productionService();
  const warehouseIds = await resolveBranchWarehouseIds(filters.branchId ?? null);

  let query = service
    .from('production_batches')
    .select(`
      id, batch_number, production_date, shift, status, expected_output, actual_output, warehouse_id,
      recipes(name, finished_item:items(name)),
      production_batch_materials(quantity_required, quantity_issued, quantity_actual, unit_cost, items(name, unit_cost)),
      production_batch_outputs(expected_quantity, actual_quantity, wastage_quantity),
      production_worker_assignments(employee_id)
    `)
    .is('deleted_at', null)
    .order('production_date', { ascending: false });

  if (filters.startDate) {
    query = query.gte('production_date', `${filters.startDate}T00:00:00.000Z`);
  }
  if (filters.endDate) {
    query = query.lte('production_date', `${filters.endDate}T23:59:59.999Z`);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (warehouseIds && warehouseIds.length > 0) {
    query = query.in('warehouse_id', warehouseIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const workerCounts = new Map<string, number>();
  for (const batch of data ?? []) {
    const assignments = Array.isArray(batch.production_worker_assignments)
      ? batch.production_worker_assignments
      : [];
    workerCounts.set(String(batch.id), assignments.length);
  }

  return {
    batches: (data ?? []) as Array<Record<string, unknown>>,
    workerCounts,
  };
}
