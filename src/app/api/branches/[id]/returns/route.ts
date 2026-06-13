import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, generateBranchReferenceNumber, writeBranchAuditLog } from '@/lib/branches-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'quality.read')) return forbidden();
  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service.from('branch_returns').select('*').eq('branch_id', id).order('created_at', { ascending: false });
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
  if (!can(ctx, 'sales.write', 'quality.write')) return forbidden();
  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      branchCustomerId?: string;
      branchSaleId?: string;
      finalAction?: string;
      goodsReturnVoucherNumber?: string;
      itemId: string;
      quantityReturned: number;
      returnReason: string;
      shiftCloseId?: string;
    };
    if (!body.itemId || !body.returnReason || !body.quantityReturned) return badRequest('itemId, quantityReturned, and returnReason are required');

    const returnNumber = await generateBranchReferenceNumber('branch_returns', 'BRT');
    const { data, error } = await service
      .from('branch_returns')
      .insert({
        branch_id: id,
        shift_close_id: body.shiftCloseId ?? null,
        branch_sale_id: body.branchSaleId ?? null,
        branch_customer_id: body.branchCustomerId ?? null,
        return_number: returnNumber,
        item_id: body.itemId,
        quantity_returned: body.quantityReturned,
        return_reason: body.returnReason,
        goods_return_voucher_number: body.goodsReturnVoucherNumber ?? null,
        final_action: body.finalAction ?? null,
        created_by: ctx.userId,
        status: 'PENDING_QC',
      })
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_RETURN_CREATED', data.id, ctx.userId, { branchId: id, returnNumber }, 'branch_return');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
