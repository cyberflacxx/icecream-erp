import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService } from '@/lib/branches-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'inventory.read')) return forbidden();
  try {
    const service = branchService();
    const { data, error } = await service.from('branch_stock_ledger').select('*').order('transaction_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
