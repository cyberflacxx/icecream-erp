import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export { GET } from '@/app/api/settings/permissions/route';

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_roles', 'settings.write', 'settings.manage')) return forbidden();

  const body = (await request.json()) as { code?: string; description?: string; module?: string; name?: string };
  if (!body.code?.trim()) return badRequest('Permission key is required.');
  if (!body.name?.trim()) return badRequest('Permission name is required.');
  if (!body.module?.trim()) return badRequest('Module is required.');

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service
      .from('permissions')
      .insert({
        code: body.code.trim(),
        name: body.name.trim(),
        module: body.module.trim(),
        description: body.description?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'PERMISSION_CREATED',
      entityType: 'permission',
      entityId: String((data as Record<string, unknown>).id),
      newValues: data as Record<string, unknown>,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
