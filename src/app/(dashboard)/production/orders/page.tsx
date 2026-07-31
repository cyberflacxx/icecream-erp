'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, ClipboardList, Factory, PackageCheck, Search, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionOrders } from '@/hooks/production/useProductionOrders';
import { usePermission } from '@/hooks/usePermission';

function formatQuantity(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function resolveOrderHref(orderId: string, workflow: string | null) {
  if (workflow === 'issue') return `/production/orders/${orderId}?tab=issue`;
  if (workflow === 'receipt') return `/production/orders/${orderId}?tab=receipt`;
  return `/production/orders/${orderId}`;
}

export default function ProductionOrdersPage() {
  const searchParams = useSearchParams();
  const workflow = searchParams.get('workflow');
  const initialStatus = searchParams.get('status') ?? '';
  const initialSearch = searchParams.get('search') ?? '';
  const canEditPlanned = usePermission('production_order.edit_planned');
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const ordersQuery = useProductionOrders({ search, status });

  useEffect(() => {
    setSearch(initialSearch);
    setStatus(initialStatus);
  }, [initialSearch, initialStatus]);

  const workflowCopy = useMemo(() => {
    if (workflow === 'issue') {
      return {
        banner: 'Issue workflow: open a released production order to post raw-material deductions.',
        cta: 'Open Issue',
      };
    }
    if (workflow === 'receipt') {
      return {
        banner: 'Receipt workflow: open a released production order to post finished-goods receipts.',
        cta: 'Open Receipt',
      };
    }
    return {
      banner: '',
      cta: 'Open Order',
    };
  }, [workflow]);

  if (ordersQuery.isLoading) return <LoadingState />;
  if (ordersQuery.isError) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Production orders unavailable" description={ordersQuery.error.message} />;
  }

  const orders = ordersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Orders"
        description="Use planned production orders as the operational source for release, issue posting, receipt posting, reversals, and close/reopen control."
        actions={
          <Button asChild size="sm">
            <Link href="/production/orders/new">
              <ClipboardList className="mr-2 h-4 w-4" />
              Planned Production
            </Link>
          </Button>
        }
      />
      <ProductionNav />

      {workflowCopy.banner ? (
        <div className="rounded-lg border border-sky-300/50 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {workflowCopy.banner}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 shadow-sm md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" />
          <input
            className="surface-input-soft pl-9"
            placeholder="Order, product number, or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select className="surface-input-soft md:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="RELEASED">Released</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'production_order_number',
            header: 'Order #',
            render: (row) => (
              <Link className="font-semibold text-[color:var(--app-accent-strong)]" href={resolveOrderHref(String(row.id), workflow)}>
                {row.production_order_number}
              </Link>
            ),
          },
          { key: 'product_number', header: 'Product #' },
          { key: 'product_description_snapshot', header: 'Description' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'planned_quantity', header: 'Planned', render: (row) => formatQuantity(row.planned_quantity) },
          { key: 'released_quantity', header: 'Released', render: (row) => formatQuantity(row.released_quantity) },
          { key: 'completed_quantity', header: 'Completed', render: (row) => formatQuantity(row.completed_quantity) },
          { key: 'remaining_quantity', header: 'Remaining', render: (row) => formatQuantity(row.remaining_quantity) },
          { key: 'planned_due_date', header: 'Due Date', render: (row) => String(row.planned_due_date ?? '') },
          {
            key: 'actions',
            header: 'Action',
            render: (row) => (
              <div className="flex justify-end gap-2">
                {canEditPlanned && String(row.status ?? '').toUpperCase() === 'PLANNED' && !workflow ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/production/orders/${row.id}/edit`}>Edit</Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={resolveOrderHref(String(row.id), workflow)}>
                    {workflowCopy.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ),
          },
        ]}
        data={orders}
        emptyState={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No production orders" description="Create the first planned production order from an active product BOM." />}
      />

      {!workflow ? null : (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Issue and receipt posting now run from Production Orders. Legacy batch posting screens remain available only for historical compatibility.
        </div>
      )}
    </div>
  );
}
