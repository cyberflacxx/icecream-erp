import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  return (
    message.includes(`relation "${relationName}" does not exist`) ||
    message.includes(`Could not find the table 'icecream_erp.${relationName}'`)
  );
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const days = Math.max(1, parseInt(searchParams.get('days') ?? '30'));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + days);

  const warehousesQuery = service
    .from('warehouses')
    .select('id, code, name, branch_id')
    .eq('organization_id', ctx.organizationId);

  const { data: accessibleWarehouses, error: warehousesError } = ctx.isBranchScoped && ctx.branchId
    ? await warehousesQuery.eq('branch_id', ctx.branchId)
    : await warehousesQuery;
  if (warehousesError) return serverError(warehousesError.message);

  const warehouseIds = (accessibleWarehouses ?? []).map((warehouse) => String(warehouse.id ?? '')).filter(Boolean);
  if (!warehouseIds.length) return NextResponse.json([]);

  const { data: batches, error: batchesError } = await service
    .from('inventory_batches')
    .select('id, item_id, warehouse_id, batch_number, expiry_date, quantity_remaining, status, created_at')
    .in('warehouse_id', warehouseIds)
    .gte('expiry_date', today.toISOString())
    .lte('expiry_date', endDate.toISOString())
    .gt('quantity_remaining', 0)
    .order('expiry_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (batchesError) {
    if (isMissingRelationError(batchesError, 'inventory_batches')) {
      return NextResponse.json([]);
    }
    return serverError(batchesError.message);
  }

  const itemIds = [...new Set((batches ?? []).map((row) => String(row.item_id ?? '')).filter(Boolean))];
  const branchIds = [...new Set((accessibleWarehouses ?? []).map((warehouse) => String(warehouse.branch_id ?? '')).filter(Boolean))];

  const [itemsResult, branchesResult] = await Promise.all([
    itemIds.length
      ? service.from('items').select('id, code, name').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    branchIds.length
      ? service.from('branches').select('id, name').in('id', branchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) return serverError(itemsResult.error.message);
  if (branchesResult.error) return serverError(branchesResult.error.message);

  const items = new Map((itemsResult.data ?? []).map((item) => [String(item.id), item]));
  const warehouses = new Map((accessibleWarehouses ?? []).map((warehouse) => [String(warehouse.id), warehouse]));
  const branches = new Map((branchesResult.data ?? []).map((branch) => [String(branch.id), branch]));

  const mapped = (batches ?? []).map((row) => {
    const item = items.get(String(row.item_id ?? '')) ?? null;
    const warehouse = warehouses.get(String(row.warehouse_id ?? '')) ?? null;
    const branch = warehouse ? branches.get(String(warehouse.branch_id ?? '')) ?? null : null;

    return {
      id: row.id,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      quantityRemaining: Number(row.quantity_remaining ?? 0),
      status: row.status,
      item: item
        ? { id: item.id, code: item.code, name: item.name }
        : null,
      warehouse: warehouse
        ? {
            id: warehouse.id,
            code: warehouse.code,
            name: warehouse.name,
            branch: branch ? { id: branch.id, name: branch.name } : null,
          }
        : null,
    };
  });

  return NextResponse.json(mapped);
}
