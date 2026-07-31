import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { processInventoryApproval } from '@/lib/inventory-approvals-server';

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function mapApprovalProcessResult(result: Awaited<ReturnType<typeof processInventoryApproval>>) {
  if (result.success) {
    return NextResponse.json({ success: true, data: result.data });
  }

  switch (result.code) {
    case 'invalid_action':
    case 'invalid_input':
      return badRequest(result.message ?? 'Invalid approval request.');
    case 'not_found':
      return notFound('Approval request not found.');
    case 'already_processed':
      return conflict(result.message ?? 'Approval request has already been processed.');
    default:
      return serverError('Failed to process approval.');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'procurement.approve')) return forbidden();

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { comments?: string };

  try {
    const result = await processInventoryApproval({
      action: 'APPROVE',
      approvalId: id,
      comments: body.comments ?? null,
      ipAddress: request.headers.get('x-forwarded-for'),
      organizationId: ctx.organizationId,
      userAgent: request.headers.get('user-agent'),
      userId: ctx.userId,
    });

    return mapApprovalProcessResult(result);
  } catch {
    return serverError('Failed to process approval.');
  }
}
