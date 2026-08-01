'use client';

import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, Download, Printer } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useUserContext } from '@/contexts/UserContext';
import { useFinanceMeta, useFinanceReport } from '@/hooks/finance/useFinanceResources';
import { downloadFromUrl } from '@/lib/export';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' });

interface TrialBalanceResponse {
  rows: Array<{
    accountCode: string;
    accountName: string;
    closingCredit: number;
    closingDebit: number;
    openingCredit: number;
    openingDebit: number;
    periodCredit: number;
    periodDebit: number;
  }>;
  totals: {
    closingCredit: number;
    closingDebit: number;
    openingCredit: number;
    openingDebit: number;
    periodCredit: number;
    periodDebit: number;
  };
}

interface IncomeStatementResponse {
  costOfGoodsSold: number;
  grossProfit: number;
  netProfit: number;
  operatingExpenses: number;
  revenue: number;
}

interface FinancialPositionResponse {
  assets: number;
  equity: number;
  isBalanced?: boolean;
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

interface WrappedRowsResponse<T> {
  rows: T[];
}

interface InventoryReconciliationResponse {
  rows: Array<Record<string, unknown>>;
  summary: Record<string, number>;
}

function formatValue(value: unknown) {
  return currency.format(Number(value ?? 0));
}

function buildReportPath(path: string, params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brown">{value}</p>
    </div>
  );
}

function ReportActions({
  filters,
  reportType,
}: {
  filters: Record<string, string>;
  reportType: string;
}) {
  const exportUrl = buildReportPath(API_ROUTES.FINANCE.EXPORT(reportType), filters);

  return (
    <div className="flex gap-2 print:hidden">
      <Button type="button" size="sm" variant="outline" onClick={() => void downloadFromUrl(exportUrl)}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );
}

function SectionTitle({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold text-brown">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {actions ?? null}
    </div>
  );
}

