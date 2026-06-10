import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    batchId?: string;
    reason?: string;
  };

  const { batchId, reason } = body;

  if (!batchId || !reason) {
    return badRequest('batchId and reason are required.');
  }

  // Fetch the batch
  const { data: batch, error: batchErr } = await service
    .from('inventory_batches')
    .select(
      `id, batch_number, expiry_date, quantity_remaining, status, item_id, warehouse_id, unit_cost,
       items!item_id(id, name)`,
    )
    .eq('id', batchId)
    .single();

  if (batchErr || !batch) return notFound('Inventory batch not found.');

  // Branch scope check
  if (ctx.isBranchScoped && ctx.branchId) {
    const { data: wh } = await service
      .from('warehouses')
      .select('branch_id')
      .eq('id', batch.warehouse_id)
      .single();
    if (!wh || wh.branch_id !== ctx.branchId) {
      return forbidden();
    }
  }

  // Only expired batches can be written off
  if (!batch.expiry_date) {
    return badRequest('Only batches with an expiry date can be written off.');
  }

  const expiryDate = new Date(batch.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate.getTime() > today.getTime()) {
    return badRequest('Only expired batches can be written off.');
  }

  const quantityToWriteOff = Number(batch.quantity_remaining);
  if (quantityToWriteOff <= 0) {
    return badRequest('Batch has no remaining quantity to write off.');
  }

  const rawBatchItems = batch.items as { id?: string; name?: string } | Array<{ id?: string; name?: string }> | null;
  const batchItemObj = Array.isArray(rawBatchItems) ? (rawBatchItems[0] ?? null) : rawBatchItems;
  const itemName = batchItemObj?.name ?? 'Unknown';

  // Get stock balance
  const { data: balance, error: balErr } = await service
    .from('stock_balances')
    .select('id, quantity_on_hand, quantity_available, quantity_reserved')
    .eq('item_id', batch.item_id)
    .eq('warehouse_id', batch.warehouse_id)
    .single();

  if (balErr || !balance) {
    return badRequest(`No stock balance found for item ${itemName} in the specified warehouse.`);
  }

  const currentOnHand = Number(balance.quantity_on_hand);
  const currentReserved = Number(balance.quantity_reserved);

  if (currentOnHand < quantityToWriteOff) {
    return badRequest(
      `Insufficient stock for ${itemName}. On hand: ${currentOnHand.toFixed(3)}, Required: ${quantityToWriteOff.toFixed(3)}`,
    );
  }

  // Reduce reserved proportionally (take minimum of reserved and write-off qty)
  const reservedReduction = Math.min(currentReserved, quantityToWriteOff);
  const newOnHand = currentOnHand - quantityToWriteOff;
  const newReserved = currentReserved - reservedReduction;
  const newAvailable = newOnHand - newReserved;

  // Update batch: set remaining to 0, status to EXPIRED
  const { error: batchUpdateErr } = await service
    .from('inventory_batches')
    .update({
      quantity_remaining: 0,
      status: 'EXPIRED',
    })
    .eq('id', batchId);

  if (batchUpdateErr) return serverError(batchUpdateErr.message);

  // Update stock balance
  const { data: updatedBalance, error: balUpdateErr } = await service
    .from('stock_balances')
    .update({
      quantity_on_hand: newOnHand,
      quantity_available: newAvailable,
      quantity_reserved: newReserved,
      last_updated: new Date().toISOString(),
    })
    .eq('id', balance.id)
    .select(
      `id, quantity_on_hand, quantity_available, quantity_reserved, last_updated,
       items!item_id(id, code, name, item_type, reorder_level,
         units_of_measure!unit_of_measure_id(id, name, abbreviation)),
       warehouses!warehouse_id(id, code, name,
         branches!branch_id(id, name))`,
    )
    .single();

  if (balUpdateErr) return serverError(balUpdateErr.message);

  // Record movement
  const { error: movErr } = await service.from('stock_movements').insert({
    item_id: batch.item_id,
    warehouse_id: batch.warehouse_id,
    movement_type: 'EXPIRY_WRITE_OFF',
    quantity: quantityToWriteOff,
    unit_cost: batch.unit_cost ?? null,
    total_cost: batch.unit_cost ? Number(batch.unit_cost) * quantityToWriteOff : null,
    reference_id: batchId,
    reference_type: 'expiry_write_off',
    notes: reason,
    created_by: ctx.userId,
  });

  if (movErr) return serverError(movErr.message);

  return NextResponse.json(updatedBalance);
}
