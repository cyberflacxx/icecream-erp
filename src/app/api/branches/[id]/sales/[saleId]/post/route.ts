import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { id, saleId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_sales')
      .update({ status: 'POSTED', posted_at: new Date().toISOString(), posted_by: ctx.userId })
      .eq('id', saleId)
      .eq('branch_id', id)
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_SALE_POSTED', saleId, ctx.userId, { branchId: id }, 'branch_sale');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
