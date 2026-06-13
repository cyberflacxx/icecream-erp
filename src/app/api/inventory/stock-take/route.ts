import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  createInventoryAdjustmentRecord,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    items?: Array<{ itemId: string; physicalQuantity: number }>;
    postVariances?: boolean;
    reason?: string;
    warehouseId?: string;
  };

  if (!body.warehouseId || !body.items?.length) {
    return badRequest('warehouseId and at least one stock take line are required.');
  }

  try {
    await requireWarehouseAccess(service, body.warehouseId, ctx.branchId, ctx.isBranchScoped);

    const rows = [];
    for (const line of body.items) {
      const { data: balance, error } = await service
        .from('stock_balances')
        .select('quantity_on_hand')
        .eq('item_id', line.itemId)
        .eq('warehouse_id', body.warehouseId)
        .maybeSingle();

      if (error) return serverError(error.message);

      const systemQuantity = Number(balance?.quantity_on_hand ?? 0);
      const variance = Number(line.physicalQuantity) - systemQuantity;
      rows.push({
        itemId: line.itemId,
        physicalQuantity: Number(line.physicalQuantity),
        systemQuantity,
        variance,
      });

      if (body.postVariances && variance !== 0) {
        const movementType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        await createInventoryAdjustmentRecord(service, {
          createdBy: ctx.userId,
          itemId: line.itemId,
          movementType,
          quantity: Math.abs(variance),
          reason: body.reason ?? 'Stock take variance',
          warehouseId: body.warehouseId,
        });
        await applyInventoryDelta(service, {
          itemId: line.itemId,
          quantityDelta: variance,
          warehouseId: body.warehouseId,
        });
      }
    }

    return NextResponse.json({
      items: rows,
      posted: Boolean(body.postVariances),
      warehouseId: body.warehouseId,
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to complete stock take');
  }
}
