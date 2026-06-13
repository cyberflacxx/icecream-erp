import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  quantityOrThrow,
  recordStockMovement,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'production.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    destinationWarehouseId?: string;
    items?: Array<{ itemId: string; quantityAccepted: number; quantityRejected?: number }>;
    notes?: string | null;
    productionBatchReference?: string | null;
  };

  if (!body.destinationWarehouseId) {
    return badRequest('destinationWarehouseId is required.');
  }

  if (!body.items?.length) {
    return badRequest('At least one finished good line is required.');
  }

  try {
    await requireWarehouseAccess(service, body.destinationWarehouseId, ctx.branchId, ctx.isBranchScoped);

    for (const line of body.items) {
      const acceptedQuantity = quantityOrThrow(line.quantityAccepted, 'quantityAccepted');
      await applyInventoryDelta(service, {
        itemId: line.itemId,
        quantityDelta: acceptedQuantity,
        warehouseId: body.destinationWarehouseId,
      });

      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: line.itemId,
        movementType: 'FINISHED_GOODS_RECEIPT',
        notes: body.notes ?? body.productionBatchReference ?? null,
        quantity: acceptedQuantity,
        referenceId: body.productionBatchReference ?? null,
        referenceType: 'production_batch',
        warehouseId: body.destinationWarehouseId,
      });
    }

    return NextResponse.json({
      destinationWarehouseId: body.destinationWarehouseId,
      itemsCount: body.items.length,
      productionBatchReference: body.productionBatchReference ?? null,
      status: 'POSTED',
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to receive finished goods');
  }
}
