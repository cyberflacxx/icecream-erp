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

  type Obj = Record<string, unknown> | null;

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const rawItems = row.items as Obj | Obj[];
    const items: Obj = Array.isArray(rawItems) ? (rawItems[0] ?? null) : rawItems;
    const rawWH = row.warehouses as Obj | Obj[];
    const warehouses: Obj = Array.isArray(rawWH) ? (rawWH[0] ?? null) : rawWH;
    const rawUsers = row.users as Obj | Obj[];
    const users: Obj = Array.isArray(rawUsers) ? (rawUsers[0] ?? null) : rawUsers;
    return {
      id: row.id,
      date: row.created_at,
      type: row.movement_type,
      quantity: Number(row.quantity),
      runningBalance: Number(row.running_balance),
      unitCost: row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : null,
      totalCost: row.total_cost !== null && row.total_cost !== undefined ? Number(row.total_cost) : null,
      reference: { id: row.reference_id ?? null, type: row.reference_type ?? null },
      notes: row.notes ?? null,
      item: items ? { id: items.id, code: items.code, name: items.name } : null,
      warehouse: warehouses ? { id: warehouses.id, name: warehouses.name } : null,
      createdBy: users
        ? { id: users.id, name: `${users.first_name ?? ''} ${users.last_name ?? ''}`.trim() }
        : null,
    };
  });

  return NextResponse.json({
    data: mapped,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}
