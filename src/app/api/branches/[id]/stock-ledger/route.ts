import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope } from '@/lib/branches-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read', 'inventory.read')) return forbidden();

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    let query = service
      .from('branch_stock_ledger')
      .select('id, reference_type, movement_type, quantity, unit_cost, total_cost, transaction_date, item_id')
      .eq('branch_id', id)
      .order('transaction_date', { ascending: false });

    const shiftId = searchParams.get('shiftId');
    if (shiftId) query = query.eq('shift_close_id', shiftId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
