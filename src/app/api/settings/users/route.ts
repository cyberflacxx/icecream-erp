import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveAdminActionKeyValidation } from '@/lib/admin-delete-server';
import { workIdToEmail } from '@/lib/auth-roles';
import { assignUserRole, generateNextWorkId, getPrimaryOrganizationId, resolveRegistrationRole, syncUserBranchAssignment, toStoredUserRole } from '@/lib/registration';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parseUserPhoneValue, serializeUserPhoneValue } from '@/lib/user-access-profile';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    let query = schemaService
      .from('users')
      .select('id, work_id, email, full_name, first_name, last_name, phone, role, status, branch_id, branches(id, code, name)', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,work_id.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status.toLowerCase());
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: users, count, error } = await query.range(from, to);

    if (error) throw error;

    const userIds = (users ?? []).map((user) => String((user as Record<string, unknown>).id ?? ''));
    let assignmentRoleMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const { data: assignments } = await schemaService
          .from('user_branch_assignments')
          .select('user_profile_id, role_name')
          .in('user_profile_id', userIds)
          .eq('is_active', true);
        assignmentRoleMap = new Map(
          (assignments ?? [])
            .filter((assignment) => assignment.user_profile_id && assignment.role_name)
            .map((assignment) => [String(assignment.user_profile_id), String(assignment.role_name)]),
        );
      } catch {}
    }

    return NextResponse.json({
      data: (users ?? []).map((u: Record<string, unknown>) => ({
        ...(() => {
          const phoneMeta = parseUserPhoneValue(u.phone);
          const accessProfile = phoneMeta.accessProfile ?? assignmentRoleMap.get(String(u.id)) ?? String(u.role ?? 'staff');
          return {
            id: u.id,
            email: u.email,
            fullName: u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
            workId: u.work_id,
            role: accessProfile,
            status: String(u.status ?? 'active').toLowerCase(),
            roles: [{ id: String(u.role ?? 'staff'), name: accessProfile }],
            branch: formatBranch(u.branches as { id?: string; code?: string; name?: string } | Array<{ id?: string; code?: string; name?: string }> | null | undefined),
          };
        })(),
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.write')) return forbidden();

  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  try {
    const body = (await request.json().catch(() => ({}))) as {
      adminKey?: string;
      admin_key?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      idNumber?: string;
      roleId?: string;
      branchId?: string | null;
    };

    const { firstName, lastName, email, idNumber, roleId, branchId } = body;
    const adminKeyInput = String(body.adminKey ?? body.admin_key ?? '').trim();

    const adminKeyValidation = resolveAdminActionKeyValidation({
      body: { adminKey: adminKeyInput },
      messages: {
        invalid: 'Invalid admin key.',
        notConfigured: 'Admin action key is not configured.',
        required: 'Admin key is required.',
      },
      request,
    });

    if (adminKeyValidation.error === 'Admin action key is not configured.') {
      return NextResponse.json({ error: adminKeyValidation.error }, { status: 500 });
    }
    if (adminKeyValidation.error === 'Admin key is required.') {
      return NextResponse.json({ error: adminKeyValidation.error }, { status: 400 });
    }
    if (adminKeyValidation.error === 'Invalid admin key.') {
      return NextResponse.json({ error: adminKeyValidation.error }, { status: 403 });
    }

    if (!firstName?.trim()) return badRequest('First name is required.');
    if (!lastName?.trim()) return badRequest('Last name is required.');
    if (!email?.trim()) return badRequest('Email is required.');
    if (!idNumber?.trim()) return badRequest('ID number is required.');
    if (!roleId?.trim()) return badRequest('Role is required.');

    const normalizedEmail = email.trim().toLowerCase();

    // Check email not taken
    const { data: existing } = await schemaService
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existing) return badRequest('Email address is already registered.');

    const role = await resolveRegistrationRole(schemaService, roleId);
    if (!role) return badRequest('Role is not available.');
    if (role.requiresBranch && !branchId) return badRequest('Branch is required for the selected role.');

    if (branchId) {
      const { data: branch } = await schemaService
        .from('branches')
        .select('id, status')
        .eq('id', branchId)
        .maybeSingle();
      if (!branch || String(branch.status ?? '').toUpperCase() !== 'ACTIVE') {
        return badRequest('Selected branch is not available.');
      }
    }

    const [workId, organizationId] = await Promise.all([
      generateNextWorkId(schemaService),
      getPrimaryOrganizationId(schemaService),
    ]);
    const syntheticEmail = workIdToEmail(workId);

    // Derive initial password from ID number (no dashes/spaces, lowercase)
    const initialPassword = idNumber.trim().replace(/[-\s]/g, '').toLowerCase();
    if (initialPassword.length < 6) return badRequest('ID number too short to derive a secure password.');

    // Create Supabase Auth user
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email: syntheticEmail,
      password: initialPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return serverError(authError?.message ?? 'Failed to create authentication account.');
    }

    // Insert user profile
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { data: profile, error: profileError } = await schemaService
      .from('users')
      .insert({
        auth_id: authData.user.id,
        work_id: workId,
        email: normalizedEmail,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: idNumber.trim().toUpperCase(),
        phone: serializeUserPhoneValue({ accessProfile: role.legacyRole }),
        organization_id: organizationId,
        role: toStoredUserRole(role.legacyRole),
        branch_id: branchId ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id);
      return serverError(profileError.message);
    }

    await assignUserRole({
      assignedBy: ctx.userId,
      roleId: role.id,
      service: schemaService,
      userProfileId: String(profile.id),
    });
    await syncUserBranchAssignment({
      assignedBy: ctx.userId,
      branchId: branchId ?? null,
      roleName: role.name,
      service: schemaService,
      userProfileId: String(profile.id),
    });

    try {
      await service.schema('icecream_erp').from('audit_logs').insert({
        action: 'USER_CREATED',
        entity_id: String(profile.id),
        entity_type: 'user',
        user_profile_id: ctx.userId,
      });
    } catch {}

    return NextResponse.json({
      id: profile.id,
      email: normalizedEmail,
      fullName,
      workId,
      status: 'active',
      roles: [{ id: role.id, name: role.name }],
      branch: branchId ? await resolveBranchSummary(schemaService, branchId) : null,
    }, { status: 201 });
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

async function resolveBranchSummary(
  service: ReturnType<ReturnType<typeof createServiceRoleClient>['schema']>,
  branchId: string,
) {
  const { data } = await service.from('branches').select('id, code, name').eq('id', branchId).maybeSingle();
  return data ? { id: String(data.id), name: String(data.name ?? data.code ?? data.id) } : null;
}
