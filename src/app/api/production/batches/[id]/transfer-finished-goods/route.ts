import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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
        id, batch_number, status, warehouse_id, actual_output,
        production_batch_outputs(id, item_id, actual_quantity)
      `)
      .eq('id', id)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return notFound('Production batch not found.');
    if (String(batch.status) !== 'COMPLETED') {
      return badRequest('Only completed batches can be transferred to stores.');
    }

    const outputs = Array.isArray(batch.production_batch_outputs) ? batch.production_batch_outputs : [];
    for (const output of outputs) {
      const quantity = Number(output.actual_quantity ?? 0);
      if (quantity <= 0) continue;

      const { data: sourceBalance, error: sourceBalanceError } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', output.item_id)
        .eq('warehouse_id', batch.warehouse_id)
        .single();
      if (sourceBalanceError) throw sourceBalanceError;
      if (Number(sourceBalance.quantity_available ?? 0) < quantity) {
        return badRequest(`Insufficient finished stock to transfer item ${output.item_id}.`);
      }

      await service
        .from('stock_balances')
        .update({
          quantity_available: Number(sourceBalance.quantity_available) - quantity,
          quantity_on_hand: Number(sourceBalance.quantity_on_hand) - quantity,
          last_updated: body.transferDate ?? new Date().toISOString(),
        })
        .eq('id', sourceBalance.id);

      const { data: destinationBalance } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('item_id', output.item_id)
        .eq('warehouse_id', body.destinationWarehouseId)
        .maybeSingle();

      if (destinationBalance) {
        await service
          .from('stock_balances')
          .update({
            quantity_available: Number(destinationBalance.quantity_available) + quantity,
            quantity_on_hand: Number(destinationBalance.quantity_on_hand) + quantity,
            last_updated: body.transferDate ?? new Date().toISOString(),
          })
          .eq('id', destinationBalance.id);
      } else {
        await service.from('stock_balances').insert({
          item_id: output.item_id,
          quantity_available: quantity,
          quantity_on_hand: quantity,
          quantity_reserved: 0,
          warehouse_id: body.destinationWarehouseId,
        });
      }

      await service.from('stock_movements').insert([
        {
          created_by: ctx.userId,
          destination_warehouse_id: body.destinationWarehouseId,
          item_id: output.item_id,
          movement_type: 'TRANSFER_OUT',
          quantity,
          reference_id: id,
          reference_type: 'finished_goods_transfer',
          source_warehouse_id: batch.warehouse_id,
          total_cost: 0,
          unit_cost: 0,
          warehouse_id: batch.warehouse_id,
        },
        {
          created_by: ctx.userId,
          item_id: output.item_id,
          movement_type: 'TRANSFER_IN',
          quantity,
          reference_id: id,
          reference_type: 'finished_goods_transfer',
          source_warehouse_id: batch.warehouse_id,
          total_cost: 0,
          unit_cost: 0,
          warehouse_id: body.destinationWarehouseId,
        },
      ]);
    }

    const { data, error } = await service
      .from('finished_goods_transfers')
      .insert({
        destination_warehouse_id: body.destinationWarehouseId,
        production_batch_id: id,
        quantity_transferred: Number(batch.actual_output ?? 0),
        received_by: body.receivedBy ?? null,
        source_warehouse_id: batch.warehouse_id,
        transfer_date: body.transferDate ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_FINISHED_GOODS_TRANSFERRED', id, ctx.userId, {
      destinationWarehouseId: body.destinationWarehouseId,
    }, 'finished_goods_transfer');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
