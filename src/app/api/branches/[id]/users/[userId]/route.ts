import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write', 'users.write')) return forbidden();

  const { id, userId } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_user_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('branch_id', id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .select()
      .maybeSingle();
    if (error) throw error;

    if (data?.id) {
      await writeBranchAuditLog('BRANCH_USER_UNASSIGNED', data.id, ctx.userId, { branchId: id, userId }, 'branch_user_assignment');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
