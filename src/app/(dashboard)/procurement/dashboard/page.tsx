'use client';

import { FileClock, ShieldAlert, Truck, Wallet } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { EmptyState } from '@/components/ui-library';
import { useProcurementDashboard, useProcurementMeta } from '@/hooks/procurement';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function ProcurementDashboardPage() {
  const query = useProcurementDashboard();
  const metaQuery = useProcurementMeta();
  const metrics = query.data;
  const stockWatch = [...(metaQuery.data?.items ?? [])]
    .sort((left, right) => {
      if (left.inventory.isLowStock !== right.inventory.isLowStock) {
        return left.inventory.isLowStock ? -1 : 1;
      }

      return right.inventory.quantityOnOrder - left.inventory.quantityOnOrder;
    })
    .slice(0, 8);

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
        <div className="surface-card">
          <h2 className="text-lg font-semibold text-brown">Workflow load</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CountTile label="Pending approvals" value={metrics?.pendingPurchaseApprovals ?? 0} />
            <CountTile label="Partially received POs" value={metrics?.partiallyReceivedPurchaseOrders ?? 0} />
            <CountTile label="Pending returns" value={metrics?.pendingSupplierReturns ?? 0} />
            <CountTile label="Late deliveries" value={metrics?.lateDeliveries ?? 0} />
          </div>
        </div>

        <div className="surface-card">
          <h2 className="text-lg font-semibold text-brown">Top suppliers by PO value</h2>
          <div className="mt-4 space-y-3">
            {metrics?.topSuppliersByValue?.length ? (
              metrics.topSuppliersByValue.map((row) => (
                <div key={row.supplierName} className="surface-tile">
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

      <div className="surface-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brown">Procurement Stock Watch</h2>
            <p className="mt-1 text-sm text-muted">
              Read-only stock context for buying decisions: current stock, reorder point, on-order quantity, warehouse location, and the latest receipt trail.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          {stockWatch.length ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.18em] text-muted">
                  <th className="px-2 py-3 font-semibold">Item</th>
                  <th className="px-2 py-3 font-semibold">Current</th>
                  <th className="px-2 py-3 font-semibold">Reorder</th>
                  <th className="px-2 py-3 font-semibold">On Order</th>
                  <th className="px-2 py-3 font-semibold">Received Today</th>
                  <th className="px-2 py-3 font-semibold">Last Receipt</th>
                  <th className="px-2 py-3 font-semibold">Primary Store</th>
                </tr>
              </thead>
              <tbody>
                {stockWatch.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-2 py-3">
                      <p className="font-medium text-brown">{item.code} - {item.name}</p>
                      <p className="text-xs text-muted">
                        {item.inventory.isLowStock ? 'Low stock' : 'Within stock range'}
                        {item.description ? ` • ${item.description}` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-3 font-medium text-brown">{formatQuantity(item.inventory.currentStock)}</td>
                    <td className="px-2 py-3">{formatQuantity(item.inventory.reorderLevel)}</td>
                    <td className="px-2 py-3">{formatQuantity(item.inventory.quantityOnOrder)}</td>
                    <td className="px-2 py-3">{formatQuantity(item.inventory.quantityReceivedToday)}</td>
                    <td className="px-2 py-3">{item.inventory.lastReceivedDate ? new Date(item.inventory.lastReceivedDate).toLocaleDateString() : 'No receipt yet'}</td>
                    <td className="px-2 py-3">{item.inventory.primaryWarehouseName ?? 'No warehouse balance'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="No stock visibility yet"
              description="Stock balances and receipts will appear here once stores activity starts posting."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatQuantity(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card">
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
    <div className="surface-tile">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-brown">{value}</p>
    </div>
  );
}
