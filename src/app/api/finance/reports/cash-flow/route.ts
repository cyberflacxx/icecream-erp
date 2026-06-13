import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [bankRows, cashRows] = await Promise.all([
      financeService().from('bank_transactions').select('transaction_type, amount').eq('organization_id', ctx.organizationId),
      financeService().from('cash_transactions').select('transaction_type, amount').eq('organization_id', ctx.organizationId),
    ]);
    if (bankRows.error) throw bankRows.error;
    if (cashRows.error) throw cashRows.error;

    const summarize = (rows: Array<Record<string, unknown>>) =>
      rows.reduce(
        (sum: { cashIn: number; cashOut: number }, row) => {
          const type = String(row.transaction_type ?? '').toUpperCase();
          const amount = Number(row.amount ?? 0);
          if (type.includes('OUT') || type.includes('WITHDRAW') || type.includes('PAYMENT')) sum.cashOut += amount;
          else sum.cashIn += amount;
          return sum;
        },
        { cashIn: 0, cashOut: 0 },
      );

    const bank = summarize(bankRows.data ?? []);
    const cash = summarize(cashRows.data ?? []);

    return NextResponse.json({
      cashIn: bank.cashIn + cash.cashIn,
      cashOut: bank.cashOut + cash.cashOut,
      netCashFlow: bank.cashIn + cash.cashIn - bank.cashOut - cash.cashOut,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
