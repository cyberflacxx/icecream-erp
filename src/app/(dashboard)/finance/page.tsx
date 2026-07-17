'use client';

import {
  AlertCircle,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleDollarSign,
  Coins,
  Landmark,
  Package,
  PiggyBank,
  Wallet
} from 'lucide-react';
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
import { FinanceNav } from '@/components/finance/finance-nav';
import { useFinanceDashboard } from '@/hooks/finance/useFinance';
import { useAppAuth } from '@/hooks/useAppAuth';

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

export default function FinancePage() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const dashboardQuery = useFinanceDashboard();

  if (!isLoaded || (isSignedIn && dashboardQuery.isPending && !dashboardQuery.data)) {
    return <LoadingState />;
  }

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Sign in required"
        description="Sign in to view the finance dashboard."
      />
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Finance data unavailable"
        description="Some finance summary data could not be loaded. Please refresh or contact support."
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
      <FinanceNav />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Revenue (Period)"
          value={formatCurrency(stats.revenue)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Payments Count"
          value={formatCurrency(stats.paymentsCount)}
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
        <StatCard
          title="Total Expenses"
          value={formatCurrency(stats.totalExpenses)}
          icon={<Coins className="h-5 w-5" />}
        />
        <StatCard
          title="Cash Balance"
          value={formatCurrency(stats.cashBalance)}
          icon={<Wallet className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          title="Bank Balance"
          value={formatCurrency(stats.bankBalance)}
          icon={<Landmark className="h-5 w-5" />}
        />
        <StatCard
          title="Petty Cash"
          value={formatCurrency(stats.pettyCashBalance)}
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard
          title="Stock Valuation"
          value={formatCurrency(stats.stockValuation)}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Production Cost"
          value={formatCurrency(stats.productionCost)}
          icon={<Package className="h-5 w-5" />}
          color="brown"
        />
        <StatCard
          title="Branch Profitability"
          value={formatCurrency(stats.branchProfitability)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Pending Approvals"
          value={formatCurrency(stats.pendingApprovals)}
          icon={<BanknoteArrowUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Cashflow Last 7 Days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <LineChart data={charts.cashflowLast7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-card-grid)" />
                <XAxis dataKey="day" stroke="var(--dashboard-card-axis)" fontSize={12} />
                <YAxis stroke="var(--dashboard-card-axis)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="var(--dashboard-card-fill)" strokeWidth={3} />
                <Line type="monotone" dataKey="expenses" stroke="var(--dashboard-card-warm)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Payment Method Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={charts.paymentMethodBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-card-grid)" />
                <XAxis dataKey="method" stroke="var(--dashboard-card-axis)" fontSize={12} />
                <YAxis stroke="var(--dashboard-card-axis)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="var(--dashboard-card-fill)" radius={[10, 10, 0, 0]} />
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

