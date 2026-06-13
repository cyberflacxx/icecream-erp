import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, accounts(account_type), journal_entries!inner(organization_id, is_posted)')
      .eq('journal_entries.organization_id', ctx.organizationId)
      .eq('journal_entries.is_posted', true);
    if (error) throw error;

    const totals = { assets: 0, equity: 0, liabilities: 0 };
    for (const row of data ?? []) {
      const account = mapNestedRow(row.accounts as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const type = String(account?.account_type ?? '');
      const net = Number(row.debit_amount ?? 0) - Number(row.credit_amount ?? 0);
      if (type === 'Asset') totals.assets += net;
      if (type === 'Liability') totals.liabilities += -net;
      if (type === 'Equity') totals.equity += -net;
    }

    return NextResponse.json(totals);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
