'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFixedAssets } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceFixedAssetsPage() {
  const query = useFixedAssets();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Fixed assets unavailable" description={query.error?.message ?? 'No fixed asset data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Fixed Assets" description="Track assets, useful lives, accumulated depreciation, and carrying values." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'asset_code', header: 'Asset #' },
          { key: 'name', header: 'Name' },
          { key: 'category', header: 'Category' },
          { key: 'purchase_date', header: 'Purchase Date' },
          { key: 'purchase_cost', header: 'Cost', render: (row) => currency.format(Number(row.purchase_cost ?? 0)) },
          { key: 'accumulated_dep', header: 'Accumulated Dep.', render: (row) => currency.format(Number(row.accumulated_dep ?? 0)) },
          { key: 'current_value', header: 'Current Value', render: (row) => currency.format(Number(row.current_value ?? 0)) },
        ]}
        data={query.data}
      />
    </div>
  );
}
