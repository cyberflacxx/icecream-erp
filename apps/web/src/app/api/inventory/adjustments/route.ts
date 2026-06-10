import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
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
    itemId?: string;
    warehouseId?: string;
    quantity?: number;
    type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    reason?: string;
  };

  const { itemId, warehouseId, quantity, type, reason } = body;

  if (!itemId || !warehouseId || quantity === undefined || !type || !reason) {
    return badRequest('itemId, warehouseId, quantity, type, and reason are required.');
  }

  if (type !== 'ADJUSTMENT_IN' && type !== 'ADJUSTMENT_OUT') {
    return badRequest('type must be ADJUSTMENT_IN or ADJUSTMENT_OUT.');
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return badRequest('quantity must be a positive number.');
  }

  // Verify item exists
  const { data: item, error: itemErr } = await service
    .from('items')
    .select('id, name, unit_cost')
    .eq('id', itemId)
    .is('deleted_at', null)
    .single();
  if (itemErr || !item) return badRequest('Inventory item not found.');

  // Verify warehouse exists and is active
  const { data: warehouse, error: warehouseErr } = await service
    .from('warehouses')
    .select('id, name')
    .eq('id', warehouseId)
    .eq('is_active', true)
    .single();
  if (warehouseErr || !warehouse) return badRequest('Warehouse not found or not active.');

  // Branch scope check
  if (ctx.isBranchScoped && ctx.branchId) {
    const { data: wh } = await service
      .from('warehouses')
      .select('branch_id')
      .eq('id', warehouseId)
      .single();
    if (!wh || wh.branch_id !== ctx.branchId) {
      return forbidden();
    }
  }

  // Get or create stock balance
  const { data: balance, error: balErr } = await service
    .from('stock_balances')
    .select('id, quantity_on_hand, quantity_available, quantity_reserved')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();
  if (balErr) return serverError(balErr.message);

  const currentOnHand = Number(balance?.quantity_on_hand ?? 0);
  const currentReserved = Number(balance?.quantity_reserved ?? 0);

  if (type === 'ADJUSTMENT_OUT') {
    const available = currentOnHand - currentReserved;
    if (available < qty) {
      return badRequest(
        `Insufficient stock for ${item.name}. Available: ${available.toFixed(3)}, Required: ${qty.toFixed(3)}`,
      );
    }
  }

  const newOnHand =
    type === 'ADJUSTMENT_IN' ? currentOnHand + qty : currentOnHand - qty;
  const newAvailable = newOnHand - currentReserved;

  let balanceId: string;

  if (balance) {
    const { data: updated, error: updateErr } = await service
      .from('stock_balances')
      .update({
        quantity_on_hand: newOnHand,
        quantity_available: newAvailable,
        quantity_reserved: currentReserved,
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
    if (updateErr) return serverError(updateErr.message);
    balanceId = balance.id;

    // Record the movement
    const { error: movErr } = await service.from('stock_movements').insert({
      item_id: itemId,
      warehouse_id: warehouseId,
      movement_type: type === 'ADJUSTMENT_IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity: qty,
      unit_cost: item.unit_cost ?? null,
      total_cost: item.unit_cost ? Number(item.unit_cost) * qty : null,
      reference_id: balanceId,
      reference_type: 'stock_adjustment',
      notes: reason,
      created_by: ctx.userId,
    });
    if (movErr) return serverError(movErr.message);

    return NextResponse.json(updated, { status: 201 });
  } else {
    // Create new balance
    const { data: created, error: createErr } = await service
      .from('stock_balances')
      .insert({
        item_id: itemId,
        warehouse_id: warehouseId,
        quantity_on_hand: newOnHand,
        quantity_available: newAvailable,
        quantity_reserved: 0,
        last_updated: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (createErr) return serverError(createErr.message);
    balanceId = created.id;

    // Record the movement
    const { error: movErr } = await service.from('stock_movements').insert({
      item_id: itemId,
      warehouse_id: warehouseId,
      movement_type: type === 'ADJUSTMENT_IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity: qty,
      unit_cost: item.unit_cost ?? null,
      total_cost: item.unit_cost ? Number(item.unit_cost) * qty : null,
      reference_id: balanceId,
      reference_type: 'stock_adjustment',
      notes: reason,
      created_by: ctx.userId,
    });
    if (movErr) return serverError(movErr.message);

    // Fetch full balance for response
    const { data: fullBalance, error: fetchErr } = await service
      .from('stock_balances')
      .select(
        `id, quantity_on_hand, quantity_available, quantity_reserved, last_updated,
         items!item_id(id, code, name, item_type, reorder_level,
           units_of_measure!unit_of_measure_id(id, name, abbreviation)),
         warehouses!warehouse_id(id, code, name,
           branches!branch_id(id, name))`,
      )
      .eq('id', balanceId)
      .single();
    if (fetchErr) return serverError(fetchErr.message);

    return NextResponse.json(fullBalance, { status: 201 });
  }
}
