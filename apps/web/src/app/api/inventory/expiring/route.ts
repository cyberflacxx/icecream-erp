import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

  let query = service
    .from('inventory_batches')
    .select(
      `id, batch_number, expiry_date, manufactured_date, quantity_remaining,
       quantity_received, status, created_at,
       items!item_id(id, code, name),
       warehouses!warehouse_id(id, code, name,
         branches!branch_id(id, name))`,
    )
    .gte('expiry_date', today.toISOString())
    .lte('expiry_date', endDate.toISOString())
    .gt('quantity_remaining', 0)
    .order('expiry_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('warehouses.branch_id', ctx.branchId);
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  type ItemObj = { id?: string; code?: string; name?: string } | null;
  type WarehouseObj = {
    id?: string; code?: string; name?: string;
    branches?: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  } | null;

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const rawItems = row.items as ItemObj | ItemObj[];
    const batch_items: ItemObj = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
    const rawWH = row.warehouses as WarehouseObj | WarehouseObj[];
    const batch_warehouses: WarehouseObj = Array.isArray(rawWH) ? (rawWH[0] ?? null) : rawWH;
    const rawBranch = batch_warehouses?.branches;
    const branch = Array.isArray(rawBranch) ? (rawBranch[0] ?? null) : (rawBranch ?? null);
    return {
    id: row.id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    manufacturedDate: row.manufactured_date ?? null,
    quantityRemaining: Number(row.quantity_remaining),
    quantityReceived: Number(row.quantity_received),
    status: row.status,
    item: batch_items
      ? { id: batch_items.id, code: batch_items.code, name: batch_items.name }
      : null,
    warehouse: batch_warehouses
      ? {
          id: batch_warehouses.id,
          code: batch_warehouses.code,
          name: batch_warehouses.name,
          branch,
        }
      : null,
    };
  });

  return NextResponse.json(mapped);
}
