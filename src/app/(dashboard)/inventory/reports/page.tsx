'use client';

import { ChartColumnBig } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { DataTable, EmptyState, FilterBar } from '@/components/ui-library';
import { useInventoryReport } from '@/hooks/inventory';
import { API_ROUTES } from '@/lib/shared';

const reportOptions = [
  { label: 'Stock Movement', value: 'stock-movement' },
  { label: 'Valuation', value: 'valuation' },
  { label: 'Opening vs Closing', value: 'opening-closing' },
  { label: 'Supplier Shortages', value: 'supplier-shortages' },
  { label: 'Branch Stock', value: 'branch-stock' },
];

const reportPathByType: Record<string, string> = {
  'branch-stock': API_ROUTES.INVENTORY.REPORT_BRANCH_STOCK,
  'opening-closing': API_ROUTES.INVENTORY.REPORT_OPENING_CLOSING,
  'stock-movement': API_ROUTES.INVENTORY.REPORT_STOCK_MOVEMENT,
  'supplier-shortages': API_ROUTES.INVENTORY.REPORT_SUPPLIER_SHORTAGES,
  valuation: API_ROUTES.INVENTORY.REPORT_VALUATION,
};

export default function InventoryReportsPage() {
  const [reportType, setReportType] = useState('stock-movement');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const query = useInventoryReport<Record<string, unknown>>(reportPathByType[reportType], {
    endDate: endDate || undefined,
    startDate: startDate || undefined,
  });

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
        title="Inventory Reports"
        description="Review stock movement, valuation, branch stock, shortage, and opening-closing reports with direct CSV export from the same filters."
      />

      <InventoryNav />

      <div className="surface-card flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <FilterBar
            filters={[
              {
                key: 'reportType',
                label: 'Report',
                type: 'select',
                value: reportType,
                options: reportOptions,
              },
              {
                key: 'startDate',
                label: 'Start date',
                type: 'date',
                value: startDate,
              },
              {
                key: 'endDate',
                label: 'End date',
                type: 'date',
                value: endDate,
              },
            ]}
            onFilterChange={(key, value) => {
              if (key === 'reportType') setReportType(value);
              if (key === 'startDate') setStartDate(value);
              if (key === 'endDate') setEndDate(value);
            }}
          />
        </div>

        <a
          href={`${API_ROUTES.INVENTORY.EXPORT(reportType)}${startDate || endDate ? `?${new URLSearchParams({ ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }).toString()}` : ''}`}
          className="inline-flex items-center justify-center rounded-2xl bg-brown px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brown/90"
        >
          Export CSV
        </a>
      </div>

      <DataTable
        data={query.data?.data ?? []}
        loading={query.isLoading}
        columns={columns}
        emptyState={
          <EmptyState
            icon={<ChartColumnBig className="h-6 w-6" />}
            title="No report data available"
            description="Adjust the report type or date range to load inventory reporting rows."
          />
        }
      />
    </div>
  );
}
