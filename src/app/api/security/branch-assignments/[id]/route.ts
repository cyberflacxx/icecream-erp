import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'settings.write', 'settings.manage')) return forbidden();

  const { id } = await params;
  const body = (await request.json()) as { effectiveDate?: string; isActive?: boolean; roleName?: string };
  const updates: Record<string, unknown> = {};
  if (body.roleName !== undefined) updates.role_name = body.roleName;
  if (body.effectiveDate !== undefined) updates.effective_date = body.effectiveDate;
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  updates.updated_by = ctx.userId;

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service.from('user_branch_assignments').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) return notFound('Branch assignment not found.');

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'USER_BRANCH_ASSIGNMENT_UPDATED',
      entityType: 'user_branch_assignment',
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
