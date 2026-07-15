'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRightLeft, ClipboardCheck, History, PackageSearch, ReceiptText, Wallet, Warehouse } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { EmptyState, StatusBadge } from '@/components/ui-library';
import { useInventoryDashboard } from '@/hooks/inventory';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export default function InventoryDashboardPage() {
  const dashboardQuery = useInventoryDashboard();
  const metrics = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Dashboard"
        description="Monitor stock value, shortages, approvals, and today&apos;s movement activity across stores, production, and branches."
      />

      <InventoryNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total stock value"
          value={currencyFormatter.format(metrics?.totalStockValue ?? 0)}
          helper="Live balance valuation"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Low stock alerts"
          value={String(metrics?.lowStockCount ?? 0)}
          helper="At or below reorder level"
        />
        <MetricCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="Pending approvals"
          value={String(metrics?.pendingApprovalsCount ?? 0)}
          helper="Transfers, adjustments, returns"
        />
        <MetricCard
          icon={<PackageSearch className="h-5 w-5" />}
          label="Supplier shortages"
          value={String(metrics?.supplierShortageCount ?? 0)}
          helper="Ordered but not received"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="dashboard-blue-card p-4">
          <h2 className="dashboard-blue-value text-lg font-semibold">Stock composition</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ValueTile label="Raw materials" value={metrics?.rawMaterialValue ?? 0} />
            <ValueTile label="Work in progress" value={metrics?.wipValue ?? 0} />
            <ValueTile label="Finished goods" value={metrics?.finishedGoodsValue ?? 0} />
            <ValueTile label="Packaging and other" value={(metrics?.packagingMaterialValue ?? 0) + (metrics?.nonConsumablesValue ?? 0)} />
          </div>
        </div>

        <div className="dashboard-blue-card p-4">
          <h2 className="dashboard-blue-value text-lg font-semibold">Risk watchlist</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <CountTile label="Expiring soon" value={metrics?.expiringSoonCount ?? 0} />
            <CountTile label="Low stock" value={metrics?.lowStockCount ?? 0} />
            <CountTile label="Shortages" value={metrics?.supplierShortageCount ?? 0} />
          </div>
          <div className="dashboard-blue-card-soft mt-4 px-4 py-4 text-sm">
            Duplicate transfer posting and missing ledger entries can be reviewed from{' '}
            <Link href="/admin/data-integrity" className="font-medium text-white underline underline-offset-4">
              Data Integrity
            </Link>
            .
          </div>
        </div>
      </div>

      <div className="dashboard-blue-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="dashboard-blue-value text-lg font-semibold">Stores Control Center</h2>
            <p className="dashboard-blue-copy mt-1 text-sm">
              Move through the main stores controls from one place: receiving, transfers, approvals, movement history, and warehouse structure.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ControlTile
            href="/procurement/goods-received"
            icon={<ReceiptText className="h-4 w-4" />}
            label="GRN Control"
            helper="Receive, approve, and post incoming stock"
          />
          <ControlTile
            href="/inventory/transfers"
            icon={<ArrowRightLeft className="h-4 w-4" />}
            label="Transfers"
            helper="Warehouse-to-warehouse movements"
          />
          <ControlTile
            href="/inventory/approvals"
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="Approvals"
            helper="Pending transfer, return, and adjustment approvals"
          />
          <ControlTile
            href="/inventory/stock-movements"
            icon={<History className="h-4 w-4" />}
            label="Movement Trail"
            helper="Audit by item, warehouse, and reference"
          />
          <ControlTile
            href="/inventory/warehouses"
            icon={<Warehouse className="h-4 w-4" />}
            label="Warehouses"
            helper="Maintain stores structure and balance points"
          />
        </div>
      </div>

      <div className="dashboard-blue-card p-4">
        <h2 className="dashboard-blue-value text-lg font-semibold">Today&apos;s stock movements</h2>
        <div className="mt-4 space-y-3">
          {metrics?.todaysMovements?.length ? (
            metrics.todaysMovements.map((movement) => (
              <div key={movement.id} className="dashboard-blue-card-soft flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="dashboard-blue-value font-medium">{movement.itemName}</p>
                  <p className="dashboard-blue-copy text-sm">{movement.warehouseName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={movement.movementType} variant="info" />
                  <span className="dashboard-blue-value text-sm font-semibold">{movement.quantity.toFixed(3)}</span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="No movements posted today"
              description="Once receiving, transfers, production issues, or dispatches are posted they will appear here."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ControlTile({
  helper,
  href,
  icon,
  label,
}: {
  helper: string;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="dashboard-blue-card-soft block px-4 py-4 text-sm transition hover:bg-white/16"
    >
      <div className="flex items-center justify-between">
        <p className="dashboard-blue-value font-semibold">{label}</p>
        <span className="dashboard-blue-icon h-9 w-9">{icon}</span>
      </div>
      <p className="dashboard-blue-copy mt-2">{helper}</p>
    </Link>
  );
}

function MetricCard({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="dashboard-blue-card p-4">
      <div className="flex items-center justify-between">
        <p className="dashboard-blue-label text-sm font-semibold uppercase tracking-[0.18em]">{label}</p>
        <span className="dashboard-blue-icon h-11 w-11">{icon}</span>
      </div>
      <p className="dashboard-blue-value mt-4 text-3xl font-bold">{value}</p>
      <p className="dashboard-blue-copy mt-2 text-sm">{helper}</p>
    </div>
  );
}

function ValueTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-blue-card-soft px-3.5 py-3">
      <p className="dashboard-blue-copy text-sm">{label}</p>
      <p className="dashboard-blue-value mt-2 text-lg font-semibold">{currencyFormatter.format(value)}</p>
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
