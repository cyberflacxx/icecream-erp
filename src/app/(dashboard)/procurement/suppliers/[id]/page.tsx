'use client';

import { PackageSearch } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { useSupplier, useSupplierPurchaseHistory } from '@/hooks/procurement';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'grns', label: 'GRNs' },
  { key: 'returns', label: 'Returns' },
  { key: 'payments', label: 'Payments' }
] as const;

type HistoryTab = Exclude<(typeof tabs)[number]['key'], 'overview'>;

interface SupplierDetailPageProps {
  params: {
    id: string;
  };
}

function isHistoryTab(value: string | null): value is HistoryTab {
  return value === 'purchase_orders' || value === 'grns' || value === 'returns' || value === 'payments';
}

export default function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const requestedTab = searchParams.get('tab');
  const activeTab = isHistoryTab(requestedTab) ? requestedTab : 'overview';
  const supplierQuery = useSupplier(params.id);
  const historyQuery = useSupplierPurchaseHistory(
    params.id,
    activeTab === 'overview' ? 'purchase_orders' : activeTab,
    page,
  );

  const supplier = supplierQuery.data;
  const historyRows = historyQuery.data?.data ?? [];
  const historyPagination = historyQuery.data?.pagination;

  const historyColumns = useMemo(() => {
    if (activeTab === 'grns') {
      return [
        { key: 'grnNumber', header: 'GRN #' },
        { key: 'poNumber', header: 'PO #' },
        { key: 'receivedDate', header: 'Received Date' },
        { key: 'qualityStatus', header: 'Quality Status' },
        { key: 'status', header: 'Status' }
      ];
    }

    if (activeTab === 'returns') {
      return [
        { key: 'returnNumber', header: 'Return #' },
        { key: 'returnDate', header: 'Return Date' },
        { key: 'totalValue', header: 'Total Value' },
        { key: 'status', header: 'Status' }
      ];
    }

    if (activeTab === 'payments') {
      return [
        { key: 'paymentNumber', header: 'Payment #' },
        { key: 'paymentDate', header: 'Payment Date' },
        { key: 'amount', header: 'Amount' },
        { key: 'method', header: 'Method' }
      ];
    }

    return [
      { key: 'poNumber', header: 'PO #' },
      { key: 'orderDate', header: 'Order Date' },
      { key: 'expectedDeliveryDate', header: 'Expected Delivery' },
      { key: 'itemsCount', header: 'Items' },
      { key: 'total', header: 'Total' },
      { key: 'status', header: 'Status' }
    ];
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier ? supplier.name : 'Supplier Detail'}
        description="Review supplier profile data and procurement history across purchase orders, receipts, returns, and payments."
      />

      <ProcurementNav />

      {supplier ? (
        <div className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Supplier Code</p>
            <p className="mt-2 text-sm font-semibold text-brown">{supplier.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Category</p>
            <p className="mt-2 text-sm font-semibold text-brown">{supplier.category.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Contact</p>
            <p className="mt-2 text-sm font-semibold text-brown">{supplier.contactPerson || '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Status</p>
            <div className="mt-2">
              <StatusBadge status={supplier.status} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={
                tab.key === 'overview'
                  ? `/procurement/suppliers/${params.id}`
                  : `/procurement/suppliers/${params.id}?tab=${tab.key}`
              }
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                activeTab === tab.key ? 'bg-brown text-white' : 'text-muted hover:bg-cream hover:text-brown'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brown">Overview</h2>
          <p className="mt-3 text-sm text-muted">
            Payment terms: {supplier?.paymentTerms || '-'} | Credit limit: {supplier?.creditLimit ?? 0} | Current
            balance: {supplier?.currentBalance ?? 0}
          </p>
        </div>
      ) : (
        <>
          <DataTable<Record<string, unknown>>
            data={historyRows as Record<string, unknown>[]}
            loading={historyQuery.isLoading}
            pagination={historyPagination}
            columns={historyColumns.map((column) => ({
              ...column,
              render:
                column.key === 'status' || column.key === 'qualityStatus'
                  ? (row: Record<string, unknown>) => <StatusBadge status={String(row[column.key] ?? '-')} />
                  : undefined
            }))}
            emptyState={
              <EmptyState
                icon={<PackageSearch className="h-6 w-6" />}
                title="No records found"
                description="No supplier history rows are available for this tab yet."
              />
            }
          />

          {historyPagination ? (
            <PaginationControls
              page={historyPagination.page}
              pageSize={historyPagination.pageSize}
              total={historyPagination.total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
