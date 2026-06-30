import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, mapNestedRow } from '@/lib/finance-server';

type Row = Record<string, unknown>;

async function optionalRows(table: string, select: string, organizationId: string) {
  let result = await financeService().from(table).select(select);
  if (result.error && financeErrorMessage(result.error).toLowerCase().includes('organization_id')) {
    const fallbackSelect = select
      .replace(/^organization_id,\s*/, '')
      .replace(/,\s*organization_id/g, '')
      .replace(/organization_id,\s*/g, '');
    result = await financeService().from(table).select(fallbackSelect);
  }
  if (result.error && financeErrorMessage(result.error).toLowerCase().includes('account_type')) {
    result = await financeService().from(table).select(select.replace('account_type', 'type'));
  }

  if (result.error) {
    if (isMissingFinanceTable(result.error)) return [] as Row[];
    throw result.error;
  }

  return ((result.data ?? []) as unknown as Row[]).filter((row) => {
    const rowOrganizationId = row.organization_id;
    return !rowOrganizationId || String(rowOrganizationId) === organizationId;
  });
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function normalizeAccountType(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const [journalLines, invoices, branchSales, expenses, branchExpenses] = await Promise.all([
      optionalRows(
        'journal_entry_lines',
        'debit_amount, credit_amount, accounts(account_type), journal_entries!inner(organization_id, is_posted)',
        ctx.organizationId,
      ),
      optionalRows('invoices', 'organization_id, total, total_amount, deleted_at', ctx.organizationId),
      optionalRows('branch_sales', 'organization_id, total_amount, deleted_at', ctx.organizationId),
      optionalRows('finance_expenses', 'organization_id, amount, status, deleted_at', ctx.organizationId),
      optionalRows('branch_expenses', 'organization_id, amount, deleted_at', ctx.organizationId),
    ]);

    const balance = { assets: 0, equity: 0, liabilities: 0 };
    for (const row of journalLines.filter((line) => {
      const journalEntry = mapNestedRow(line.journal_entries as Row | Row[] | null);
      return journalEntry?.is_posted === true && String(journalEntry.organization_id ?? '') === ctx.organizationId;
    })) {
      const account = mapNestedRow(row.accounts as Row | Row[] | null);
      const type = normalizeAccountType(account?.account_type ?? account?.type);
      const net = Number(row.debit_amount ?? 0) - Number(row.credit_amount ?? 0);
      if (type === 'asset') balance.assets += net;
      if (type === 'liability') balance.liabilities += -net;
      if (type === 'equity') balance.equity += -net;
    }

    const revenue =
      invoices.filter((row) => !row.deleted_at).reduce((sum, row) => sum + Number(row.total ?? row.total_amount ?? 0), 0) +
      branchSales.filter((row) => !row.deleted_at).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
    const operatingExpenses =
      expenses
        .filter((row) => !row.deleted_at && String(row.status ?? '').toUpperCase() !== 'REJECTED')
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0) +
      branchExpenses.filter((row) => !row.deleted_at).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const netProfit = revenue - operatingExpenses;

    const ratios = [
        {
          formula: 'Assets / Liabilities',
          interpretation: 'Measures ability to cover short-term obligations.',
          ratio: 'Current Ratio',
          value: safeRatio(balance.assets, balance.liabilities),
        },
        {
          formula: 'Liabilities / Equity',
          interpretation: 'Shows leverage based on posted accounting entries.',
          ratio: 'Debt to Equity',
          value: safeRatio(balance.liabilities, balance.equity),
        },
        {
          formula: 'Net Profit / Revenue',
          interpretation: 'Shows how much profit remains after recorded expenses.',
          ratio: 'Net Profit Margin',
          value: safeRatio(netProfit, revenue),
        },
        {
          formula: 'Operating Expenses / Revenue',
          interpretation: 'Shows how much revenue is consumed by expenses.',
          ratio: 'Expense Ratio',
          value: safeRatio(operatingExpenses, revenue),
        },
        {
          formula: 'Net Profit / Assets',
          interpretation: 'Shows return generated from recorded assets.',
          ratio: 'Return on Assets',
          value: safeRatio(netProfit, balance.assets),
        },
      ];

    return NextResponse.json({
      data: ratios,
      ratios,
      summary: {
        assets: balance.assets,
        equity: balance.equity,
        liabilities: balance.liabilities,
        netProfit,
        operatingExpenses,
        revenue,
      },
    });
  } catch (error) {
    return serverError(financeErrorMessage(error) || 'Failed to load financial ratios.');
  }
}
