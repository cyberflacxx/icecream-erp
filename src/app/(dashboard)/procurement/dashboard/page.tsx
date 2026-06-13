'use client';

import { FileClock, ShieldAlert, Truck, Wallet } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { EmptyState } from '@/components/ui-library';
import { useProcurementDashboard } from '@/hooks/procurement';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function ProcurementDashboardPage() {
  const query = useProcurementDashboard();
  const metrics = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Dashboard"
        description="Track demand approvals, open purchase orders, shortages, returns, supplier invoices, and late deliveries from one place."
      />

      <ProcurementNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileClock className="h-5 w-5 text-orange" />} label="Open requisitions" value={String(metrics?.openPurchaseRequisitions ?? 0)} />
        <MetricCard icon={<ShieldAlert className="h-5 w-5 text-warning" />} label="Supplier shortages" value={String(metrics?.supplierShortages ?? 0)} />
        <MetricCard icon={<Truck className="h-5 w-5 text-brown" />} label="Open purchase orders" value={String(metrics?.openPurchaseOrders ?? 0)} />
        <MetricCard icon={<Wallet className="h-5 w-5 text-orange" />} label="Invoices due" value={String(metrics?.supplierInvoicesDue ?? 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-brown">Workflow load</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CountTile label="Pending approvals" value={metrics?.pendingPurchaseApprovals ?? 0} />
            <CountTile label="Partially received POs" value={metrics?.partiallyReceivedPurchaseOrders ?? 0} />
            <CountTile label="Pending returns" value={metrics?.pendingSupplierReturns ?? 0} />
            <CountTile label="Late deliveries" value={metrics?.lateDeliveries ?? 0} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-brown">Top suppliers by PO value</h2>
          <div className="mt-4 space-y-3">
            {metrics?.topSuppliersByValue?.length ? (
              metrics.topSuppliersByValue.map((row) => (
                <div key={row.supplierName} className="rounded-2xl bg-cream px-4 py-3">
                  <p className="font-medium text-brown">{row.supplierName}</p>
                  <p className="mt-1 text-sm text-muted">{currencyFormatter.format(row.totalValue)}</p>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title="No supplier value data yet"
                description="Top suppliers will appear after purchase orders are created and valued."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{label}</p>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-semibold text-brown">{value}</p>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-cream px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-brown">{value}</p>
    </div>
  );
}
