'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { useSalesDiscounts } from '@/hooks/sales/useSalesDiscounts';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

export default function SalesDiscountsPage() {
  const query = useSalesDiscounts();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Discounts unavailable" description={query.error?.message ?? 'No discount data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Discount Management" description="Monitor discount values, approval requirements, and active rules." status="partial" />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'name', header: 'Rule' },
          { key: 'discount_type', header: 'Type' },
          { key: 'discount_value', header: 'Value' },
          { key: 'approval_required', header: 'Approval Required' },
          { key: 'approval_status', header: 'Approval Status' },
          { key: 'is_active', header: 'Active' },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No discounts found" description="Discount rules will appear here once they are configured." />}
      />
    </div>
  );
}
