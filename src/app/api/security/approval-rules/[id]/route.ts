import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.write', 'approve_journal', 'settings.manage')) return forbidden();

  const { id } = await params;
  const body = (await request.json()) as { description?: string | null; isActive?: boolean; name?: string };
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service.from('approval_workflows').update(updates).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (!data) return notFound('Approval rule not found.');

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'APPROVAL_RULE_UPDATED',
      entityType: 'approval_workflow',
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
