import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateStockVariance } from '@/lib/branches';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'branches.read')) return forbidden();
  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service.from('branch_stock_counts').select('*').eq('branch_id', id).order('created_at', { ascending: false });
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
  if (!can(ctx, 'inventory.write', 'branches.write')) return forbidden();
  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      itemId: string;
      physicalQuantity: number;
      shiftCloseId?: string;
      systemQuantity: number;
      varianceReason?: string;
    };
    if (!body.itemId) return badRequest('itemId is required');
    if (Number(body.physicalQuantity) < 0) return badRequest('physicalQuantity must not be negative');

    const varianceQuantity = calculateStockVariance(Number(body.physicalQuantity), Number(body.systemQuantity));
    const { data, error } = await service
      .from('branch_stock_counts')
      .insert({
        branch_id: id,
        shift_close_id: body.shiftCloseId ?? null,
        item_id: body.itemId,
        system_quantity: body.systemQuantity,
        physical_quantity: body.physicalQuantity,
        variance_quantity: varianceQuantity,
        variance_reason: body.varianceReason ?? null,
        counted_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_STOCK_COUNT_RECORDED', data.id, ctx.userId, { branchId: id, itemId: body.itemId }, 'branch_stock_count');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
