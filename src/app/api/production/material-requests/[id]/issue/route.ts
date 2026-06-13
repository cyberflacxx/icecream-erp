import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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

    const items = Array.isArray(requestRow.production_material_request_items)
      ? requestRow.production_material_request_items
      : [];

    for (const item of items) {
      const issued = body.items?.find((row) => row.id === item.id)?.quantityIssued
        ?? Number(item.quantity_approved ?? item.quantity_requested ?? 0);
      if (issued <= 0) continue;

      const { data: sourceBalance, error: sourceBalanceError } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', item.item_id)
        .eq('warehouse_id', body.sourceWarehouseId)
        .single();
      if (sourceBalanceError) throw sourceBalanceError;
      if (Number(sourceBalance.quantity_available ?? 0) < issued) {
        return badRequest(`Insufficient stock for item ${item.item_id}.`);
      }

      await service
        .from('stock_balances')
        .update({
          quantity_available: Number(sourceBalance.quantity_available) - issued,
          quantity_on_hand: Number(sourceBalance.quantity_on_hand) - issued,
          last_updated: body.issueDate ?? new Date().toISOString(),
        })
        .eq('id', sourceBalance.id);

      const { data: destinationBalance } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', item.item_id)
        .eq('warehouse_id', batch.warehouse_id)
        .maybeSingle();

      if (destinationBalance) {
        await service
          .from('stock_balances')
          .update({
            quantity_available: Number(destinationBalance.quantity_available ?? 0) + issued,
            quantity_on_hand: Number(destinationBalance.quantity_on_hand ?? 0) + issued,
            last_updated: body.issueDate ?? new Date().toISOString(),
          })
          .eq('id', destinationBalance.id);
      } else {
        await service.from('stock_balances').insert({
          item_id: item.item_id,
          quantity_available: issued,
          quantity_on_hand: issued,
          quantity_reserved: 0,
          warehouse_id: batch.warehouse_id,
        });
      }

      await service.from('stock_movements').insert([
        {
          created_by: ctx.userId,
          destination_warehouse_id: batch.warehouse_id,
          item_id: item.item_id,
          movement_type: 'PRODUCTION_ISSUE',
          quantity: issued,
          reference_id: id,
          reference_type: 'production_material_request',
          source_warehouse_id: body.sourceWarehouseId,
          total_cost: 0,
          unit_cost: 0,
          warehouse_id: body.sourceWarehouseId,
        },
        {
          created_by: ctx.userId,
          item_id: item.item_id,
          movement_type: 'TRANSFER_IN',
          quantity: issued,
          reference_id: id,
          reference_type: 'production_material_request',
          source_warehouse_id: body.sourceWarehouseId,
          total_cost: 0,
          unit_cost: 0,
          warehouse_id: batch.warehouse_id,
        },
      ]);

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
