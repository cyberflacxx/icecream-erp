import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_roles', 'settings.write', 'settings.manage')) return forbidden();

  const { id } = await params;
  const body = (await request.json()) as { description?: string | null; module?: string; name?: string };
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.module !== undefined) updates.module = body.module;
  if (body.description !== undefined) updates.description = body.description;

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service.from('permissions').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) return notFound('Permission not found.');

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'PERMISSION_UPDATED',
      entityType: 'permission',
      entityId: id,
      newValues: updates,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
