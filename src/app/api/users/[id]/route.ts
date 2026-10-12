import { NextRequest, NextResponse } from 'next/server';

import { recordProtectedActionAudit, requireAdminDeleteKey } from '@/lib/admin-delete-server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

type CountableQuery = {
  eq: (column: string, value: string) => Promise<{ count: number | null; error: { message?: string } | null }>;
  select: (columns: string, options: { count: 'exact'; head: true }) => CountableQuery;
};

async function countUserHistory(schemaService: { from: (table: string) => CountableQuery }, userId: string) {
  const referenceChecks = [
    ['audit_logs', 'user_profile_id'],
    ['audit_logs', 'user_id'],
    ['journal_entries', 'created_by'],
    ['journal_entries', 'posted_by'],
    ['stock_movements', 'created_by'],
    ['production_issues', 'issued_by'],
    ['production_issues', 'posted_by'],
    ['production_receipts', 'received_by'],
    ['production_worker_assignments', 'created_by'],
    ['hr_labour_cost_allocations', 'created_by'],
    ['branch_expenses', 'created_by'],
    ['branch_expenses', 'posted_by'],
    ['invoices', 'created_by'],
    ['payments', 'created_by'],
  ] as const;

  let total = 0;
  for (const [table, column] of referenceChecks) {
    try {
      const { count, error } = await schemaService.from(table).select('id', { count: 'exact', head: true }).eq(column, userId);
      if (!error) total += count ?? 0;
    } catch {}
  }
  return total;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceRoleClient();
  const schemaService = service.schema('icecream_erp');

  const { data: caller } = await schemaService.from('users').select('role').eq('auth_id', user.id).single();
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

  const { data, error } = await schemaService
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
  const schemaService = service.schema('icecream_erp');

  const { data: caller } = await schemaService.from('users').select('id, role, organization_id').eq('auth_id', user.id).single();
  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (params.id === caller.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { adminKey?: string | null };

  const { data: target } = await schemaService.from('users').select('id, auth_id, role, status').eq('id', params.id).single();

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (String(target.role ?? '').toLowerCase() === 'super_admin' && String(target.status ?? 'active').toLowerCase() === 'active') {
    const { count, error: adminCountError } = await schemaService
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('status', 'active')
      .neq('id', params.id);
    if (adminCountError) return NextResponse.json({ error: adminCountError.message }, { status: 500 });
    if ((count ?? 0) < 1) {
      return NextResponse.json({ error: 'Cannot disable the last active Super Admin.' }, { status: 409 });
    }
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

  const historyCount = await countUserHistory(schemaService, params.id);
  const { error } = await schemaService
    .from('users')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (target?.auth_id) {
    await service.auth.admin.updateUserById(String(target.auth_id), { ban_duration: '876000h' }).catch(() => null);
  }

  await recordProtectedActionAudit({
    action: 'USER_DISABLED',
    entityId: params.id,
    entityType: 'user',
    oldValues: target as Record<string, unknown>,
    newValues: { hardDeleted: false, historyCount, status: 'inactive' },
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

  return NextResponse.json({ success: true, deactivated: true, hardDeleted: false, historyCount });
}
