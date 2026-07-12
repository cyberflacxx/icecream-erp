import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read', 'users.read')) return forbidden();

  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_user_assignments')
      .select('id, role, effective_date, is_active, user_id')
      .eq('branch_id', id)
      .order('effective_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write', 'users.write')) return forbidden();

  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as { effectiveDate?: string; isActive?: boolean; role: string; userId: string };
    if (!body.userId || !body.role) return badRequest('userId and role are required');

    const { data: user, error: userError } = await service.schema('icecream_erp').from('users').select('id').eq('id', body.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return badRequest('User not found');

    const { data, error } = await service
      .from('branch_user_assignments')
      .insert({
        branch_id: id,
        user_id: body.userId,
        role: body.role,
        effective_date: body.effectiveDate ?? new Date().toISOString().slice(0, 10),
        is_active: body.isActive ?? true,
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_USER_ASSIGNED', data.id, ctx.userId, { branchId: id, userId: body.userId, role: body.role }, 'branch_user_assignment');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
