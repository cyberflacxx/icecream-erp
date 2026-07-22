import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isGrnStockPostingError, postGoodsReceivedNoteToInventory } from '@/lib/procurement-goods-received';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.approve', 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  let approvalNotes: string | null = null;

  try {
    const body = await request.json();
    approvalNotes = typeof body?.approvalNotes === 'string'
      ? body.approvalNotes.trim() || null
      : typeof body?.remarks === 'string'
        ? body.remarks.trim() || null
        : null;
  } catch {}

  try {
    const { data: existing, error: fetchErr } = await service
      .from('goods_received_notes')
      .select('id, status, quality_status, warehouse_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Goods received note not found.');

    const grn = existing as Record<string, unknown>;

    // Central warehouses have no branch_id. Branch-scoped users may also work
    // against an explicitly assigned warehouse even when it belongs elsewhere.
    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: wh, error: whError } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', grn.warehouse_id as string)
        .maybeSingle();
      if (whError) return serverError(whError.message);

      const warehouseBranchId = wh?.branch_id ? String(wh.branch_id) : null;
      const hasWarehouseAssignment = ctx.warehouseAssignments.includes(String(grn.warehouse_id ?? ''));
      if (warehouseBranchId && warehouseBranchId !== ctx.branchId && !hasWarehouseAssignment) {
        return forbidden();
      }
    }

    if (grn.status === 'REJECTED' || grn.status === 'POSTED') {
      return badRequest('Only submitted GRNs can be approved.');
    }
    if (grn.quality_status !== 'PENDING_APPROVAL') {
      return badRequest('Only submitted GRNs can be approved.');
    }

    const { data: updatedApproval, error: updateErr } = await service
      .from('goods_received_notes')
      .update({
        approval_notes: approvalNotes,
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        quality_status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    let updated = updatedApproval;
    try {
      updated = await postGoodsReceivedNoteToInventory(service, {
        grnId: id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });
    } catch (postingError) {
      const message = postingError instanceof Error ? postingError.message : 'Failed to post GRN to inventory.';
      const details = isGrnStockPostingError(postingError) ? postingError.details : undefined;
      if (message === 'Please select a receiving warehouse before posting GRN.') {
        return NextResponse.json({
          success: false,
          message,
          code: 'GRN_STOCK_POST_FAILED',
          details,
        }, { status: 400 });
      }
      console.error('GRN inventory posting failed.', {
        grnId: id,
        details,
        message,
      });
      return NextResponse.json({
        success: false,
        message: 'Goods received note could not update inventory. Please check warehouse and item details.',
        code: 'GRN_STOCK_POST_FAILED',
        details,
      }, { status: 500 });
    }

    await recordAuditLog({
      action: 'GRN_POSTED_TO_STOCK',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: { approvalNotes, qualityStatus: 'APPROVED', status: 'POSTED' },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('GRN approval failed.', {
      details: isGrnStockPostingError(err) ? err.details : undefined,
      grnId: id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      success: false,
      message: 'Goods received note could not update inventory. Please check warehouse and item details.',
      code: 'GRN_STOCK_POST_FAILED',
      details: isGrnStockPostingError(err) ? err.details : undefined,
    }, { status: 500 });
  }
}
