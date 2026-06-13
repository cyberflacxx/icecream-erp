'use client';

import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useBranchStock, useBranchStockLedger } from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
          { key: 'item', header: 'Item', render: (row) => `${row.item.code} - ${row.item.name}` },
          { key: 'quantityOnHand', header: 'On Hand' },
          { key: 'quantityAvailable', header: 'Available' },
          { key: 'unitCost', header: 'Unit Cost', render: (row) => currencyFormatter.format(row.unitCost) },
          { key: 'totalValue', header: 'Stock Value', render: (row) => currencyFormatter.format(row.totalValue) },
        ]}
        data={stockQuery.data.data}
        pagination={stockQuery.data.pagination}
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
