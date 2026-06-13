import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService } from '@/lib/branches-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'finance.read', 'sales.read')) return forbidden();
  try {
    const service = branchService();
    const { data, error } = await service.from('branch_sales').select('branch_id, sale_number, sale_date, total_amount, payment_method, payment_status').eq('payment_method', 'CREDIT').order('sale_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
