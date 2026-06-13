import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'settings.read', 'settings.manage')) return forbidden();

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service
      .from('user_branch_assignments')
      .select('id, user_profile_id, branch_id, role_name, effective_date, is_active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'settings.write', 'settings.manage')) return forbidden();

  const body = (await request.json()) as { branchId?: string; effectiveDate?: string; roleName?: string; userProfileId?: string };
  if (!body.userProfileId || !body.branchId) return badRequest('User and branch are required.');

  const service = createServiceRoleClient().schema('icecream_erp');
  try {
    const { data, error } = await service
      .from('user_branch_assignments')
      .insert({
        user_profile_id: body.userProfileId,
        branch_id: body.branchId,
        role_name: body.roleName ?? null,
        effective_date: body.effectiveDate ?? new Date().toISOString().slice(0, 10),
        is_active: true,
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'USER_BRANCH_ASSIGNED',
      entityType: 'user_branch_assignment',
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
