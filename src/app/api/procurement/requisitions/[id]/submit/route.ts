import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
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
      .select('id, status')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase requisition not found.');
    if ((existing as Record<string, unknown>).status !== 'draft') {
      return badRequest('Only draft requisitions can be submitted.');
    }

    const workflowRequest = await submitWorkflowApproval({
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
    });

    return NextResponse.json({ submitted: true, workflowRequest });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
