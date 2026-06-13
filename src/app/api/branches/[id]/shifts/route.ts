import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope } from '@/lib/branches-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read', 'sales.read')) return forbidden();

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    let query = service
      .from('branch_shift_closes')
      .select('id, shift_date, shift_type, status, opening_cash, expected_cash, actual_cash, cash_variance, stock_variance')
      .eq('branch_id', id)
      .order('shift_date', { ascending: false });

    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
