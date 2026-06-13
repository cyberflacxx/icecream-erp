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
      .select('id, description, debit_amount, credit_amount, accounts(account_code, account_name), journal_entries!inner(entry_number, entry_date, organization_id)')
      .eq('journal_entries.organization_id', ctx.organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json((data ?? []).map((row) => {
      const account = mapNestedRow(row.accounts as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const entry = mapNestedRow(row.journal_entries as Record<string, unknown> | Array<Record<string, unknown>> | null);
      return {
        accountCode: account?.account_code ?? '',
        accountName: account?.account_name ?? '',
        creditAmount: Number(row.credit_amount ?? 0),
        debitAmount: Number(row.debit_amount ?? 0),
        description: row.description,
        entryDate: entry?.entry_date ?? null,
        entryNumber: entry?.entry_number ?? null,
        id: row.id,
      };
    }));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
