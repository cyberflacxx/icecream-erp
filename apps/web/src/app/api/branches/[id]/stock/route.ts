import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== id) return forbidden();

    // Find the branch warehouse
    const { data: warehouse } = await service
      .schema('icecream_erp')
      .from('warehouses')
      .select('id')
      .eq('branch_id', id)
      .eq('is_active', true)
      .eq('type', 'BRANCH')
      .maybeSingle();

    if (!warehouse) return badRequest('No active branch warehouse found');

    let query = service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('id, quantity_on_hand, quantity_available, quantity_reserved, items!inner(id, code, name, item_type, unit_cost)', { count: 'exact' })
      .eq('warehouse_id', warehouse.id)
      .is('items.deleted_at', null)
      .order('items(name)', { ascending: true });

    if (search) {
      query = query.or(`items.code.ilike.%${search}%,items.name.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => {
        const item = row.items as { id: string; code: string; name: string; item_type: string; unit_cost: number };
        const qtyOnHand = Number(row.quantity_on_hand ?? 0);
        const unitCost = Number(item?.unit_cost ?? 0);
        return {
          id: row.id,
          item: { id: item?.id, code: item?.code, name: item?.name, itemType: item?.item_type },
          quantityOnHand: qtyOnHand,
          quantityAvailable: Number(row.quantity_available ?? 0),
          unitCost,
          totalValue: qtyOnHand * unitCost,
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
