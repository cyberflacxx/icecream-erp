import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: role, error } = await service
      .schema('icecream_erp')
      .from('roles')
      .select('id, name, description, is_system_role, role_permissions(permissions(id, code, module)), user_roles(id)')
      .eq('id', id)
      .single();

    if (error || !role) return notFound('Role not found.');

    return NextResponse.json({
      id: role.id,
      name: role.name,
      description: role.description ?? null,
      isSystemRole: role.is_system_role ?? false,
      permissions: ((role.role_permissions as Array<{ permissions: { id: string; code: string; module: string } }>) ?? []).map((rp) => rp.permissions),
      userCount: Array.isArray(role.user_roles) ? role.user_roles.length : 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

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
    const body = (await request.json()) as { name?: string; description?: string | null };
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    const { data: role, error } = await service
      .schema('icecream_erp')
      .from('roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !role) return notFound('Role not found.');

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'ROLE_UPDATED',
      entity_id: id,
      entity_type: 'role',
      user_profile_id: ctx.userId,
    }).catch(() => {});

    return NextResponse.json(role);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
