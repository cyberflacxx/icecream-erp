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

  type BatchRow = {
    id: string;
    batch_number: string;
    expiry_date: string | null;
    manufactured_date: string | null;
    quantity_remaining: number;
    quantity_received: number;
    status: string;
    created_at: string;
    items: { id: string; code: string; name: string } | null;
    warehouses: {
      id: string;
      code: string;
      name: string;
      branches: { id: string; name: string } | null;
    } | null;
  };

  const mapped = ((data ?? []) as BatchRow[]).map((batch) => ({
    id: batch.id,
    batchNumber: batch.batch_number,
    expiryDate: batch.expiry_date,
    manufacturedDate: batch.manufactured_date ?? null,
    quantityRemaining: Number(batch.quantity_remaining),
    quantityReceived: Number(batch.quantity_received),
    status: batch.status,
    item: batch.items
      ? { id: batch.items.id, code: batch.items.code, name: batch.items.name }
      : null,
    warehouse: batch.warehouses
      ? {
          id: batch.warehouses.id,
          code: batch.warehouses.code,
          name: batch.warehouses.name,
          branch: batch.warehouses.branches ?? null,
        }
      : null,
  }));

  return NextResponse.json(mapped);
}
