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
  if (!can(ctx, 'inventory.write', 'sales.write', 'quality.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    finalStockAction?: 'REUSABLE' | 'DAMAGED' | 'QUARANTINE' | 'WASTE';
    invoiceId?: string | null;
    items?: Array<{ itemId: string; quantity: number }>;
    qcNote?: string | null;
    reason?: string;
    returnWarehouseId?: string;
    totalValue?: number;
  };

  if (!body.customerId || !body.returnWarehouseId || !body.reason || !body.items?.length) {
    return badRequest('customerId, returnWarehouseId, reason, and items are required.');
  }

  try {
    await requireWarehouseAccess(service, body.returnWarehouseId, ctx.branchId, ctx.isBranchScoped);

    const { data: customerReturn, error: returnError } = await service
      .from('customer_returns')
      .insert({
        customer_id: body.customerId,
        invoice_id: body.invoiceId ?? null,
        reason: body.reason,
        return_date: new Date().toISOString().slice(0, 10),
        total_value: body.totalValue ?? 0,
        status: 'APPROVED',
        created_by: ctx.userId,
        return_number: `RTN-${Date.now()}`,
      })
      .select()
      .single();

    if (returnError || !customerReturn) {
      return serverError(returnError?.message ?? 'Failed to create goods return.');
    }

    for (const line of body.items) {
      const quantity = quantityOrThrow(line.quantity);
      await applyInventoryDelta(service, {
        itemId: line.itemId,
        quantityDelta: quantity,
        warehouseId: body.returnWarehouseId,
      });
      await recordStockMovement(service, {
        createdBy: ctx.userId,
        itemId: line.itemId,
        movementType: 'CUSTOMER_RETURN',
        notes: [body.reason, body.qcNote, body.finalStockAction].filter(Boolean).join(' | '),
        quantity,
        referenceId: customerReturn.id,
        referenceType: 'customer_return',
        warehouseId: body.returnWarehouseId,
      });
    }

    return NextResponse.json({
      finalStockAction: body.finalStockAction ?? 'QUARANTINE',
      id: customerReturn.id,
      itemsCount: body.items.length,
      qcNote: body.qcNote ?? null,
      status: customerReturn.status,
    }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to process goods return');
  }
}
