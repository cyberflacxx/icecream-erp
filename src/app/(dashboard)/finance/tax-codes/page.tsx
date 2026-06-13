'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useTaxCodes } from '@/hooks/finance/useFinanceResources';

export default function FinanceTaxCodesPage() {
  const query = useTaxCodes();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Tax codes unavailable" description={query.error?.message ?? 'No tax code data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Tax Management" description="Review tax codes, rates, and tax application coverage." status="partial" />
      <FinanceNav />
      <DataTable columns={[{ key: 'code', header: 'Code' }, { key: 'name', header: 'Name' }, { key: 'rate', header: 'Rate' }, { key: 'applies_to_sales', header: 'Sales' }, { key: 'applies_to_purchase', header: 'Purchases' }, { key: 'is_active', header: 'Active' }]} data={query.data} />
    </div>
  );
}
