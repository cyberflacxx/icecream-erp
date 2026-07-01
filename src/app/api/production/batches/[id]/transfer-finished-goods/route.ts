import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  applyInventoryDelta,
  generateDocumentNumber,
  quantityOrThrow,
  recordStockMovement,
  requireWarehouseAccess,
} from '@/lib/inventory-server';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      destinationWarehouseId: string;
      receivedBy?: string;
      transferDate?: string;
    };
    if (!body.destinationWarehouseId) {
      return badRequest('destinationWarehouseId is required.');
    }

    const service = productionService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select(`
        id, batch_number, status, warehouse_id, actual_output
      `)
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (String(batch.status) !== 'COMPLETED') {
      return badRequest('Only completed batches can be transferred to stores.');
    }

    await requireWarehouseAccess(service, String(batch.warehouse_id), ctx.branchId, ctx.isBranchScoped);
    await requireWarehouseAccess(service, body.destinationWarehouseId, ctx.branchId, ctx.isBranchScoped);

    const { data: outputs, error: outputsError } = await service
      .from('production_batch_outputs')
      .select('id, item_id, actual_quantity')
      .eq('batch_id', id);
    if (outputsError) throw outputsError;

    const transferItems = (outputs ?? [])
      .map((output) => ({
        itemId: String(output.item_id),
        rawQuantity: Number(output.actual_quantity ?? 0),
      }))
      .filter((output) => output.rawQuantity > 0)
      .map((output) => ({
        itemId: output.itemId,
        quantity: quantityOrThrow(output.rawQuantity, `actual quantity for ${output.itemId}`),
      }));

    if (transferItems.length === 0) {
      return badRequest('This batch has no finished goods quantities available to transfer.');
    }

    const transferNumber = await generateDocumentNumber(service, 'stock_transfers', 'FGT');
    const transferNotes = body.receivedBy
      ? `Production batch ${batch.batch_number} [production_batch:${id}] received by ${body.receivedBy}`
      : `Production batch ${batch.batch_number} [production_batch:${id}]`;

    const { data, error } = await service
      .from('stock_transfers')
      .insert({
        approved_by: ctx.userId,
        from_warehouse_id: batch.warehouse_id,
        notes: transferNotes,
        organization_id: ctx.organizationId,
        requested_by: ctx.userId,
        status: 'COMPLETED',
        to_warehouse_id: body.destinationWarehouseId,
        transfer_date: body.transferDate ?? new Date().toISOString().slice(0, 10),
        transfer_number: transferNumber,
      })
      .select()
      .single();
    if (error) throw error;

    for (const transferItem of transferItems) {
      await applyInventoryDelta(service, {
        itemId: transferItem.itemId,
        organizationId: ctx.organizationId,
        quantityDelta: -transferItem.quantity,
        warehouseId: String(batch.warehouse_id),
      });
      await applyInventoryDelta(service, {
        itemId: transferItem.itemId,
        organizationId: ctx.organizationId,
        quantityDelta: transferItem.quantity,
        warehouseId: body.destinationWarehouseId,
      });

      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: transferItem.itemId,
        movementType: 'TRANSFER_OUT',
        notes: transferNotes,
        organizationId: ctx.organizationId,
        quantity: transferItem.quantity,
        referenceId: String(data.id),
        referenceType: 'stock_transfer',
        warehouseId: String(batch.warehouse_id),
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: transferItem.itemId,
        movementType: 'TRANSFER_IN',
        notes: transferNotes,
        organizationId: ctx.organizationId,
        quantity: transferItem.quantity,
        referenceId: String(data.id),
        referenceType: 'stock_transfer',
        warehouseId: body.destinationWarehouseId,
      });

      const { error: transferItemError } = await service
        .from('stock_transfer_items')
        .insert({
          item_id: transferItem.itemId,
          notes: transferNotes,
          quantity_received: transferItem.quantity,
          quantity_requested: transferItem.quantity,
          quantity_sent: transferItem.quantity,
          transfer_id: data.id,
          unit_cost: 0,
        });
      if (transferItemError) throw transferItemError;
    }

    await writeProductionAuditLog('PRODUCTION_FINISHED_GOODS_TRANSFERRED', id, ctx.userId, {
      destinationWarehouseId: body.destinationWarehouseId,
      stockTransferId: data.id,
      transferNumber,
    }, 'production_batch');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
