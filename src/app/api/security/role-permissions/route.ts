import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_roles', 'settings.read', 'settings.manage')) return forbidden();

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service
      .from('roles')
      .select('id, name, role_permissions(permission_id, permissions(id, code, name, module))')
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_roles', 'settings.write', 'settings.manage')) return forbidden();

  const body = (await request.json()) as { permissionIds?: string[]; roleId?: string };
  if (!body.roleId) return badRequest('roleId is required.');

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    await service.from('role_permissions').delete().eq('role_id', body.roleId);

    if ((body.permissionIds ?? []).length > 0) {
      const { error } = await service.from('role_permissions').insert(
        (body.permissionIds ?? []).map((permissionId) => ({ role_id: body.roleId, permission_id: permissionId })),
      );
      if (error) throw error;
    }

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'role',
      entityId: body.roleId,
      newValues: { permissionIds: body.permissionIds ?? [] },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
