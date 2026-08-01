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
import { loadInventoryReversalSnapshots } from '@/lib/inventory-reversal-server';
import { normalizeTransferStatus, resolveTransferWriteStatus } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.view', 'inventory.read', 'stock_transfer.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('stock_transfers')
    .select(
      `id, transfer_number, transfer_date, status, notes, from_warehouse_id, to_warehouse_id,
       stock_transfer_items(id, item_id, quantity_requested, quantity_sent, quantity_received, unit_cost, items!item_id(id, code, name)),
       fromWarehouse:warehouses!from_warehouse_id(id, code, name),
       toWarehouse:warehouses!to_warehouse_id(id, code, name)`,
    )
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Stock transfer not found.');
  const reversals = (await loadInventoryReversalSnapshots(service, 'stock_transfer', [id])).get(id) ?? [];
  const dispatchReversal = reversals.find((entry) => entry.operationType === 'stock_transfer_dispatch_reverse') ?? null;
  const receiptReversal = reversals.find((entry) => entry.operationType === 'stock_transfer_receipt_reverse') ?? null;
  const reversal = dispatchReversal ?? receiptReversal ?? reversals[0] ?? null;

  return NextResponse.json({
    ...data,
    dispatchReversal,
    receiptReversal,
    reversal,
    status: dispatchReversal ? 'REVERSED' : normalizeTransferStatus(String(data.status ?? '')),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.edit', 'inventory.write', 'stock_transfer.create')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
    status?: string;
    transferDate?: string;
  };

  const { data: existing, error: existingError } = await service
    .from('stock_transfers')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) return serverError(existingError.message);
  if (!existing) return notFound('Stock transfer not found.');
  if (normalizeTransferStatus(String(existing.status ?? '')) === 'COMPLETED') {
    return badRequest('Completed transfers cannot be edited.');
  }

  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes ?? null;
  if (body.transferDate !== undefined) updates.transfer_date = new Date(body.transferDate).toISOString();
  if (body.status !== undefined) {
    const nextStatus = normalizeTransferStatus(body.status);
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'].includes(nextStatus)) {
      return badRequest('Unsupported transfer status.');
    }
    updates.status = resolveTransferWriteStatus(nextStatus);
  }

  const { data, error } = await service
    .from('stock_transfers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json({
    ...data,
    status: normalizeTransferStatus(String(data.status ?? '')),
  });
}
