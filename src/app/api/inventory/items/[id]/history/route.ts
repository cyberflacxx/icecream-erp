import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'inventory.report.view')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const warehouseId = searchParams.get('warehouseId') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';

  let query = service
    .from('stock_movements')
    .select('id, warehouse_id, movement_type, quantity, unit_cost, total_cost, reference_id, reference_type, batch_number, created_at, warehouses!warehouse_id(id, code, name)')
    .eq('organization_id', ctx.organizationId)
    .eq('item_id', id)
    .order('created_at', { ascending: false });

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
      return {
        id: row.id,
        createdAt: row.created_at,
        movementType: row.movement_type,
        quantity: Number(row.quantity ?? 0),
        unitCost: Number(row.unit_cost ?? 0),
        totalCost: Number(row.total_cost ?? 0),
        batchNumber: row.batch_number ?? null,
        referenceId: row.reference_id ?? null,
        referenceType: row.reference_type ?? null,
        warehouse: warehouse
          ? { id: warehouse.id, code: warehouse.code, name: warehouse.name }
          : null,
      };
    }),
  });
}
