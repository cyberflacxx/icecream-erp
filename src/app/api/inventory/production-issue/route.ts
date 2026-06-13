import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  generateDocumentNumber,
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
    items?: Array<{ itemId: string; quantity: number }>;
    notes?: string | null;
    productionRequestReference?: string | null;
    productionWarehouseId?: string;
    sourceWarehouseId?: string;
  };

  if (!body.sourceWarehouseId || !body.productionWarehouseId) {
    return badRequest('sourceWarehouseId and productionWarehouseId are required.');
  }

  if (body.sourceWarehouseId === body.productionWarehouseId) {
    return badRequest('Source and production warehouses must be different.');
  }

  if (!body.items?.length) {
    return badRequest('At least one item is required.');
  }

  try {
    await requireWarehouseAccess(service, body.sourceWarehouseId, ctx.branchId, ctx.isBranchScoped);
    await requireWarehouseAccess(service, body.productionWarehouseId, ctx.branchId, ctx.isBranchScoped);

    const issueNumber = await generateDocumentNumber(service, 'stock_transfers', 'PROD-ISS');
    const { data: transfer, error: transferError } = await service
      .from('stock_transfers')
      .insert({
        transfer_number: issueNumber,
        from_warehouse_id: body.sourceWarehouseId,
        to_warehouse_id: body.productionWarehouseId,
        transfer_date: new Date().toISOString(),
        requested_by: ctx.userId,
        approved_by: ctx.userId,
        status: 'COMPLETED',
        notes: body.notes ?? body.productionRequestReference ?? null,
      })
      .select()
      .single();

    if (transferError || !transfer) return serverError(transferError?.message ?? 'Failed to create production issue.');

    for (const line of body.items) {
      const quantity = quantityOrThrow(line.quantity);
      await applyInventoryDelta(service, {
        itemId: line.itemId,
        quantityDelta: -quantity,
        warehouseId: body.sourceWarehouseId,
      });
      await applyInventoryDelta(service, {
        itemId: line.itemId,
        quantityDelta: quantity,
        warehouseId: body.productionWarehouseId,
      });

      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: line.itemId,
        movementType: 'PRODUCTION_ISSUE',
        notes: body.notes ?? body.productionRequestReference ?? null,
        quantity,
        referenceId: transfer.id,
        referenceType: 'production_issue',
        warehouseId: body.sourceWarehouseId,
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: line.itemId,
        movementType: 'WAREHOUSE_TRANSFER_IN',
        notes: body.notes ?? body.productionRequestReference ?? null,
        quantity,
        referenceId: transfer.id,
        referenceType: 'production_issue',
        warehouseId: body.productionWarehouseId,
      });
    }

    return NextResponse.json({
      id: transfer.id,
      issueNumber,
      itemsCount: body.items.length,
      productionRequestReference: body.productionRequestReference ?? null,
      status: transfer.status,
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post production issue');
  }
}
