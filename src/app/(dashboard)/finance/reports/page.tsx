'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFinanceReport } from '@/hooks/finance/useFinanceResources';
import { API_ROUTES } from '@/lib/shared';

const reportLinks = [
  { href: API_ROUTES.FINANCE.REPORT_TRIAL_BALANCE, label: 'Trial Balance' },
  { href: API_ROUTES.FINANCE.REPORT_PROFIT_AND_LOSS, label: 'Profit and Loss' },
  { href: API_ROUTES.FINANCE.REPORT_BALANCE_SHEET, label: 'Balance Sheet' },
  { href: API_ROUTES.FINANCE.REPORT_CASH_FLOW, label: 'Cash Flow' },
  { href: API_ROUTES.FINANCE.REPORT_GENERAL_LEDGER, label: 'General Ledger' },
  { href: API_ROUTES.FINANCE.REPORT_RECEIVABLES_AGEING, label: 'Receivables Ageing' },
  { href: API_ROUTES.FINANCE.REPORT_PAYABLES_AGEING, label: 'Payables Ageing' },
  { href: API_ROUTES.FINANCE.REPORT_BUDGET_VARIANCE, label: 'Budget Variance' },
  { href: API_ROUTES.FINANCE.REPORT_PRODUCTION_COSTING, label: 'Production Costing' },
  { href: API_ROUTES.FINANCE.REPORT_BRANCH_COSTING, label: 'Branch Costing' },
  { href: API_ROUTES.FINANCE.REPORT_INVENTORY_VALUATION, label: 'Inventory Valuation' },
  { href: API_ROUTES.FINANCE.REPORT_COST_OF_GOODS_SOLD, label: 'Cost of Goods Sold' },
  { href: API_ROUTES.FINANCE.REPORT_TAX, label: 'Tax Report' },
] as const;

export default function FinanceReportsPage() {
  const query = useFinanceReport('/api/finance/reports/receivables');
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Finance reports unavailable" description={query.error?.message ?? 'No finance report data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Finance Reports" description="Review receivables and export-ready finance reporting outputs." status="partial" />
      <FinanceNav />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reportLinks.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="rounded-2xl border border-border bg-white px-4 py-4 text-sm font-medium text-brown shadow-sm transition hover:border-brown hover:bg-cream"
          >
            {report.label}
          </Link>
        ))}
      </div>
      <DataTable
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'customerName', header: 'Customer' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'status', header: 'Status' },
          { key: 'balanceDue', header: 'Balance' },
          { key: 'total', header: 'Total' },
        ]}
        data={query.data}
      />
    </div>
  );
}
