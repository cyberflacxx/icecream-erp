import { NextResponse } from 'next/server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ROLE_PERMISSIONS, ROLES } from '@/lib/auth-roles';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const { data: profile, error: profileError } = await service
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  if (profileError || !profile) {
    // Fallback: try by email (synthetic ice.erp email → extract work_id)
    const { data: profileByWorkId } = await service
      .from('users')
      .select('*')
      .ilike('work_id', user.email?.split('@')[0]?.toUpperCase() ?? '')
      .single();

    if (!profileByWorkId) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Backfill auth_id for faster future lookups
    await service
      .from('users')
      .update({ auth_id: user.id })
      .eq('id', profileByWorkId.id);

    return buildResponse(profileByWorkId);
  }

  return buildResponse(profile);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const allowed = ['avatar_url', 'first_name', 'last_name', 'full_name', 'phone'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from('users')
    .update(updates)
    .eq('auth_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function buildResponse(profile: Record<string, unknown>) {
  const role = String(profile.role ?? 'staff');
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.staff;
  const roleInfo = ROLES.find((r) => r.id === role);

  return NextResponse.json({
    clerkUserId: profile.id,
    isBranchScoped: Boolean(profile.branch_id),
    organizationId: 'absolute-ice-cream',
    permissions,
    rawPermissions: permissions,
    branch: null,
    profile: {
      id: profile.id,
      clerkUserId: String(profile.id),
      organizationId: 'absolute-ice-cream',
      firstName: String(profile.first_name ?? ''),
      lastName: String(profile.last_name ?? ''),
      fullName: String(profile.full_name ?? ''),
      email: String(profile.email ?? ''),
      phone: profile.phone ? String(profile.phone) : null,
      avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
      branchId: profile.branch_id ? String(profile.branch_id) : null,
      workId: String(profile.work_id ?? ''),
      status: String(profile.status ?? 'active'),
      role,
    },
    roles: roleInfo
      ? [{ id: roleInfo.id, name: roleInfo.name, description: roleInfo.description, isSystemRole: true }]
      : [],
  });
}
