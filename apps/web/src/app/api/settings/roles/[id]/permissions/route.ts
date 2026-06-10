import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = (await request.json()) as { permissionIds?: string[] };
    const permissionIds = body.permissionIds ?? [];

    const { data: role } = await service
      .schema('icecream_erp')
      .from('roles')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!role) return notFound('Role not found.');

    await service
      .schema('icecream_erp')
      .from('role_permissions')
      .delete()
      .eq('role_id', id);

    if (permissionIds.length > 0) {
      await service
        .schema('icecream_erp')
        .from('role_permissions')
        .insert(permissionIds.map((pid) => ({ role_id: id, permission_id: pid })));
    }

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'ROLE_PERMISSIONS_UPDATED',
      entity_id: id,
      entity_type: 'role',
      new_values: { permissionIds },
      user_profile_id: ctx.userId,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
