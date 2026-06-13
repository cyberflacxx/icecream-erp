import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'procurement.approve')) return forbidden();

  const service = createServiceRoleClient();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { comments?: string };

  if (!body.comments?.trim()) {
    return badRequest('comments are required when rejecting an approval request.');
  }

  const { data: existing, error: fetchError } = await service
    .from('approval_requests')
    .select('id, current_step, status')
    .eq('id', id)
    .single();

  if (fetchError || !existing) return notFound('Approval request not found.');
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending approvals can be rejected.' }, { status: 400 });
  }

  const { error: actionError } = await service.from('approval_actions').insert({
    approval_request_id: id,
    step_number: existing.current_step,
    level: 'LEVEL2_MANAGER',
    action_by: ctx.userId,
    action: 'REJECTED',
    comments: body.comments,
  });

  if (actionError) return serverError(actionError.message);

  const { data, error } = await service
    .from('approval_requests')
    .update({
      status: 'REJECTED',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
