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

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status') ?? '';
  const fromWarehouseId = searchParams.get('fromWarehouseId') ?? '';
  const toWarehouseId = searchParams.get('toWarehouseId') ?? '';

  let query = service
    .from('stock_transfers')
    .select(
      `id, transfer_number, transfer_date, status, notes, created_at,
       from_warehouse:warehouses!from_warehouse_id(id, name, branch_id),
       to_warehouse:warehouses!to_warehouse_id(id, name, branch_id),
       stock_transfer_items(id)`,
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (status) query = query.eq('status', status);
  if (fromWarehouseId) query = query.eq('from_warehouse_id', fromWarehouseId);
  if (toWarehouseId) query = query.eq('to_warehouse_id', toWarehouseId);
  if (ctx.isBranchScoped && ctx.branchId) {
    // Only show transfers where from or to warehouse belongs to the user's branch
    query = query.or(
      `from_warehouse.branch_id.eq.${ctx.branchId},to_warehouse.branch_id.eq.${ctx.branchId}`,
    );
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  type WHObj = { id?: string; name?: string } | null;

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const rawFW = row.from_warehouse as WHObj | WHObj[];
    const from_warehouse: WHObj = Array.isArray(rawFW) ? (rawFW[0] ?? null) : rawFW;
    const rawTW = row.to_warehouse as WHObj | WHObj[];
    const to_warehouse: WHObj = Array.isArray(rawTW) ? (rawTW[0] ?? null) : rawTW;
    const items = row.stock_transfer_items as Array<unknown> | null;
    return {
      id: row.id,
      transferNumber: row.transfer_number,
      transferDate: row.transfer_date,
      status: row.status,
      notes: row.notes ?? null,
      fromWarehouse: from_warehouse ? { id: from_warehouse.id, name: from_warehouse.name } : null,
      toWarehouse: to_warehouse ? { id: to_warehouse.id, name: to_warehouse.name } : null,
      itemsCount: items?.length ?? 0,
    };
  });

  return NextResponse.json({
    data: mapped,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    fromWarehouseId?: string;
    toWarehouseId?: string;
    notes?: string | null;
    items?: Array<{ itemId: string; quantity: number }>;
  };

  const { fromWarehouseId, toWarehouseId, items } = body;

  if (!fromWarehouseId || !toWarehouseId) {
    return badRequest('fromWarehouseId and toWarehouseId are required.');
  }
  if (!items || items.length === 0) {
    return badRequest('At least one item is required.');
  }
  if (fromWarehouseId === toWarehouseId) {
    return badRequest('Source and destination warehouses must be different.');
  }

  // Verify both warehouses exist and are active
  const [fromResult, toResult] = await Promise.all([
    service
      .from('warehouses')
      .select('id, name, branch_id')
      .eq('id', fromWarehouseId)
      .eq('is_active', true)
      .single(),
    service
      .from('warehouses')
      .select('id, name, branch_id')
      .eq('id', toWarehouseId)
      .eq('is_active', true)
      .single(),
  ]);

  if (!fromResult.data) return badRequest('Source warehouse not found or inactive.');
  if (!toResult.data) return badRequest('Destination warehouse not found or inactive.');

  // Generate transfer number
  const { count: transferCount } = await service
    .from('stock_transfers')
    .select('id', { count: 'exact', head: true });
  const nextSeq = (transferCount ?? 0) + 1;
  const transferNumber = `TRF-${String(nextSeq).padStart(5, '0')}`;

  // Create the transfer record
  const { data: transfer, error: transferError } = await service
    .from('stock_transfers')
    .insert({
      transfer_number: transferNumber,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      notes: body.notes ?? null,
      status: 'COMPLETED',
      transfer_date: new Date().toISOString(),
      requested_by: ctx.userId,
      approved_by: ctx.userId,
    })
    .select('id, transfer_number, status, transfer_date, notes')
    .single();

  if (transferError) return serverError(transferError.message);

  // Process each item: deduct from source, add to destination
  for (const itemRow of items) {
    const qty = Number(itemRow.quantity);
    if (isNaN(qty) || qty <= 0) {
      return badRequest(`Invalid quantity for item ${itemRow.itemId}.`);
    }

    // Verify item exists
    const { data: item } = await service
      .from('items')
      .select('id, name, unit_cost')
      .eq('id', itemRow.itemId)
      .is('deleted_at', null)
      .single();
    if (!item) return badRequest(`Item ${itemRow.itemId} not found.`);

    // Get or create source balance
    const { data: srcBalance, error: srcBalErr } = await service
      .from('stock_balances')
      .select('id, quantity_on_hand, quantity_available, quantity_reserved')
      .eq('item_id', itemRow.itemId)
      .eq('warehouse_id', fromWarehouseId)
      .maybeSingle();
    if (srcBalErr) return serverError(srcBalErr.message);

    const srcOnHand = Number(srcBalance?.quantity_on_hand ?? 0);
    const srcAvailable = Number(srcBalance?.quantity_available ?? 0);
    const srcReserved = Number(srcBalance?.quantity_reserved ?? 0);

    if (srcAvailable < qty) {
      return badRequest(
        `Insufficient stock for ${item.name}. Available: ${srcAvailable.toFixed(3)}, Required: ${qty.toFixed(3)}`,
      );
    }

    // Deduct from source
    if (srcBalance) {
      const { error: deductErr } = await service
        .from('stock_balances')
        .update({
          quantity_on_hand: srcOnHand - qty,
          quantity_available: srcAvailable - qty,
          quantity_reserved: srcReserved,
          last_updated: new Date().toISOString(),
        })
        .eq('id', srcBalance.id);
      if (deductErr) return serverError(deductErr.message);
    }

    // Get or create destination balance
    const { data: dstBalance } = await service
      .from('stock_balances')
      .select('id, quantity_on_hand, quantity_available, quantity_reserved')
      .eq('item_id', itemRow.itemId)
      .eq('warehouse_id', toWarehouseId)
      .maybeSingle();

    if (dstBalance) {
      const dstOnHand = Number(dstBalance.quantity_on_hand);
      const dstReserved = Number(dstBalance.quantity_reserved);
      const { error: addErr } = await service
        .from('stock_balances')
        .update({
          quantity_on_hand: dstOnHand + qty,
          quantity_available: dstOnHand + qty - dstReserved,
          last_updated: new Date().toISOString(),
        })
        .eq('id', dstBalance.id);
      if (addErr) return serverError(addErr.message);
    } else {
      const { error: createErr } = await service.from('stock_balances').insert({
        item_id: itemRow.itemId,
        warehouse_id: toWarehouseId,
        quantity_on_hand: qty,
        quantity_available: qty,
        quantity_reserved: 0,
        last_updated: new Date().toISOString(),
      });
      if (createErr) return serverError(createErr.message);
    }

    // Record TRANSFER_OUT movement
    await service.from('stock_movements').insert({
      item_id: itemRow.itemId,
      warehouse_id: fromWarehouseId,
      movement_type: 'TRANSFER_OUT',
      quantity: qty,
      unit_cost: item.unit_cost ?? null,
      total_cost: item.unit_cost ? Number(item.unit_cost) * qty : null,
      reference_id: transfer.id,
      reference_type: 'stock_transfer',
      notes: body.notes ?? null,
      created_by: ctx.userId,
    });

    // Record TRANSFER_IN movement
    await service.from('stock_movements').insert({
      item_id: itemRow.itemId,
      warehouse_id: toWarehouseId,
      movement_type: 'TRANSFER_IN',
      quantity: qty,
      unit_cost: item.unit_cost ?? null,
      total_cost: item.unit_cost ? Number(item.unit_cost) * qty : null,
      reference_id: transfer.id,
      reference_type: 'stock_transfer',
      notes: body.notes ?? null,
      created_by: ctx.userId,
    });

    // Create stock_transfer_items row
    await service.from('stock_transfer_items').insert({
      transfer_id: transfer.id,
      item_id: itemRow.itemId,
      quantity_requested: qty,
      quantity_sent: qty,
      quantity_received: qty,
    });
  }

  // Return full transfer with relations
  const { data: result, error: fetchErr } = await service
    .from('stock_transfers')
    .select(
      `id, transfer_number, transfer_date, status, notes, created_at,
       from_warehouse:warehouses!from_warehouse_id(id, name),
       to_warehouse:warehouses!to_warehouse_id(id, name),
       stock_transfer_items(id, item_id, quantity_requested, quantity_sent, quantity_received,
         items!item_id(id, code, name))`,
    )
    .eq('id', transfer.id)
    .single();

  if (fetchErr) return serverError(fetchErr.message);

  return NextResponse.json(result, { status: 201 });
}
