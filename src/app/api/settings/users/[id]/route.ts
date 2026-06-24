import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { resolveRegistrationRole, syncUserBranchAssignment, toStoredUserRole } from '@/lib/registration';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parseUserPhoneValue, serializeUserPhoneValue } from '@/lib/user-access-profile';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    const { data: user, error } = await schemaService
      .from('users')
      .select('id, work_id, email, full_name, first_name, last_name, phone, role, status, branch_id, auth_id, branches(id, code, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !user) return notFound('User not found.');

    const phoneMeta = parseUserPhoneValue(user.phone);
    let accessProfile = phoneMeta.accessProfile ?? String(user.role ?? 'staff');
    try {
      const { data: assignment } = await schemaService
        .from('user_branch_assignments')
        .select('role_name')
        .eq('user_profile_id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (assignment?.role_name) accessProfile = String(assignment.role_name);
    } catch {}

    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      workId: user.work_id,
      role: accessProfile,
      status: String(user.status ?? 'active').toLowerCase(),
      roles: [{ id: String(user.role ?? 'staff'), name: accessProfile }],
      branch: formatBranch(user.branches),
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
  if (!can(ctx, 'users.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    const body = (await request.json()) as {
      branchId?: string | null;
      email?: string;
      firstName?: string;
      idNumber?: string;
      lastName?: string;
      roleId?: string;
      status?: string;
    };

    const { data: existingUser, error: existingError } = await schemaService
      .from('users')
      .select('id, role, branch_id, email, phone, first_name, last_name')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError || !existingUser) return notFound('User not found.');

    const updates: Record<string, unknown> = {};

    if (body.firstName !== undefined) updates.first_name = String(body.firstName).trim();
    if (body.lastName !== undefined) updates.last_name = String(body.lastName).trim();
    if (body.idNumber !== undefined) updates.id_number = String(body.idNumber).trim().toUpperCase();
    if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase();
    if (body.status !== undefined) updates.status = String(body.status).trim().toLowerCase();

    let resolvedRoleName: string | null = null;
    if (body.roleId) {
      const role = await resolveRegistrationRole(schemaService, body.roleId);
      if (!role) return badRequest('Role is not available.');
      updates.role = toStoredUserRole(role.legacyRole);
      updates.phone = serializeUserPhoneValue({
        accessProfile: role.legacyRole,
        phone: parseUserPhoneValue(existingUser.phone).phone,
      });
      resolvedRoleName = role.name;
      if (role.requiresBranch && !('branchId' in body ? body.branchId : existingUser.branch_id)) {
        return badRequest('Branch is required for the selected role.');
      }
    }

    if ('branchId' in body) {
      if (body.branchId) {
        const { data: branch } = await schemaService
          .from('branches')
          .select('id, status')
          .eq('id', body.branchId)
          .maybeSingle();
        if (!branch || String(branch.status ?? '').toUpperCase() !== 'ACTIVE') {
          return badRequest('Selected branch is not available.');
        }
      }
      updates.branch_id = body.branchId ?? null;
    }

    if ('first_name' in updates || 'last_name' in updates) {
      const firstName = String(updates.first_name ?? existingUser.first_name ?? '').trim();
      const lastName = String(updates.last_name ?? existingUser.last_name ?? '').trim();
      if (firstName || lastName) {
        updates.full_name = `${firstName} ${lastName}`.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('No updates were provided.');
    }

    const { data: updatedUser, error: updateError } = await schemaService
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, work_id, email, full_name, first_name, last_name, phone, role, status, branch_id, branches(id, code, name)')
      .single();

    if (updateError) throw updateError;

    if ('branch_id' in updates || resolvedRoleName) {
      await syncUserBranchAssignment({
        assignedBy: ctx.userId,
        branchId: (updates.branch_id as string | null | undefined) ?? existingUser.branch_id,
        roleName: resolvedRoleName ?? String(updatedUser.role ?? existingUser.role ?? ''),
        service: schemaService,
        userProfileId: id,
      });
    }

    await recordAuditLog({
      action: 'USER_UPDATED',
      entityId: id,
      entityType: 'user',
      newValues: updates,
      oldValues: existingUser as Record<string, unknown>,
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      ...(function buildResponse() {
        const updatedPhoneMeta = parseUserPhoneValue(updatedUser.phone);
        const accessProfile = updatedPhoneMeta.accessProfile ?? resolvedRoleName ?? String(updatedUser.role ?? 'staff');
        return {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.full_name ?? `${updatedUser.first_name ?? ''} ${updatedUser.last_name ?? ''}`.trim(),
          workId: updatedUser.work_id,
          role: accessProfile,
          status: String(updatedUser.status ?? 'active').toLowerCase(),
          roles: [{ id: String(updatedUser.role ?? 'staff'), name: accessProfile }],
          branch: formatBranch(updatedUser.branches),
        };
      })(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.delete', 'users.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    const { data: existingUser, error: existingError } = await schemaService
      .from('users')
      .select('id, auth_id, full_name, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (existingError || !existingUser || existingUser.deleted_at) {
      return notFound('User not found.');
    }

    const deletedAt = new Date().toISOString();

    const { error: deleteError } = await schemaService
      .from('users')
      .update({ deleted_at: deletedAt, status: 'inactive' })
      .eq('id', id);

    if (deleteError) throw deleteError;

    await syncUserBranchAssignment({
      assignedBy: ctx.userId,
      branchId: null,
      roleName: null,
      service: schemaService,
      userProfileId: id,
    });

    if (existingUser.auth_id) {
      await service.auth.admin.deleteUser(String(existingUser.auth_id)).catch(() => null);
    }

    await recordAuditLog({
      action: 'USER_DELETED',
      entityId: id,
      entityType: 'user',
      newValues: { deleted_at: deletedAt, status: 'inactive' },
      oldValues: existingUser as Record<string, unknown>,
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

function formatBranch(
  branchValue:
    | { id?: string; code?: string; name?: string }
    | Array<{ id?: string; code?: string; name?: string }>
    | null
    | undefined,
) {
  const branch = Array.isArray(branchValue) ? branchValue[0] : branchValue;
  if (!branch?.id) return null;
  return {
    id: String(branch.id),
    name: String(branch.name ?? branch.code ?? branch.id),
  };
}
