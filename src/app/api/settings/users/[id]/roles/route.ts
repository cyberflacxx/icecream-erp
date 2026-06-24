import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { resolveRegistrationRole, syncUserBranchAssignment, toStoredUserRole } from '@/lib/registration';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parseUserPhoneValue, serializeUserPhoneValue } from '@/lib/user-access-profile';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    const body = (await request.json()) as { roleIds?: string[]; role?: string };
    const roleId = body.role ?? body.roleIds?.[0];
    if (!roleId) return badRequest('role or roleIds must be provided.');

    const role = await resolveRegistrationRole(schemaService, roleId);
    if (!role) return badRequest('Selected role is not available.');

    const { data: user, error: findError } = await schemaService
      .from('users')
      .select('id, role, branch_id, phone')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError || !user) return notFound('User not found.');
    if (role.requiresBranch && !user.branch_id) return badRequest('Assign a branch before applying this role.');

    const { error } = await schemaService
      .from('users')
      .update({
        role: toStoredUserRole(role.legacyRole),
        phone: serializeUserPhoneValue({
          accessProfile: role.legacyRole,
          phone: parseUserPhoneValue(user.phone).phone,
        }),
      })
      .eq('id', id);

    if (error) throw error;

    await syncUserBranchAssignment({
      assignedBy: ctx.userId,
      branchId: String(user.branch_id ?? ''),
      roleName: role.name,
      service: schemaService,
      userProfileId: id,
    });

    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'USER_ROLE_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: { role: user.role },
      newValues: { role: toStoredUserRole(role.legacyRole), roleName: role.name, accessProfile: role.legacyRole },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true, role: toStoredUserRole(role.legacyRole), roleName: role.name, accessProfile: role.legacyRole });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
