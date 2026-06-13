import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, getActiveBranchWarehouse, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ countId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'branches.write')) return forbidden();
  const { id, countId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data: count, error: countError } = await service
      .from('branch_stock_counts')
      .select('*')
      .eq('id', countId)
      .eq('branch_id', id)
      .maybeSingle();
    if (countError) throw countError;
    if (!count) return NextResponse.json({ error: 'Stock count not found' }, { status: 404 });

    const warehouse = await getActiveBranchWarehouse(id);
    const { data: balance } = await service
      .from('stock_balances')
      .select('id')
      .eq('warehouse_id', warehouse.id)
      .eq('item_id', count.item_id)
      .maybeSingle();
    if (balance) {
      await service.from('stock_balances').update({
        quantity_on_hand: count.physical_quantity,
        quantity_available: count.physical_quantity,
        last_updated: new Date().toISOString(),
      }).eq('id', balance.id);
    }

    const { data, error } = await service
      .from('branch_stock_counts')
      .update({ approved_by: ctx.userId, approved_at: new Date().toISOString(), status: 'APPROVED' })
      .eq('id', countId)
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_STOCK_COUNT_APPROVED', countId, ctx.userId, { branchId: id }, 'branch_stock_count');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
