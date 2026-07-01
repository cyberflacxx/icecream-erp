import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeCashFlowFromLedger } from '@/lib/finance';
import { financeErrorMessage, financeService, isMissingFinanceTable, loadLedgerLines } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

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
    const tableMissing =
      isMissingFinanceTable(err) ||
      financeErrorMessage(err).includes("Could not find the table 'icecream_erp.bank_transactions'") ||
      financeErrorMessage(err).includes("Could not find the table 'icecream_erp.cash_transactions'");
    if (tableMissing) {
      return NextResponse.json(summarizeCashFlowFromLedger(await loadLedgerLines(ctx.organizationId)));
    }
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
