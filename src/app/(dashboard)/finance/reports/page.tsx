'use client';

import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFinanceReport } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface TrialBalanceResponse {
  rows: Array<{
    accountCode: string;
    accountName: string;
    credit: number;
    debit: number;
  }>;
  totals: {
    credit: number;
    debit: number;
  };
}

interface IncomeStatementResponse {
  grossProfit: number;
  netProfit: number;
  operatingExpenses: number;
  revenue: number;
}

interface FinancialPositionResponse {
  assets: number;
  equity: number;
  liabilities: number;
}

interface RatiosResponse {
  data: Array<{
    formula: string;
    interpretation?: string;
    ratio: string;
    value: number;
  }>;
  summary: Record<string, number>;
}

function formatValue(value: unknown) {
  return currency.format(Number(value ?? 0));
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brown">{value}</p>
    </div>
  );
}

function SectionTitle({ title, description }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-brown">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

export default function FinanceReportsPage() {
  const trialBalanceQuery = useFinanceReport<TrialBalanceResponse>(API_ROUTES.FINANCE.REPORT_TRIAL_BALANCE);
  const incomeStatementQuery = useFinanceReport<IncomeStatementResponse>(API_ROUTES.FINANCE.REPORT_PROFIT_AND_LOSS);
  const financialPositionQuery = useFinanceReport<FinancialPositionResponse>(API_ROUTES.FINANCE.REPORT_BALANCE_SHEET);
  const ratiosQuery = useFinanceReport<RatiosResponse>(API_ROUTES.FINANCE.REPORT_RATIOS);
  const receivablesQuery = useFinanceReport<Array<Record<string, unknown>>>(API_ROUTES.FINANCE.REPORT_RECEIVABLES);

  const isLoading =
    trialBalanceQuery.isLoading ||
    incomeStatementQuery.isLoading ||
    financialPositionQuery.isLoading ||
    ratiosQuery.isLoading ||
    receivablesQuery.isLoading;
  const allFailed =
    trialBalanceQuery.isError &&
    incomeStatementQuery.isError &&
    financialPositionQuery.isError &&
    ratiosQuery.isError &&
    receivablesQuery.isError;

  if (isLoading) return <LoadingState />;
  if (allFailed) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Finance reports unavailable"
        description="No finance report data returned."
      />
    );
  }

  const income = incomeStatementQuery.data ?? { grossProfit: 0, netProfit: 0, operatingExpenses: 0, revenue: 0 };
  const position = financialPositionQuery.data ?? { assets: 0, equity: 0, liabilities: 0 };
  const trialBalance = trialBalanceQuery.data ?? { rows: [], totals: { credit: 0, debit: 0 } };
  const ratios = ratiosQuery.data ?? { data: [], summary: {} };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance Reports"
        description="Review trial balance, income statement, financial position, ratios, and receivable balances."
        status="partial"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/finance/transactions">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Open Transactions
            </Link>
          </Button>
        }
      />
      <FinanceNav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Revenue" value={formatValue(income.revenue)} />
        <SummaryCard label="Gross Profit" value={formatValue(income.grossProfit)} />
        <SummaryCard label="Net Profit" value={formatValue(income.netProfit)} />
        <SummaryCard label="Assets" value={formatValue(position.assets)} />
      </div>

      <section id="trial-balance" className="space-y-4">
        <SectionTitle
          title="Trial Balance"
          description="Debit and credit balances from posted journal entries."
        />
        <DataTable
          columns={[
            { key: 'accountCode', header: 'Account Code' },
            { key: 'accountName', header: 'Account Name' },
            { key: 'debit', header: 'Debit', render: (row) => formatValue(row.debit) },
            { key: 'credit', header: 'Credit', render: (row) => formatValue(row.credit) },
          ]}
          data={trialBalance.rows}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No trial balance rows"
              description="Post journal entries to populate the trial balance."
            />
          }
        />
        <div className="surface-tile grid gap-2 text-sm text-muted sm:grid-cols-2">
          <span>Total Debit: <strong className="text-brown">{formatValue(trialBalance.totals.debit)}</strong></span>
          <span>Total Credit: <strong className="text-brown">{formatValue(trialBalance.totals.credit)}</strong></span>
        </div>
      </section>

      <section id="income-statement" className="space-y-4">
        <SectionTitle
          title="Income Statement"
          description="Revenue, operating expenses, and profitability for the current ledger data."
        />
        <DataTable
          columns={[
            { key: 'line', header: 'Line' },
            { key: 'amount', header: 'Amount', render: (row) => formatValue(row.amount) },
          ]}
          data={[
            { line: 'Revenue', amount: income.revenue },
            { line: 'Gross Profit', amount: income.grossProfit },
            { line: 'Operating Expenses', amount: income.operatingExpenses },
            { line: 'Net Profit', amount: income.netProfit },
          ]}
        />
      </section>

      <section id="financial-position" className="space-y-4">
        <SectionTitle
          title="Financial Position"
          description="Assets, liabilities, and equity from posted accounting entries."
        />
        <DataTable
          columns={[
            { key: 'line', header: 'Line' },
            { key: 'amount', header: 'Amount', render: (row) => formatValue(row.amount) },
          ]}
          data={[
            { line: 'Assets', amount: position.assets },
            { line: 'Liabilities', amount: position.liabilities },
            { line: 'Equity', amount: position.equity },
          ]}
        />
      </section>

      <section id="ratios" className="space-y-4">
        <SectionTitle
          title="Ratios"
          description="Liquidity, leverage, and profitability ratios calculated from finance totals."
        />
        <DataTable
          columns={[
            { key: 'ratio', header: 'Ratio' },
            { key: 'formula', header: 'Formula' },
            { key: 'value', header: 'Value', render: (row) => Number(row.value ?? 0).toFixed(4) },
            { key: 'interpretation', header: 'Meaning' },
          ]}
          data={ratios.data}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No ratio data"
              description="Ratios will calculate once finance activity is available."
            />
          }
        />
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="Receivables"
          description="Open customer invoice balances for collection follow-up."
        />
        <DataTable
          columns={[
            { key: 'invoiceNumber', header: 'Invoice #' },
            { key: 'customerName', header: 'Customer' },
            { key: 'dueDate', header: 'Due Date' },
            { key: 'status', header: 'Status' },
            { key: 'balanceDue', header: 'Balance', render: (row) => formatValue(row.balanceDue) },
            { key: 'total', header: 'Total', render: (row) => formatValue(row.total) },
          ]}
          data={receivablesQuery.data ?? []}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No receivables found"
              description="Customer invoice balances will appear here."
            />
          }
        />
      </section>
    </div>
  );
}
