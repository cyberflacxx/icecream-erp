import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, unauthorized } from '@/lib/api-auth';
import {
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
} from '@/lib/finance-foundation-server';
import { toDateOnly } from '@/lib/finance-integration';
import { buildInventoryPostingIdempotencyKey, loadWarehouseBranchId } from '@/lib/inventory-posting-server';
import { mapInventoryReversalError, reverseStockTransferReceipt } from '@/lib/inventory-reversal-server';
import { requireWarehouseAccess } from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function parseReason(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.reverse_receipt', 'inventory.write')) return forbidden();

  try {
    const { id } = await params;
    const service = createServiceRoleClient();
    const { data: transfer, error } = await service
      .from('stock_transfers')
      .select('id, from_warehouse_id, to_warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!transfer) return notFound('Stock transfer not found.');

    const fromWarehouseId = String(transfer.from_warehouse_id ?? '').trim();
    const toWarehouseId = String(transfer.to_warehouse_id ?? '').trim();
    if (!fromWarehouseId || !toWarehouseId) {
      return badRequest('Stock transfer is missing its warehouse routing.');
    }

    await Promise.all([
      requireWarehouseAccess(service, fromWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
      requireWarehouseAccess(service, toWarehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);
    const branchId = await loadWarehouseBranchId(service as never, toWarehouseId);
    const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
      branchId,
      preferredCodes: getFinanceModuleDefaultCostCentreCodes('inventory'),
    });

    const body = await request.json().catch(() => ({})) as { reason?: string | null; reversalReason?: string | null };
    const reason = parseReason(body.reason ?? body.reversalReason);
    if (!reason) return badRequest('Reversal reason is required.');

    const result = await reverseStockTransferReceipt({
      actorUserId: ctx.userId,
      branchId,
      costCenterCode,
      idempotencyKey: buildInventoryPostingIdempotencyKey({
        actorUserId: ctx.userId,
        documentId: id,
        operation: 'stock_transfer_receipt_reverse',
      }),
      journalDate: toDateOnly(new Date().toISOString()),
      organizationId: ctx.organizationId,
      reason,
      transferId: id,
    });

    return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
  } catch (error) {
    const mapped = mapInventoryReversalError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
