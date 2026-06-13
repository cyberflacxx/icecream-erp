import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, getActiveBranchWarehouse, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { id, saleId } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as { reason?: string };
    if (!body.reason) return badRequest('Cancellation reason is required');

    const { data: sale, error: saleError } = await service
      .from('branch_sales')
      .select('id, status, branch_sale_items(id, item_id, quantity, unit_price, total_price)')
      .eq('id', saleId)
      .eq('branch_id', id)
      .maybeSingle();
    if (saleError) throw saleError;
    if (!sale) return badRequest('Sale not found');
    if (String(sale.status ?? '') === 'CANCELLED') return badRequest('Sale already cancelled');

    const warehouse = await getActiveBranchWarehouse(id);
    const items = Array.isArray(sale.branch_sale_items) ? sale.branch_sale_items : [];
    for (const item of items) {
      const { data: balance } = await service
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available')
        .eq('warehouse_id', warehouse.id)
        .eq('item_id', item.item_id)
        .maybeSingle();
      if (balance) {
        await service.from('stock_balances').update({
          quantity_on_hand: Number(balance.quantity_on_hand ?? 0) + Number(item.quantity ?? 0),
          quantity_available: Number(balance.quantity_available ?? 0) + Number(item.quantity ?? 0),
          last_updated: new Date().toISOString(),
        }).eq('id', balance.id);
      }
    }

    const { data, error } = await service
      .from('branch_sales')
      .update({
        status: 'CANCELLED',
        voided_at: new Date().toISOString(),
        voided_by: ctx.userId,
        void_reason: body.reason,
      })
      .eq('id', saleId)
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_SALE_CANCELLED', saleId, ctx.userId, { branchId: id, reason: body.reason }, 'branch_sale');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
