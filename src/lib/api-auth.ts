import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { hasPermissionAccess } from '@/lib/permission-access';
import {
  buildSecurityContextProfile,
  canAccessBranch,
  ensureActiveSession,
  findSecurityUserProfileByAuthId,
  recordSecurityEvent,
  touchSessionActivity,
} from '@/lib/security-server';

export interface AuthContext {
  userAccountId: string | null;
  userId: string;
  workId: string;
  role: string;
  permissions: string[];
  branchId: string | null;
  branchAssignments: string[];
  warehouseAssignments: string[];
  isBranchScoped: boolean;
  organizationId: string;
  sessionTimeoutMinutes: number;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
  }>;
}

export async function getAuthContext(request?: Request | NextRequest): Promise<AuthContext | null> {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (!user) return null;

  const profile = await findSecurityUserProfileByAuthId(user.id);
  if (!profile) return null;

  const resolved = await buildSecurityContextProfile(profile);
  const sessionCheck = await ensureActiveSession(resolved, session?.access_token);

  if (!sessionCheck.active) {
    await recordSecurityEvent({
      organizationId: resolved.organizationId,
      userProfileId: resolved.id,
      eventType: 'SESSION_TIMEOUT',
      status: 'EXPIRED',
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    });
    await supabase.auth.signOut();
    return null;
  }

  if (session?.access_token) {
    await touchSessionActivity({
      userAccountId: resolved.userAccountId,
      userProfileId: resolved.id,
      accessToken: session.access_token,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
      timeoutMinutes: resolved.sessionTimeoutMinutes,
    });
  }

  const branchScoped = !resolved.permissions.includes('view_all_branches') && resolved.branchAssignments.length > 0;

  return {
    userAccountId: resolved.userAccountId,
    userId: resolved.id,
    workId: resolved.workId,
    role: resolved.role,
    permissions: resolved.permissions,
    branchId: resolved.branchId,
    branchAssignments: resolved.branchAssignments,
    warehouseAssignments: resolved.warehouseAssignments,
    isBranchScoped: branchScoped,
    organizationId: resolved.organizationId,
    sessionTimeoutMinutes: resolved.sessionTimeoutMinutes,
    roles: resolved.roles,
  };
}

export function can(ctx: AuthContext, ...perms: string[]): boolean {
  if (hasPermissionAccess(ctx.permissions, 'manage_roles', 'settings.manage')) {
    return true;
  }

  return hasPermissionAccess(ctx.permissions, ...perms);
}

export function canAccessBranchScope(ctx: AuthContext, branchId: string) {
  return canAccessBranch(
    {
      branchId: ctx.branchId,
      branchAssignments: ctx.branchAssignments,
      permissions: ctx.permissions,
    },
    branchId,
  );
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(msg = 'Not found') {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function serverError(msg: string) {
  return NextResponse.json({ error: msg }, { status: 500 });
}
