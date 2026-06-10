'use client';

import Link from 'next/link';
import { Bell, ChartColumnIncreasing, Coins, CreditCard, DollarSign, Package, Wallet } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState, StatCard, StatusBadge } from '@/components/ui-library';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  useBranchDashboard,
  useBranchRealtime,
  useBranchShiftCloses,
  useInitShiftClose
} from '@/hooks/branch-operations';
import { useUserContext } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchDashboardPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const { currentUser } = useUserContext();
  const queryClient = useQueryClient();
  const dashboardQuery = useBranchDashboard(branchId, today());
  const shiftClosesQuery = useBranchShiftCloses(branchId, {
    page: 1,
    pageSize: 1,
    startDate: today(),
    endDate: today()
  });
  const initShiftClose = useInitShiftClose(branchId);
  const branchShift = shiftClosesQuery.data?.data[0] ?? null;

  useBranchRealtime(branchId, {
    onSale: () => {
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'branch-dashboard']
      });
    },
    onShiftClose: () => {
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'shift-closes']
      });
      void queryClient.invalidateQueries({
        queryKey: ['branch-operations', 'branch-dashboard']
      });
    }
  });

  const canAccess =
    !currentUser?.isBranchScoped || currentUser.profile.branchId === branchId;

  if (!canAccess) {
    return (
      <EmptyState
        icon={<Bell className="h-6 w-6" />}
        title="Branch access denied"
        description="Your role can only view your assigned branch dashboard."
      />
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Dashboard"
        description="Track branch stock flow, payment mix, and shift close readiness in real time."
      />

      <BranchOperationsNav branchId={branchId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Opening Stock Value"
          value={currencyFormatter.format(dashboard?.stats.openingStockValue ?? 0)}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          title="Stock Received Today"
          value={currencyFormatter.format(dashboard?.stats.stockReceivedToday ?? 0)}
          icon={<ChartColumnIncreasing className="h-4 w-4" />}
        />
        <StatCard
          title="Stock Sold Today"
          value={currencyFormatter.format(dashboard?.stats.stockSoldToday ?? 0)}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          title="Closing Stock (Estimated)"
          value={currencyFormatter.format(dashboard?.stats.closingStockEstimated ?? 0)}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Cash"
          value={currencyFormatter.format(dashboard?.payments.cash ?? 0)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="EcoCash"
          value={currencyFormatter.format(dashboard?.payments.ecocash ?? 0)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          title="Card"
          value={currencyFormatter.format(dashboard?.payments.card ?? 0)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          title="Expenses"
          value={currencyFormatter.format(dashboard?.payments.expenses ?? 0)}
          icon={<Coins className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brown">Shift Close Status</h2>
            <StatusBadge status={branchShift?.status ?? 'NONE'} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {branchShift
              ? `Today's shift close is ${branchShift.status}.`
              : 'No shift close has been opened for today.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {branchShift ? (
              <Button asChild size="sm">
                <Link href={`/branches/${branchId}/shift-close`}>View Shift Close</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={initShiftClose.isPending}
                onClick={() =>
                  initShiftClose.mutate({
                    date: today(),
                    shift: 'DAY'
                  })
                }
              >
                {initShiftClose.isPending ? 'Opening...' : 'Open Shift Close'}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-brown">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button asChild size="sm" variant="outline">
              <Link href={`/branches/${branchId}/sales`}>Record Sale</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/branches/${branchId}/sales?expense=true`}>Record Expense</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/branches/${branchId}/sales?view=stock`}>View Stock</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/branches/${branchId}/shift-close`}>Close Shift</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
