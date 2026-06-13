import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService } from '@/lib/branches-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'sales.read')) return forbidden();
  try {
    const service = branchService();
    const { data, error } = await service.from('branch_shift_closes').select('branch_id, shift_date, shift_type, status, expected_cash, actual_cash, cash_variance, stock_variance').order('shift_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
