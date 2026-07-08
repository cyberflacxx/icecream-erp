import { NextRequest, NextResponse } from 'next/server';

import { recordProtectedActionAudit, requireAdminDeleteKey } from '@/lib/admin-delete-server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceRoleClient();

  const { data: caller } = await service.from('users').select('role').eq('auth_id', user.id).single();
  if (!caller || !['super_admin', 'branch_manager'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as { status?: string; role?: string };
  const updates: Record<string, string> = {};
  if (body.status) updates.status = body.status;
  if (body.role) updates.role = body.role;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await service
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceRoleClient();

  const { data: caller } = await service.from('users').select('id, role, organization_id').eq('auth_id', user.id).single();
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (params.id === caller.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { adminKey?: string | null };

  // Get auth_id so we can delete from Supabase Auth too
  const { data: target } = await service.from('users').select('id, auth_id, role, status').eq('id', params.id).single();

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const adminKeyError = await requireAdminDeleteKey({
    action: 'USER_DELETED',
    body,
    ctx: {
      branchAssignments: [],
      branchId: null,
      isBranchScoped: false,
      organizationId: String(caller.organization_id ?? 'absolute-ice-cream'),
      permissions: ['manage_roles'],
      role: String(caller.role ?? 'super_admin'),
      roles: [],
      sessionTimeoutMinutes: 0,
      userAccountId: user.id,
      userId: String(caller.id),
      warehouseAssignments: [],
      workId: String(user.email ?? user.id),
    },
    entityId: params.id,
    entityType: 'user',
    request,
  });
  if (adminKeyError) return adminKeyError;

  const { error } = await service.from('users').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (target?.auth_id) {
    await service.auth.admin.deleteUser(String(target.auth_id));
  }

  await recordProtectedActionAudit({
    action: 'USER_DELETED',
    entityId: params.id,
    entityType: 'user',
    oldValues: target as Record<string, unknown>,
    newValues: { deleted: true },
    ctx: {
      branchAssignments: [],
      branchId: null,
      isBranchScoped: false,
      organizationId: String(caller.organization_id ?? 'absolute-ice-cream'),
      permissions: ['manage_roles'],
      role: String(caller.role ?? 'super_admin'),
      roles: [],
      sessionTimeoutMinutes: 0,
      userAccountId: user.id,
      userId: String(caller.id),
      warehouseAssignments: [],
      workId: String(user.email ?? user.id),
    },
    request,
  });

  return NextResponse.json({ success: true });
}
