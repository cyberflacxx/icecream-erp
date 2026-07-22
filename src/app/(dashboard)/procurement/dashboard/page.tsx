'use client';

import Link from 'next/link';
import { FileClock, ShieldAlert, Truck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

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
        <MetricCard icon={<FileClock className="h-5 w-5" />} label="Open requisitions" value={String(metrics?.openPurchaseRequisitions ?? 0)} />
        <MetricCard icon={<ShieldAlert className="h-5 w-5" />} label="Supplier shortages" value={String(metrics?.supplierShortages ?? 0)} />
        <MetricCard icon={<Truck className="h-5 w-5" />} label="Open purchase orders" value={String(metrics?.openPurchaseOrders ?? 0)} />
        <MetricCard icon={<Wallet className="h-5 w-5" />} label="Invoices due" value={String(metrics?.supplierInvoicesDue ?? 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="dashboard-blue-card p-4">
          <h2 className="dashboard-blue-value text-lg font-semibold">Workflow load</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CountTile label="Pending approvals" value={metrics?.pendingPurchaseApprovals ?? 0} />
            <CountTile label="Partially received POs" value={metrics?.partiallyReceivedPurchaseOrders ?? 0} />
            <CountTile label="Pending returns" value={metrics?.pendingSupplierReturns ?? 0} />
            <CountTile label="Late deliveries" value={metrics?.lateDeliveries ?? 0} />
          </div>
        </div>

        <div className="dashboard-blue-card p-4">
          <h2 className="dashboard-blue-value text-lg font-semibold">Top suppliers by PO value</h2>
          <div className="mt-4 space-y-3">
            {metrics?.topSuppliersByValue?.length ? (
              metrics.topSuppliersByValue.map((row) => (
                <div key={row.supplierName} className="dashboard-blue-card-soft px-3.5 py-3">
                  <p className="dashboard-blue-value font-medium">{row.supplierName}</p>
                  <p className="dashboard-blue-copy mt-1 text-sm">{currencyFormatter.format(row.totalValue)}</p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <WorkflowLinkCard
          description="Submit drafts, clear pending approvals, and move approved demand into PO creation."
          href="/procurement/requisitions"
          label="Requisitions"
        />
        <WorkflowLinkCard
          description="Review open purchase orders, dispatch supplier emails, and open the receiving path."
          href="/procurement/purchase-orders"
          label="Purchase Orders"
        />
        <WorkflowLinkCard
          description="Approve GRNs, post receipts into stock, and verify the resulting inventory movement."
          href="/procurement/goods-received"
          label="Goods Received"
        />
      </div>

      <div className="dashboard-blue-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="dashboard-blue-value text-lg font-semibold">Procurement Stock Watch</h2>
            <p className="dashboard-blue-copy mt-1 text-sm">
              Read-only stock context for buying decisions: current stock, reorder point, on-order quantity, warehouse location, and the latest receipt trail.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          {stockWatch.length ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/12 text-left text-xs uppercase tracking-[0.18em] text-blue-100/76">
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
                  <tr key={item.id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-2 py-3">
                      <p className="dashboard-blue-value font-medium">{item.code} - {item.name}</p>
                      <p className="dashboard-blue-copy text-xs">
                        {item.inventory.isLowStock ? 'Low stock' : 'Within stock range'}
                        {item.description ? ` • ${item.description}` : ''}
                      </p>
                    </td>
                    <td className="dashboard-blue-value px-2 py-3 font-medium">{formatQuantity(item.inventory.currentStock)}</td>
                    <td className="dashboard-blue-copy px-2 py-3">{formatQuantity(item.inventory.reorderLevel)}</td>
                    <td className="dashboard-blue-copy px-2 py-3">{formatQuantity(item.inventory.quantityOnOrder)}</td>
                    <td className="dashboard-blue-copy px-2 py-3">{formatQuantity(item.inventory.quantityReceivedToday)}</td>
                    <td className="dashboard-blue-copy px-2 py-3">{item.inventory.lastReceivedDate ? new Date(item.inventory.lastReceivedDate).toLocaleDateString() : 'No receipt yet'}</td>
                    <td className="dashboard-blue-copy px-2 py-3">{item.inventory.primaryWarehouseName ?? 'No warehouse balance'}</td>
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

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="dashboard-blue-card p-4">
      <div className="flex items-center justify-between">
        <p className="dashboard-blue-label text-sm font-semibold uppercase tracking-[0.18em]">{label}</p>
        <span className="dashboard-blue-icon h-11 w-11">{icon}</span>
      </div>
      <p className="dashboard-blue-value mt-4 text-3xl font-bold">{value}</p>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-blue-card-soft px-3.5 py-3">
      <p className="dashboard-blue-copy text-sm">{label}</p>
      <p className="dashboard-blue-value mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function WorkflowLinkCard({ description, href, label }: { description: string; href: string; label: string }) {
  return (
    <Link href={href} className="dashboard-blue-card p-4 transition-transform hover:-translate-y-0.5">
      <p className="dashboard-blue-label text-sm font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="dashboard-blue-copy mt-3 text-sm">{description}</p>
      <p className="dashboard-blue-value mt-4 text-sm font-semibold">Open workspace</p>
    </Link>
  );
}
