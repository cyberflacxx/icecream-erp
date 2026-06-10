import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = (await request.json()) as { status?: string };
    const rawStatus = body.status?.toLowerCase();
    if (!rawStatus || !['active', 'inactive', 'suspended'].includes(rawStatus)) {
      return badRequest('status must be ACTIVE, INACTIVE, or SUSPENDED.');
    }

    const { data: user, error: findError } = await service
      .from('users')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError || !user) return notFound('User not found.');

    const { error } = await service
      .from('users')
      .update({ status: rawStatus })
      .eq('id', id);

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'USER_STATUS_UPDATED',
      entity_id: id,
      entity_type: 'user',
      new_values: { status: rawStatus },
      user_profile_id: ctx.userId,
    }).catch(() => {});

    return NextResponse.json({ id, status: rawStatus.toUpperCase() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
