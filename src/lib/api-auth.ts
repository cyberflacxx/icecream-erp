import { NextResponse } from 'next/server';

import { ROLE_PERMISSIONS } from '@/lib/auth-roles';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export interface AuthContext {
  userId: string;
  workId: string;
  role: string;
  permissions: string[];
  branchId: string | null;
  /** True for branch-scoped roles that can only see their branch's data. */
  isBranchScoped: boolean;
  organizationId: string;
}

/** Call at the top of every route handler. Returns null if not authenticated. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from('users')
    .select('id, work_id, role, branch_id, status')
    .eq('auth_id', user.id)
    .single();

  if (!profile || profile.status !== 'active') return null;

  const role = String(profile.role ?? 'staff');
  return {
    userId: String(profile.id),
    workId: String(profile.work_id),
    role,
    permissions: ROLE_PERMISSIONS[role] ?? [],
    branchId: profile.branch_id ? String(profile.branch_id) : null,
    isBranchScoped:
      Boolean(profile.branch_id) && !['super_admin', 'manager'].includes(role),
    organizationId: 'absolute-ice-cream',
  };
}

/** Returns true if ctx has at least one of the given permissions. */
export function can(ctx: AuthContext, ...perms: string[]): boolean {
  if (ctx.role === 'super_admin') return true;
  return perms.some((p) => ctx.permissions.includes(p));
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
