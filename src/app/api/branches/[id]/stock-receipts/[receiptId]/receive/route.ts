import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, getActiveBranchWarehouse, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write', 'inventory.write')) return forbidden();

  const { id, receiptId } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      items?: Array<{ damagedQuantity?: number; itemId: string; quantityReceived: number; quantitySent: number; shortageQuantity?: number }>;
      remarks?: string;
    };

    const { data: receipt, error: receiptError } = await service
      .from('branch_stock_receipts')
      .select('id, status')
      .eq('id', receiptId)
      .eq('branch_id', id)
      .maybeSingle();
    if (receiptError) throw receiptError;
    if (!receipt) return badRequest('Receipt not found');
    if (receipt.status !== 'PENDING') return badRequest('Only PENDING receipts can be received');

    const warehouse = await getActiveBranchWarehouse(id);
    const items = body.items ?? [];
    for (const item of items) {
      const received = Number(item.quantityReceived ?? 0);
      if (received < 0) return badRequest('Received quantity must not be negative');

      const { data: existingBalance } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('warehouse_id', warehouse.id)
        .eq('item_id', item.itemId)
        .maybeSingle();

      if (existingBalance) {
        await service
          .from('stock_balances')
          .update({
            quantity_on_hand: Number(existingBalance.quantity_on_hand ?? 0) + received,
            quantity_available: Number(existingBalance.quantity_available ?? 0) + received,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existingBalance.id);
      }

      await service.from('branch_stock_receipt_items').insert({
        branch_stock_receipt_id: receiptId,
        item_id: item.itemId,
        quantity_sent: item.quantitySent,
        quantity_received: received,
        shortage_quantity: item.shortageQuantity ?? Math.max(0, Number(item.quantitySent ?? 0) - received),
        damaged_quantity: item.damagedQuantity ?? 0,
      });

      await service.from('branch_stock_ledger').insert({
        branch_id: id,
        warehouse_id: warehouse.id,
        item_id: item.itemId,
        reference_id: receiptId,
        reference_type: 'branch_stock_receipt',
        movement_type: 'RECEIPT',
        quantity: received,
        total_cost: 0,
        unit_cost: 0,
        created_by: ctx.userId,
      });
    }

    const status = items.some((item) => Number(item.quantityReceived ?? 0) < Number(item.quantitySent ?? 0)) ? 'PARTIALLY_RECEIVED' : 'RECEIVED';
    const { data, error } = await service
      .from('branch_stock_receipts')
      .update({
        received_by: ctx.userId,
        received_date: new Date().toISOString().slice(0, 10),
        remarks: body.remarks ?? null,
        status,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
      })
      .eq('id', receiptId)
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_STOCK_RECEIPT_RECEIVED', receiptId, ctx.userId, { branchId: id, status }, 'branch_stock_receipt');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
