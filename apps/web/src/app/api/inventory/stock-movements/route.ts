import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const itemId = searchParams.get('itemId') ?? '';
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const type = searchParams.get('type') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';

  let query = service
    .from('stock_movements')
    .select(
      `id, movement_type, quantity, running_balance, unit_cost, total_cost,
       reference_id, reference_type, notes, created_at,
       items!item_id(id, code, name),
       warehouses!warehouse_id(
         id, name,
         branches!branch_id(id, name)
       ),
       users!created_by(id, first_name, last_name)`,
      { count: 'exact' },
    );

  if (itemId) query = query.eq('item_id', itemId);
  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (type) query = query.eq('movement_type', type);
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.eq('warehouses.branch_id', ctx.branchId);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  type MovementRow = {
    id: string;
    movement_type: string;
    quantity: number;
    running_balance: number;
    unit_cost: number | null;
    total_cost: number | null;
    reference_id: string | null;
    reference_type: string | null;
    notes: string | null;
    created_at: string;
    items: { id: string; code: string; name: string } | null;
    warehouses: {
      id: string;
      name: string;
      branches: { id: string; name: string } | null;
    } | null;
    users: { id: string; first_name: string | null; last_name: string | null } | null;
  };

  const mapped = ((data ?? []) as MovementRow[]).map((m) => ({
    id: m.id,
    date: m.created_at,
    type: m.movement_type,
    quantity: Number(m.quantity),
    runningBalance: Number(m.running_balance),
    unitCost: m.unit_cost !== null ? Number(m.unit_cost) : null,
    totalCost: m.total_cost !== null ? Number(m.total_cost) : null,
    reference: {
      id: m.reference_id ?? null,
      type: m.reference_type ?? null,
    },
    notes: m.notes ?? null,
    item: m.items
      ? { id: m.items.id, code: m.items.code, name: m.items.name }
      : null,
    warehouse: m.warehouses
      ? { id: m.warehouses.id, name: m.warehouses.name }
      : null,
    createdBy: m.users
      ? {
          id: m.users.id,
          name: `${m.users.first_name ?? ''} ${m.users.last_name ?? ''}`.trim(),
        }
      : null,
  }));

  return NextResponse.json({
    data: mapped,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}
