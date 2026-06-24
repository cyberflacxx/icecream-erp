'use client';

import { ChartColumnBig } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { DataTable, EmptyState, FilterBar } from '@/components/ui-library';
import { useProcurementReport } from '@/hooks/procurement';
import { API_ROUTES } from '@/lib/shared';

const reportOptions = [
  { label: 'Purchase Orders', value: 'purchase-orders' },
  { label: 'Supplier Shortages', value: 'supplier-shortages' },
  { label: 'Supplier Performance', value: 'supplier-performance' },
  { label: 'Invoice Ageing', value: 'invoice-ageing' },
  { label: 'Cost Variance', value: 'cost-variance' },
];

const reportPathByType: Record<string, string> = {
  'cost-variance': API_ROUTES.PROCUREMENT.REPORT_COST_VARIANCE,
  'invoice-ageing': API_ROUTES.PROCUREMENT.REPORT_INVOICE_AGEING,
  'purchase-orders': API_ROUTES.PROCUREMENT.REPORT_PURCHASE_ORDERS,
  'supplier-performance': API_ROUTES.PROCUREMENT.REPORT_SUPPLIER_PERFORMANCE,
  'supplier-shortages': API_ROUTES.PROCUREMENT.REPORT_SUPPLIER_SHORTAGES,
};

export default function ProcurementReportsPage() {
  const [reportType, setReportType] = useState('purchase-orders');
  const query = useProcurementReport<Record<string, unknown>>(reportPathByType[reportType]);

  const columns = useMemo(() => {
    const firstRow = query.data?.data?.[0];
    if (!firstRow) return [];
    return Object.keys(firstRow).map((key) => ({
      key,
      header: key,
      render: (row: Record<string, unknown>) => String(row[key] ?? ''),
    }));
  }, [query.data?.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Reports"
        description="Review purchasing, shortage, supplier performance, invoice ageing, and cost variance reports with direct CSV export."
      />
      <ProcurementNav />

      <div className="surface-card flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <FilterBar
          filters={[{ key: 'reportType', label: 'Report', type: 'select', value: reportType, options: reportOptions }]}
          onFilterChange={(_, value) => setReportType(value)}
        />
        <a
          href={API_ROUTES.PROCUREMENT.EXPORT(reportType)}
          className="inline-flex items-center justify-center rounded-2xl bg-brown px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brown/90"
        >
          Export CSV
        </a>
      </div>

      <DataTable
        data={query.data?.data ?? []}
        loading={query.isLoading}
        columns={columns}
        emptyState={<EmptyState icon={<ChartColumnBig className="h-6 w-6" />} title="No report data available" description="Switch report type to review procurement metrics and detailed rows." />}
      />
    </div>
  );
}
