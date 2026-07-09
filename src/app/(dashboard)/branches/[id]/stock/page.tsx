'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchStock, useBranchStockLedger } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
function formatDate(value: string | null | undefined) {
  if (!value) return 'No movement yet';
  return new Date(value).toLocaleDateString();
}

export default function BranchStockPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const stockQuery = useBranchStock(branchId, { page: 1, pageSize: 50 });
  const ledgerQuery = useBranchStockLedger(branchId);

  if (stockQuery.isLoading || ledgerQuery.isLoading) return <LoadingState />;
  if (stockQuery.isError || !stockQuery.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch stock unavailable" description={stockQuery.error?.message ?? 'No branch stock returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Branch Stock" description="Review branch stock balances and recent ledger movement." />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          {
            key: 'item',
            header: 'Item',
            render: (row) => `${row.item.code} - ${row.item.name}`,
          },
          {
            key: 'category',
            header: 'Category',
            render: (row) => row.item.category ?? 'Uncategorized',
          },
          { key: 'quantityOnHand', header: 'On Hand' },
          { key: 'quantityAvailable', header: 'Available' },
          {
            key: 'unit',
            header: 'Unit',
            render: (row) => row.item.unit?.abbreviation || row.item.unit?.name || 'Unit',
          },
          {
            key: 'warehouse',
            header: 'Warehouse',
            render: (row) =>
              row.warehouse?.code
                ? `${row.warehouse.code} - ${row.warehouse.name}`
                : row.warehouse?.name ?? 'No warehouse linked',
          },
          {
            key: 'lastMovementDate',
            header: 'Last Movement',
            render: (row) => formatDate(row.item.lastMovementDate),
          },
          { key: 'unitCost', header: 'Unit Cost', render: (row) => currencyFormatter.format(row.unitCost) },
          { key: 'totalValue', header: 'Stock Value', render: (row) => currencyFormatter.format(row.totalValue) },
        ]}
        data={stockQuery.data.data}
        pagination={stockQuery.data.pagination}
        emptyState={
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="No branch items found"
            description="No items recorded for this branch yet."
          />
        }
      />
      <DataTable
        columns={[
          { key: 'transaction_date', header: 'Date' },
          { key: 'movement_type', header: 'Movement' },
          { key: 'reference_type', header: 'Reference' },
          { key: 'quantity', header: 'Quantity' },
          { key: 'total_cost', header: 'Value', render: (row) => currencyFormatter.format(Number(row.total_cost ?? 0)) },
        ]}
        data={ledgerQuery.data ?? []}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No stock ledger entries" description="Stock movement entries will appear here after receipts, sales, and adjustments." />}
      />
    </div>
  );
}
