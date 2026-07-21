import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { deriveRequisitionWorkflowStatus } from '@/lib/procurement-workflow';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let remarks: string | null = null;
  try {
    const body = await request.json();
    remarks = body.remarks ?? null;
  } catch {
    // remarks is optional
  }

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_requisitions')
      .select('id, status, approval_status, approved_at, approved_by, rejected_at, remarks, approver_user_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase requisition not found.');

    const req = existing as Record<string, unknown>;
    if (
      deriveRequisitionWorkflowStatus({
        approvalStatus: req.approval_status,
        approvedAt: req.approved_at,
        approvedBy: req.approved_by,
        rejectedAt: req.rejected_at,
        status: req.status,
      }) !== 'PENDING_APPROVAL'
    ) {
      return badRequest('Only pending approval requisitions can be rejected.');
    }
    if (req.approver_user_id && String(req.approver_user_id) !== ctx.userId) {
      return forbidden();
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_requisitions')
      .update({
        status: 'rejected',
        approval_status: 'rejected',
        rejected_by: ctx.userId,
        rejected_at: new Date().toISOString(),
        remarks: remarks ?? (req.remarks as string | null),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
