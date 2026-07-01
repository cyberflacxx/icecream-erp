import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { applyInventoryDelta, getBalance, recordStockMovement, requireWarehouseAccess } from '@/lib/inventory-server';
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
      issueDate?: string;
      items?: Array<{ id: string; quantityIssued: number }>;
      sourceWarehouseId: string;
    };
    if (!body.sourceWarehouseId) return badRequest('sourceWarehouseId is required.');

    const service = productionService();
    const { data: requestRow, error: requestError } = await service
      .from('production_material_requests')
      .select('id, production_batch_id, request_number, production_material_request_items(id, item_id, quantity_approved, quantity_requested)')
      .eq('id', id)
      .single();
    if (requestError) throw requestError;

    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, warehouse_id')
      .eq('id', requestRow.production_batch_id)
      .single();
    if (batchError) throw batchError;

    await requireWarehouseAccess(service, body.sourceWarehouseId, ctx.branchId, ctx.isBranchScoped);
    await requireWarehouseAccess(service, String(batch.warehouse_id), ctx.branchId, ctx.isBranchScoped);

    const items = Array.isArray(requestRow.production_material_request_items)
      ? requestRow.production_material_request_items
      : [];

    for (const item of items) {
      const issued = body.items?.find((row) => row.id === item.id)?.quantityIssued
        ?? Number(item.quantity_approved ?? item.quantity_requested ?? 0);
      if (issued <= 0) continue;

      const sourceBalance = await getBalance(service, String(item.item_id), body.sourceWarehouseId);
      if (Number(sourceBalance?.quantity_available ?? 0) < issued) {
        return badRequest(`Insufficient stock for item ${item.item_id}.`);
      }

      await applyInventoryDelta(service, {
        itemId: String(item.item_id),
        organizationId: ctx.organizationId,
        quantityDelta: -issued,
        warehouseId: body.sourceWarehouseId,
      });
      await applyInventoryDelta(service, {
        itemId: String(item.item_id),
        organizationId: ctx.organizationId,
        quantityDelta: issued,
        warehouseId: String(batch.warehouse_id),
      });

      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: String(item.item_id),
        movementType: 'PRODUCTION_ISSUE',
        notes: requestRow.request_number ?? null,
        organizationId: ctx.organizationId,
        quantity: issued,
        referenceId: id,
        referenceType: 'production_material_request',
        warehouseId: body.sourceWarehouseId,
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: String(item.item_id),
        movementType: 'TRANSFER_IN',
        notes: requestRow.request_number ?? null,
        organizationId: ctx.organizationId,
        quantity: issued,
        referenceId: id,
        referenceType: 'production_material_request',
        warehouseId: String(batch.warehouse_id),
      });

      await service
        .from('production_material_request_items')
        .update({ quantity_issued: issued })
        .eq('id', item.id);
    }

    await service
      .from('production_material_requests')
      .update({ status: 'APPROVED' })
      .eq('id', id);

    await service
      .from('production_batches')
      .update({ status: 'MATERIALS_RESERVED' })
      .eq('id', requestRow.production_batch_id);

    await writeProductionAuditLog('PRODUCTION_MATERIAL_REQUEST_ISSUED', id, ctx.userId, {
      batchId: requestRow.production_batch_id,
      sourceWarehouseId: body.sourceWarehouseId,
    }, 'production_material_request');
    return NextResponse.json({ issued: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
