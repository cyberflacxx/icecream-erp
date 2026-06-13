import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeTrialBalance } from '@/lib/finance';
import { financeService, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, accounts(account_code, account_name), journal_entries!inner(organization_id, is_posted)')
      .eq('journal_entries.organization_id', ctx.organizationId)
      .eq('journal_entries.is_posted', true);
    if (error) throw error;

    const lines = (data ?? []).map((row) => {
      const account = mapNestedRow(row.accounts as Record<string, unknown> | Array<Record<string, unknown>> | null);
      return {
        accountCode: String(account?.account_code ?? 'UNKNOWN'),
        accountName: String(account?.account_name ?? 'Unknown account'),
        creditAmount: Number(row.credit_amount ?? 0),
        debitAmount: Number(row.debit_amount ?? 0),
      };
    });

    return NextResponse.json(summarizeTrialBalance(lines));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
