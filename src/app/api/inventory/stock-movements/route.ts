import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { listCompatibleStockMovements, mapCompatibleStockMovementRows } from '@/lib/inventory-server';
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
  try {
    const result = await listCompatibleStockMovements(service, {
      branchId: ctx.branchId,
      endDate,
      isBranchScoped: ctx.isBranchScoped,
      itemId,
      page,
      pageSize,
      startDate,
      type,
      warehouseId,
    });
    const mapped = await mapCompatibleStockMovementRows(service, result.rows);

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: result.count },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load stock movements.');
  }
}
