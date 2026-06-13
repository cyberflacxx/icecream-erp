'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesPrices } from '@/hooks/sales/useSalesPrices';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesPricesPage() {
  const query = useSalesPrices();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Prices unavailable" description={query.error?.message ?? 'No price data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Price Management" description="Review price lists, effective dates, and active selling prices." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'price_list_code', header: 'Price List' },
          { key: 'selling_price', header: 'Selling Price' },
          { key: 'effective_date', header: 'Effective Date' },
          { key: 'expiry_date', header: 'Expiry Date' },
          { key: 'is_active', header: 'Active' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
      />
    </div>
  );
}
