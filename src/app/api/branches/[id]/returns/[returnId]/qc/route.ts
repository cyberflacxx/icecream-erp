import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  const { id, returnId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const body = await request.json() as { finalAction?: string; qcNote?: string; qcStatus?: string };
    const service = branchService();
    const { data, error } = await service
      .from('branch_returns')
      .update({
        qc_note: body.qcNote ?? null,
        qc_status: body.qcStatus ?? 'PENDING_QC',
        final_action: body.finalAction ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .eq('branch_id', id)
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_RETURN_QC_RECORDED', returnId, ctx.userId, { branchId: id }, 'branch_return');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
