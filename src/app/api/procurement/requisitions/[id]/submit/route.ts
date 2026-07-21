import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
import { deriveRequisitionWorkflowStatus } from '@/lib/procurement-workflow';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { submitWorkflowApproval } from '@/lib/workflow-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_requisitions')
      .select('id, requisition_number, status, approval_status, approved_at, approved_by, rejected_at')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase requisition not found.');
    if (
      deriveRequisitionWorkflowStatus({
        approvalStatus: (existing as Record<string, unknown>).approval_status,
        approvedAt: (existing as Record<string, unknown>).approved_at,
        approvedBy: (existing as Record<string, unknown>).approved_by,
        rejectedAt: (existing as Record<string, unknown>).rejected_at,
        status: (existing as Record<string, unknown>).status,
      }) !== 'DRAFT'
    ) {
      return badRequest('Only draft requisitions can be submitted.');
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_requisitions')
      .update({
        approval_status: 'submitted',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    let workflowRequest: unknown = null;
    let workflowWarning: string | null = null;

    try {
      workflowRequest = await submitWorkflowApproval({
        body: {
          documentId: id,
          documentReference: String((existing as Record<string, unknown>).requisition_number ?? id),
          documentType: 'purchase_requisition',
          module: 'procurement',
          reason: 'Purchase requisition submitted for approval.',
        },
        ctx,
        requestMeta: {
          ipAddress: _request.headers.get('x-forwarded-for'),
          userAgent: _request.headers.get('user-agent'),
        },
      });
    } catch (error) {
      workflowWarning = error instanceof Error ? error.message : 'Workflow submission failed.';
    }

    await emitOperationalNotifications({
      actorUserId: ctx.userId,
      documentId: id,
      documentType: 'purchase_requisition',
      eventType: 'PURCHASE_REQUISITION_SUBMITTED',
      message: 'A purchase requisition has been submitted for approval.',
      metadata: {
        requisitionId: id,
      },
      moduleName: 'procurement',
      organizationId: ctx.organizationId,
      recipientRoleNames: ['Procurement Manager', 'Approver'],
      severity: 'MEDIUM',
      title: 'Purchase requisition submitted',
    }).catch(() => null);

    return NextResponse.json({ requisition: updated, submitted: true, workflowRequest, workflowWarning });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
