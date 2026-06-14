import { NextResponse } from 'next/server';

import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { buildSecurityContextProfile, findSecurityUserProfileByAuthId, recordAuditLog } from '@/lib/security-server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const profile = await findSecurityUserProfileByAuthId(user.id);
  if (!profile) return unauthorized();

  const resolved = await buildSecurityContextProfile(profile);

  return NextResponse.json({
    clerkUserId: resolved.authId ?? resolved.id,
    isBranchScoped: ctx.isBranchScoped,
    organizationId: resolved.organizationId,
    permissions: resolved.permissions,
    rawPermissions: resolved.permissions,
    branch: resolved.branchId ? { id: resolved.branchId, code: resolved.branchId, name: resolved.branchId } : null,
    profile: {
      id: resolved.id,
      clerkUserId: resolved.authId ?? resolved.id,
      organizationId: resolved.organizationId,
      firstName: resolved.firstName,
      lastName: resolved.lastName,
      fullName: resolved.fullName,
      email: resolved.email,
      phone: profile.phone ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      branchId: resolved.branchId,
      workId: resolved.workId,
      status: resolved.status,
      role: resolved.role,
    },
    roles: resolved.roles,
  });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const body = (await request.json()) as Record<string, unknown>;
  const allowed = ['first_name', 'last_name', 'full_name', 'phone', 'avatar_url'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const service = (await import('@/lib/supabase/server')).createServiceRoleClient();
  const { error } = await service.from('users').update(updates).eq('id', ctx.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog({
    organizationId: ctx.organizationId,
    userProfileId: ctx.userId,
    action: 'PROFILE_UPDATED',
    entityType: 'user',
    entityId: ctx.userId,
    newValues: updates,
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true });
}