export default function FinanceReportsPage() {
  const { currentUser } = useUserContext();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [costCenterCode, setCostCenterCode] = useState('');

  const filters = useMemo(() => ({
    branchId,
    costCenterCode,
    endDate,
    startDate,
  }), [branchId, costCenterCode, endDate, startDate]);
  const metaQuery = useFinanceMeta();
  const trialBalanceQuery = useFinanceReport<TrialBalanceResponse>(buildReportPath(API_ROUTES.FINANCE.REPORT_TRIAL_BALANCE, filters));
  const incomeStatementQuery = useFinanceReport<IncomeStatementResponse>(buildReportPath(API_ROUTES.FINANCE.REPORT_PROFIT_AND_LOSS, filters));
  const financialPositionQuery = useFinanceReport<FinancialPositionResponse>(buildReportPath(API_ROUTES.FINANCE.REPORT_BALANCE_SHEET, filters));
  const generalLedgerQuery = useFinanceReport<Array<Record<string, unknown>>>(buildReportPath(API_ROUTES.FINANCE.REPORT_GENERAL_LEDGER, filters));
  const branchProfitabilityQuery = useFinanceReport<WrappedRowsResponse<Record<string, unknown>>>(buildReportPath(API_ROUTES.FINANCE.REPORT_BRANCH_PROFITABILITY, filters));
  const costCentreQuery = useFinanceReport<WrappedRowsResponse<Record<string, unknown>>>(buildReportPath(API_ROUTES.FINANCE.REPORT_COST_CENTRE_PROFITABILITY, filters));
  const inventoryValuationQuery = useFinanceReport<{ rows: Array<Record<string, unknown>>; totalValuation: number }>(buildReportPath(API_ROUTES.FINANCE.REPORT_INVENTORY_VALUATION, filters));
  const inventoryReconciliationQuery = useFinanceReport<InventoryReconciliationResponse>(buildReportPath(API_ROUTES.FINANCE.REPORT_INVENTORY_RECONCILIATION, filters));
  const productionCostingQuery = useFinanceReport<WrappedRowsResponse<Record<string, unknown>>>(buildReportPath(API_ROUTES.FINANCE.REPORT_PRODUCTION_COSTING, filters));
  const ratiosQuery = useFinanceReport<RatiosResponse>(API_ROUTES.FINANCE.REPORT_RATIOS);
  const receivablesQuery = useFinanceReport<Array<Record<string, unknown>>>(API_ROUTES.FINANCE.REPORT_RECEIVABLES);

  const isLoading =
    metaQuery.isLoading ||
    trialBalanceQuery.isLoading ||
    incomeStatementQuery.isLoading ||
    financialPositionQuery.isLoading ||
    generalLedgerQuery.isLoading ||
    branchProfitabilityQuery.isLoading ||
    costCentreQuery.isLoading ||
    inventoryValuationQuery.isLoading ||
    inventoryReconciliationQuery.isLoading ||
    productionCostingQuery.isLoading ||
    ratiosQuery.isLoading ||
    receivablesQuery.isLoading;
  const allFailed =
    trialBalanceQuery.isError &&
    incomeStatementQuery.isError &&
    financialPositionQuery.isError &&
    generalLedgerQuery.isError &&
    branchProfitabilityQuery.isError &&
    costCentreQuery.isError &&
    inventoryValuationQuery.isError &&
    inventoryReconciliationQuery.isError &&
    productionCostingQuery.isError &&
    ratiosQuery.isError &&
    receivablesQuery.isError;

  if (isLoading) return <LoadingState />;
  if (allFailed) {
    return (
      <EmptyState
        description="No finance report data returned."
        icon={<AlertCircle className="h-6 w-6" />}
        title="Finance reports unavailable"
      />
    );
  }

  const income = incomeStatementQuery.data ?? { grossProfit: 0, netProfit: 0, operatingExpenses: 0, revenue: 0 };
  const position = financialPositionQuery.data ?? { assets: 0, equity: 0, liabilities: 0 };
  const trialBalance = trialBalanceQuery.data ?? {
    rows: [],
    totals: {
      closingCredit: 0,
      closingDebit: 0,
      openingCredit: 0,
      openingDebit: 0,
      periodCredit: 0,
      periodDebit: 0,
    },
  };
  const ratios = ratiosQuery.data ?? { data: [], summary: {} };
  const branchProfitability = branchProfitabilityQuery.data?.rows ?? [];
  const costCentreRows = costCentreQuery.data?.rows ?? [];
  const inventoryRows = inventoryValuationQuery.data?.rows ?? [];
  const inventoryReconciliationRows = inventoryReconciliationQuery.data?.rows ?? [];
  const productionRows = productionCostingQuery.data?.rows ?? [];
  const ledgerRows = generalLedgerQuery.data ?? [];
  const branches = metaQuery.data?.branches ?? [];
  const costCentres = metaQuery.data?.costCentres ?? [];

  return (
    <div className="space-y-8 print:space-y-5">
      <PageHeader
        title="Finance Reports"
        description="Review trial balance, income statement, financial position, ratios, and receivable balances."
        status="partial"
        actions={
          <div className="flex gap-2 print:hidden">
            <Button asChild size="sm" variant="outline">
              <Link href="/finance/transactions">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Open Transactions
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />
      <div className="print:hidden">
        <FinanceNav />
      </div>

      <div className="hidden rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted print:block">
        <p className="font-semibold text-brown">Absolute Ice Cream ERP</p>
        <p className="mt-1">
          Finance Reporting Pack
          {' | '}
          Generated on {new Date().toLocaleString()}
          {currentUser?.profile?.fullName ? ` | Generated by ${currentUser.profile.fullName}` : ''}
          {(startDate || endDate) ? ` | Period ${startDate || 'Start'} to ${endDate || 'Today'}` : ''}
          {branchId ? ` | Branch ${branchId}` : ''}
          {costCenterCode ? ` | Cost centre ${costCenterCode}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Revenue" value={formatValue(income.revenue)} />
        <SummaryCard label="Gross Profit" value={formatValue(income.grossProfit)} />
        <SummaryCard label="Net Profit" value={formatValue(income.netProfit)} />
        <SummaryCard label="Assets" value={formatValue(position.assets)} />
      </div>

      <section className="surface-tile grid gap-3 md:grid-cols-4 print:hidden">
        <label className="space-y-1 text-sm text-muted">
          <span>Start Date</span>
          <input className="surface-input-soft w-full" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm text-muted">
          <span>End Date</span>
          <input className="surface-input-soft w-full" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm text-muted">
          <span>Branch</span>
          <select className="surface-input-soft w-full" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={String(branch.id ?? '')} value={String(branch.id ?? '')}>
                {String(branch.name ?? branch.code ?? branch.id ?? 'Branch')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-muted">
          <span>Cost Centre</span>
          <select className="surface-input-soft w-full" value={costCenterCode} onChange={(event) => setCostCenterCode(event.target.value)}>
            <option value="">All cost centres</option>
            {costCentres.map((centre) => (
              <option key={String(centre.code ?? centre.id ?? '')} value={String(centre.code ?? '')}>
                {String(centre.name ?? centre.code ?? 'Cost centre')}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section id="trial-balance" className="space-y-4">
        <SectionTitle
          title="Trial Balance"
          description="Debit and credit balances from posted journal entries."
          actions={<ReportActions filters={filters} reportType="trial-balance" />}
        />
        <DataTable
          columns={[
            { key: 'accountCode', header: 'Account Code' },
            { key: 'accountName', header: 'Account Name' },
            { key: 'openingDebit', header: 'Opening Dr', render: (row) => formatValue(row.openingDebit) },
            { key: 'openingCredit', header: 'Opening Cr', render: (row) => formatValue(row.openingCredit) },
            { key: 'periodDebit', header: 'Period Dr', render: (row) => formatValue(row.periodDebit) },
            { key: 'periodCredit', header: 'Period Cr', render: (row) => formatValue(row.periodCredit) },
            { key: 'closingDebit', header: 'Closing Dr', render: (row) => formatValue(row.closingDebit) },
            { key: 'closingCredit', header: 'Closing Cr', render: (row) => formatValue(row.closingCredit) },
          ]}
          data={trialBalance.rows}
          emptyState={<EmptyState description="Post journal entries to populate the trial balance." icon={<AlertCircle className="h-6 w-6" />} title="No trial balance rows" />}
        />
      </section>

      <section id="income-statement" className="space-y-4">
        <SectionTitle
          title="Income Statement"
          description="Revenue, operating expenses, and profitability for the current ledger data."
          actions={<ReportActions filters={filters} reportType="profit-and-loss" />}
        />
        <DataTable
          columns={[
            { key: 'line', header: 'Line' },
            { key: 'amount', header: 'Amount', render: (row) => formatValue(row.amount) },
          ]}
          data={[
            { line: 'Revenue', amount: income.revenue },
            { line: 'Cost of Goods Sold', amount: income.costOfGoodsSold },
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
          actions={<ReportActions filters={filters} reportType="balance-sheet" />}
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
            { line: 'Balance Check', amount: Math.abs((position.assets ?? 0) - ((position.liabilities ?? 0) + (position.equity ?? 0))) },
          ]}
        />
      </section>

      <section id="general-ledger" className="space-y-4">
        <SectionTitle
          title="General Ledger"
          description="Posted journals filtered by date, branch, and cost centre."
          actions={<ReportActions filters={filters} reportType="general-ledger" />}
        />
        <DataTable
          columns={[
            { key: 'entryDate', header: 'Date' },
            { key: 'entryNumber', header: 'Journal #' },
            { key: 'accountCode', header: 'Account' },
            { key: 'accountName', header: 'Name' },
            { key: 'branchId', header: 'Branch' },
            { key: 'costCenterCode', header: 'Cost Centre' },
            { key: 'debitAmount', header: 'Debit', render: (row) => formatValue(row.debitAmount) },
            { key: 'creditAmount', header: 'Credit', render: (row) => formatValue(row.creditAmount) },
          ]}
          data={ledgerRows}
        />
      </section>

      <section id="branch-profitability" className="space-y-4">
        <SectionTitle
          title="Branch Profit and Loss"
          description="Revenue, cost of goods sold, expenses, and net result by branch."
          actions={<ReportActions filters={filters} reportType="branch-profitability" />}
        />
        <DataTable
          columns={[
            { key: 'branchId', header: 'Branch' },
            { key: 'revenue', header: 'Revenue', render: (row) => formatValue(row.revenue) },
            { key: 'costOfGoodsSold', header: 'COGS', render: (row) => formatValue(row.costOfGoodsSold) },
            { key: 'grossProfit', header: 'Gross Profit', render: (row) => formatValue(row.grossProfit) },
            { key: 'expenses', header: 'Expenses', render: (row) => formatValue(row.expenses) },
            { key: 'netProfit', header: 'Net Profit', render: (row) => formatValue(row.netProfit) },
          ]}
          data={branchProfitability}
        />
      </section>

      <section id="cost-centres" className="space-y-4">
        <SectionTitle
          title="Cost Centre Profit and Loss"
          description="Revenue, cost, expenses, and net result by cost centre."
          actions={<ReportActions filters={filters} reportType="cost-centre-profitability" />}
        />
        <DataTable
          columns={[
            { key: 'costCenterCode', header: 'Cost Centre' },
            { key: 'revenue', header: 'Revenue', render: (row) => formatValue(row.revenue) },
            { key: 'costs', header: 'Costs', render: (row) => formatValue(row.costs) },
            { key: 'expenses', header: 'Expenses', render: (row) => formatValue(row.expenses) },
            { key: 'netResult', header: 'Net Result', render: (row) => formatValue(row.netResult) },
          ]}
          data={costCentreRows}
        />
      </section>

      <section id="inventory-valuation" className="space-y-4">
        <SectionTitle
          title="Inventory Valuation"
          description="Quantity, unit cost, and valuation by item, warehouse, branch, and batch."
          actions={<ReportActions filters={filters} reportType="inventory-valuation" />}
        />
        <DataTable
          columns={[
            { key: 'item', header: 'Item' },
            { key: 'itemCategory', header: 'Category' },
            { key: 'branch', header: 'Branch' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'quantity', header: 'Quantity' },
            { key: 'unitCost', header: 'Unit Cost', render: (row) => formatValue(row.unitCost) },
            { key: 'valuation', header: 'Valuation', render: (row) => formatValue(row.valuation) },
          ]}
          data={inventoryRows}
        />
      </section>

      <section id="inventory-reconciliation" className="space-y-4">
        <SectionTitle
          title="Inventory Reconciliation"
          description="Compare stock balances to movement-derived value and journal-linked value without hiding variances."
          actions={<ReportActions filters={filters} reportType="inventory-reconciliation" />}
        />
        <DataTable
          columns={[
            { key: 'itemCode', header: 'Item Code' },
            { key: 'itemName', header: 'Item Name' },
            { key: 'branch', header: 'Branch' },
            { key: 'warehouse', header: 'Warehouse' },
            { key: 'stockQuantity', header: 'Stock Qty' },
            { key: 'stockBalanceValue', header: 'Stock Balance Value', render: (row) => formatValue(row.stockBalanceValue) },
            { key: 'movementDerivedValue', header: 'Movement Value', render: (row) => formatValue(row.movementDerivedValue) },
            { key: 'generalLedgerValue', header: 'GL Value', render: (row) => formatValue(row.generalLedgerValue) },
            { key: 'quantityVariance', header: 'Qty Variance' },
            { key: 'valueVariance', header: 'Value Variance', render: (row) => formatValue(row.valueVariance) },
            { key: 'status', header: 'Status' },
          ]}
          data={inventoryReconciliationRows}
        />
      </section>

      <section id="production-costing" className="space-y-4">
        <SectionTitle
          title="Production Cost Report"
          description="Accepted output cost and wastage by production receipt."
          actions={<ReportActions filters={filters} reportType="production-costing" />}
        />
        <DataTable
          columns={[
            { key: 'receiptNumber', header: 'Receipt #' },
            { key: 'receiptDate', header: 'Date' },
            { key: 'acceptedQuantity', header: 'Accepted Qty' },
            { key: 'wastageQuantity', header: 'Wastage Qty' },
            { key: 'totalCost', header: 'Total Cost', render: (row) => formatValue(row.totalCost) },
            { key: 'costPerUnit', header: 'Cost / Unit', render: (row) => formatValue(row.costPerUnit) },
          ]}
          data={productionRows}
        />
      </section>

      <section id="ratios" className="space-y-4">
        <SectionTitle
          title="Ratios"
          description="Liquidity, leverage, and profitability ratios calculated from finance totals."
          actions={<ReportActions filters={filters} reportType="ratios" />}
        />
        <DataTable
          columns={[
            { key: 'ratio', header: 'Ratio' },
            { key: 'formula', header: 'Formula' },
            { key: 'value', header: 'Value', render: (row) => Number(row.value ?? 0).toFixed(4) },
            { key: 'interpretation', header: 'Meaning' },
          ]}
          data={ratios.data}
          emptyState={<EmptyState description="Ratios will calculate once finance activity is available." icon={<AlertCircle className="h-6 w-6" />} title="No ratio data" />}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="Receivables"
          description="Open customer invoice balances for collection follow-up."
          actions={<ReportActions filters={filters} reportType="receivables" />}
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
          emptyState={<EmptyState description="Customer invoice balances will appear here." icon={<AlertCircle className="h-6 w-6" />} title="No receivables found" />}
        />
      </section>
    </div>
  );
}
