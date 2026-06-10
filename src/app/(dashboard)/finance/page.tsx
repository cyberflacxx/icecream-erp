'use client';

import { AlertCircle, BanknoteArrowDown, BanknoteArrowUp, CircleDollarSign, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { ChartCard, DataTable, EmptyState, LoadingState, StatCard } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { useFinanceDashboard } from '@/hooks/finance/useFinance';

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

export default function FinancePage() {
  const dashboardQuery = useFinanceDashboard();

  if (dashboardQuery.isLoading) {
    return <LoadingState />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Finance data unavailable"
        description={dashboardQuery.error?.message ?? 'No finance dashboard data was returned.'}
      />
    );
  }

  const { stats, charts, overdueInvoices, recentEntries } = dashboardQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance Module"
        description="Monitor revenue, receivables, cashflow and accounting entries from a consolidated finance view."
        status="partial"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Revenue (Period)"
          value={formatCurrency(stats.revenue)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Payments Count"
          value={formatCurrency(stats.payments)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Outstanding Receivables"
          value={formatCurrency(stats.outstandingReceivables)}
          icon={<BanknoteArrowUp className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          title="Outstanding Payables"
          value={formatCurrency(stats.outstandingPayables)}
          icon={<BanknoteArrowDown className="h-5 w-5" />}
          color="brown"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Cashflow Last 7 Days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.cashflowLast7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3D7B6" />
                <XAxis dataKey="day" stroke="#6B4A3A" fontSize={12} />
                <YAxis stroke="#6B4A3A" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#16A34A" strokeWidth={3} />
                <Line type="monotone" dataKey="expenses" stroke="#F97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Payment Method Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.paymentMethodBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3D7B6" />
                <XAxis dataKey="method" stroke="#6B4A3A" fontSize={12} />
                <YAxis stroke="#6B4A3A" fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="#3B1F12" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          columns={[
            { key: 'invoiceNumber', header: 'Invoice #' },
            { key: 'customer', header: 'Customer' },
            { key: 'dueDate', header: 'Due Date' },
            { key: 'balance', header: 'Balance' },
            { key: 'status', header: 'Status' }
          ]}
          data={overdueInvoices}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No overdue invoices"
              description="All current invoices appear settled or within due date."
            />
          }
        />

        <DataTable
          columns={[
            { key: 'entryNumber', header: 'Entry #' },
            { key: 'entryDate', header: 'Entry Date' },
            { key: 'description', header: 'Description' },
            { key: 'debit', header: 'Debit' },
            { key: 'credit', header: 'Credit' }
          ]}
          data={recentEntries}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No journal entries"
              description="No recent ledger postings were found for this range."
            />
          }
        />
      </div>
    </div>
  );
}

