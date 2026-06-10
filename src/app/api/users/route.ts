import { NextRequest, NextResponse } from 'next/server';

import { generateWorkId, workIdToEmail } from '@/lib/auth-roles';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceRoleClient();

  // Verify caller is admin
  const { data: caller } = await service.from('users').select('role').eq('auth_id', user.id).single();
  if (!caller || !['super_admin', 'branch_manager'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';

  let query = service.from('users').select('*', { count: 'exact' });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,work_id.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data ?? []).map(formatUserRow),
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceRoleClient();

  // Verify caller is admin
  const { data: caller } = await service.from('users').select('id, role').eq('auth_id', user.id).single();
  if (!caller || !['super_admin', 'branch_manager'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as {
    firstName: string;
    lastName: string;
    email: string;
    idNumber: string;
    role: string;
    branchId?: string;
  };

  const { firstName, lastName, email, idNumber, role, branchId } = body;
  if (!firstName || !lastName || !email || !idNumber || !role) {
    return NextResponse.json({ error: 'firstName, lastName, email, idNumber and role are required' }, { status: 400 });
  }

  // Generate next Work ID
  const year = new Date().getFullYear();
  const { data: lastUser } = await service
    .from('users')
    .select('work_id')
    .like('work_id', `AQI-${year}%`)
    .order('work_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSeq = lastUser?.work_id ? parseInt(lastUser.work_id.slice(-4)) : 0;
  const workId = generateWorkId(lastSeq);

  // Temp password = idNumber stripped to lowercase
  const tempPassword = idNumber.replace(/[\s-]/g, '').toLowerCase();
  const authEmail = workIdToEmail(workId);

  // Create Supabase Auth user
  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email: authEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  // Create profile row
  const { data: newUser, error: profileErr } = await service
    .from('users')
    .insert({
      auth_id: authData.user.id,
      work_id: workId,
      email,
      full_name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      role,
      status: 'active',
      id_number: idNumber,
      branch_id: branchId ?? null,
      created_by: caller.id,
    })
    .select()
    .single();

  if (profileErr) {
    // Rollback auth user
    await service.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ ...formatUserRow(newUser), workId, tempPassword }, { status: 201 });
}

function formatUserRow(u: Record<string, unknown>) {
  return {
    id: u.id,
    workId: u.work_id,
    email: u.email,
    fullName: u.full_name,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    status: u.status,
    phone: u.phone ?? null,
    avatarUrl: u.avatar_url ?? null,
    branchId: u.branch_id ?? null,
    branch: null,
    roles: [{ id: u.role, name: String(u.role).replace(/_/g, ' ') }],
    createdAt: u.created_at,
  };
}
