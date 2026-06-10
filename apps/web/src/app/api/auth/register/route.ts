import { NextRequest, NextResponse } from 'next/server';

import { ROLES, type UserRole, workIdToEmail } from '@/lib/auth-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

const VALID_ROLES: string[] = ROLES.map((r) => r.id);

function isValidRole(value: string): value is UserRole {
  return VALID_ROLES.includes(value as UserRole);
}

function generateWorkId(seq: number): string {
  const year = new Date().getFullYear();
  return `AQI-${year}${String(seq).padStart(4, '0')}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    first_name?: string;
    last_name?: string;
    id_number?: string;
    email?: string;
    password?: string;
    confirm_password?: string;
    role?: string;
    admin_key?: string;
  };

  const { first_name, last_name, id_number, email, password, confirm_password, role, admin_key } = body;

  // Verify admin key
  const adminKey = process.env.ADMIN_REGISTRATION_KEY ?? process.env.IMPERSONATE_KEY;
  if (!adminKey || admin_key !== adminKey) {
    return NextResponse.json({ error: 'Invalid admin key.' }, { status: 403 });
  }

  // Validate fields
  const fieldErrors: Record<string, string> = {};
  if (!first_name?.trim()) fieldErrors.first_name = 'First name is required.';
  if (!last_name?.trim()) fieldErrors.last_name = 'Last name is required.';
  if (!id_number?.trim()) fieldErrors.id_number = 'ID number is required.';
  if (!email?.trim()) fieldErrors.email = 'Email is required.';
  if (!password || password.length < 8) fieldErrors.password = 'Password must be at least 8 characters.';
  if (password !== confirm_password) fieldErrors.confirm_password = 'Passwords do not match.';
  if (!role || !isValidRole(role)) fieldErrors.role = 'Invalid role selected.';

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // Check if email already registered
  const { data: existing } = await service
    .from('users')
    .select('id')
    .ilike('email', email!.trim().toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  // Generate work ID
  const { count } = await service.from('users').select('id', { count: 'exact', head: true });
  const seq = (count ?? 0) + 1;
  const workId = generateWorkId(seq);
  const syntheticEmail = workIdToEmail(workId);

  // Create Supabase Auth user
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: syntheticEmail,
    password: password!,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? 'Failed to create authentication account.' },
      { status: 500 },
    );
  }

  // Create profile row
  const fullName = `${first_name!.trim()} ${last_name!.trim()}`;
  const { error: profileError } = await service.from('users').insert({
    auth_id: authData.user.id,
    work_id: workId,
    email: email!.trim().toLowerCase(),
    full_name: fullName,
    first_name: first_name!.trim(),
    last_name: last_name!.trim(),
    id_number: id_number!.trim(),
    role,
    status: 'active',
  });

  if (profileError) {
    // Rollback auth user
    await service.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ work_id: workId }, { status: 201 });
}
