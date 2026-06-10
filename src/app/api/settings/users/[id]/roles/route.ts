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
    const body = (await request.json()) as { roleIds?: string[]; role?: string };
    const roleId = body.role ?? body.roleIds?.[0];
    if (!roleId) return badRequest('role or roleIds must be provided.');

    const { data: user, error: findError } = await service
      .from('users')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError || !user) return notFound('User not found.');

    const { error } = await service
      .from('users')
      .update({ role: roleId })
      .eq('id', id);

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'USER_ROLE_UPDATED',
      entity_id: id,
      entity_type: 'user',
      new_values: { roleId },
      user_profile_id: ctx.userId,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
