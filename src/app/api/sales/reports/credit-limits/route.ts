import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildCreditLimitRows } from '@/lib/sales';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('customers').select('code, name, credit_limit, current_balance').is('deleted_at', null);
    if (error) throw error;
    return NextResponse.json(buildCreditLimitRows((data ?? []) as Array<Record<string, unknown>>));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
