import { NextRequest, NextResponse } from 'next/server';

import {
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  // Verify exists
  const { data: existing, error: fetchErr } = await service
    .from('leave_applications')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Leave request not found');

  const body = await _request.json().catch(() => ({})) as { reason?: string };

  const { data, error } = await service
    .from('leave_applications')
    .update({
      status: 'REJECTED',
      rejected_by: ctx.userId,
      rejected_at: new Date().toISOString(),
      rejection_reason: body.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
