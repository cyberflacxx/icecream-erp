import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isSubmittedGrnStatus(status: unknown) {
  const normalized = String(status ?? '').toUpperCase();
  return normalized === 'SUBMITTED' || normalized === 'PENDING_APPROVAL' || normalized === 'RECEIVED';
}

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
      .select('id, status, warehouse_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Goods received note not found.');

    const grn = existing as Record<string, unknown>;

    // Branch scope check via warehouse
    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: wh } = await service
        .from('warehouses')
        .select('branch_id')
        .eq('id', grn.warehouse_id as string)
        .single();
      if (!wh || (wh as Record<string, unknown>).branch_id !== ctx.branchId) {
        return forbidden();
      }
    }

    if (!isSubmittedGrnStatus(grn.status)) {
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
      newValues: { status: 'RECEIVED', qualityStatus: 'APPROVED' },
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
