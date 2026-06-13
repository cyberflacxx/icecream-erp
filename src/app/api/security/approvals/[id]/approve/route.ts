import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { approveWorkflowRequest } from '@/lib/workflow-server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'approve_journal', 'approve_invoice', 'approve_purchase_order', 'settings.manage')) return forbidden();

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string; comment?: string };
  try {
    const result = await approveWorkflowRequest({
      comment: body.comment ?? body.reason,
      ctx,
      id,
      requestMeta: {
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
