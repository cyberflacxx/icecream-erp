import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.approve', 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

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

    const { data: updated, error: updateErr } = await service
      .from('goods_received_notes')
      .update({ quality_status: 'APPROVED' })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    await recordAuditLog({
      action: 'GRN_APPROVED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: { qualityStatus: 'APPROVED' },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: _request.headers.get('x-forwarded-for'),
      userAgent: _request.headers.get('user-agent'),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
