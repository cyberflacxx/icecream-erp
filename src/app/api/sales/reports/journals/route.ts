import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('sales_journals').select('journal_number, journal_date, account_name, debit_amount, credit_amount, status').order('journal_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json((data ?? []).map((row) => ({
      accountName: row.account_name,
      creditAmount: Number(row.credit_amount ?? 0),
      debitAmount: Number(row.debit_amount ?? 0),
      journalDate: row.journal_date,
      journalNumber: row.journal_number,
      status: row.status,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
