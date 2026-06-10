import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateWorkId, workIdToEmail } from '@/lib/auth-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

  try {
    let query = service
      .from('users')
      .select('id, work_id, email, full_name, first_name, last_name, role, status, branch_id', { count: 'exact' })
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

    return NextResponse.json({
      data: (users ?? []).map((u: Record<string, unknown>) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        workId: u.work_id,
        status: String(u.status ?? 'active').toLowerCase(),
        roles: [{ id: String(u.role ?? 'staff'), name: String(u.role ?? 'staff') }],
        branch: null,
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

  try {
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      idNumber?: string;
      roleId?: string;
      branchId?: string | null;
    };

    const { firstName, lastName, email, idNumber, roleId, branchId } = body;

    if (!firstName?.trim()) return badRequest('First name is required.');
    if (!lastName?.trim()) return badRequest('Last name is required.');
    if (!email?.trim()) return badRequest('Email is required.');
    if (!idNumber?.trim()) return badRequest('ID number is required.');
    if (!roleId?.trim()) return badRequest('Role is required.');

    const normalizedEmail = email.trim().toLowerCase();

    // Check email not taken
    const { data: existing } = await service
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existing) return badRequest('Email address is already registered.');

    // Generate Work ID
    const { count } = await service.from('users').select('id', { count: 'exact', head: true });
    const workId = generateWorkId(count ?? 0);
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
    const { data: profile, error: profileError } = await service
      .from('users')
      .insert({
        auth_id: authData.user.id,
        work_id: workId,
        email: normalizedEmail,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: idNumber.trim().toUpperCase(),
        role: roleId,
        branch_id: branchId ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (profileError) {
      await service.auth.admin.deleteUser(authData.user.id);
      return serverError(profileError.message);
    }

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'USER_CREATED',
      entity_id: String(profile.id),
      entity_type: 'user',
      user_profile_id: ctx.userId,
    }).catch(() => {});

    return NextResponse.json({
      id: profile.id,
      email: normalizedEmail,
      fullName,
      workId,
      status: 'active',
      roles: [{ id: roleId, name: roleId }],
      branch: null,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
