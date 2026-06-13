import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read', 'approve_journal', 'settings.manage')) return forbidden();

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service
      .from('approval_workflows')
      .select('id, name, entity_type, description, is_active, approval_workflow_steps(id, step_number, role_id, is_required)')
      .is('deleted_at', null)
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
  if (!can(ctx, 'settings.write', 'approve_journal', 'settings.manage')) return forbidden();

  const body = (await request.json()) as {
    action?: string;
    documentType?: string;
    minimumAmount?: number;
    module?: string;
    requiredRoleId?: string;
  };

  if (!body.module || !body.documentType || !body.action || !body.requiredRoleId) {
    return badRequest('module, documentType, action, and requiredRoleId are required.');
  }

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data: workflow, error } = await service
      .from('approval_workflows')
      .insert({
        organization_id: ctx.organizationId,
        name: `${body.module}:${body.documentType}:${body.action}`,
        entity_type: `${body.module}.${body.documentType}`,
        description: body.minimumAmount ? `Minimum amount ${body.minimumAmount}` : null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;

    await service.from('approval_workflow_steps').insert({
      workflow_id: (workflow as Record<string, unknown>).id,
      step_number: 1,
      level: 'LEVEL_ONE',
      role_id: body.requiredRoleId,
      is_required: true,
    });

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'APPROVAL_RULE_CREATED',
      entityType: 'approval_workflow',
      entityId: String((workflow as Record<string, unknown>).id),
      newValues: body as Record<string, unknown>,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
