'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, BookmarkPlus, History } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import {
  ChartCard,
  DataTable,
  EmptyState,
  type FilterConfig,
  FilterBar,
  FormDrawer,
  LoadingState
} from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';
import { getAllowedReportTypesForRoles } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/usePermission';
import {
  type ReportFilters,
  type ReportType,
  buildReportQuery,
  useCreateSavedReportFilter,
  useDeleteSavedReportFilter,
  useReports,
  useSavedReportFilters
} from '@/hooks/reports/useReports';
import { useUserContext } from '@/contexts/UserContext';
import { downloadFromUrl } from '@/lib/export';

const reportLabels: Record<ReportType, string> = {
  branch_sales: 'Branch Sales Report',
  branch_shift_close_summary: 'Branch Shift Close Summary',
  daily_production: 'Daily Production Report',
  expiry_alert: 'Expiry Alert Report',
  inventory_valuation: 'Inventory Valuation Report',
  financial_position: 'Financial Position',
  financial_ratios: 'Financial Ratios',
  income_statement: 'Income Statement',
  low_stock: 'Low Stock Report',
  raw_material_usage: 'Raw Material Usage Report',
  supplier_purchase: 'Supplier Purchase Report',
  trial_balance: 'Trial Balance',
  wastage: 'Wastage Report',
  worker_productivity: 'Worker Productivity Report'
};

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);

  return {
    endDate: end.toISOString().slice(0, 10),
    startDate: start.toISOString().slice(0, 10)
  };
}

function buildFiltersForReportType(reportType: ReportType, filters: ReportFilters) {
  const dateFilters: FilterConfig[] = [
    {
      key: 'startDate',
      label: 'Start Date',
      type: 'date' as const,
      value: filters.startDate ?? ''
    },
    {
      key: 'endDate',
      label: 'End Date',
      type: 'date' as const,
      value: filters.endDate ?? ''
    }
  ];

  if (reportType === 'low_stock') {
    return [];
  }

  if (reportType === 'expiry_alert') {
    return [
      {
        key: 'daysAhead',
        label: 'Days Ahead',
        type: 'select' as const,
        value: String(filters.daysAhead ?? 30),
        options: [
          { label: '7 days', value: '7' },
          { label: '14 days', value: '14' },
          { label: '30 days', value: '30' },
          { label: '60 days', value: '60' }
        ]
      },
      {
        key: 'branchId',
        label: 'Branch ID',
        type: 'search' as const,
        value: filters.branchId ?? '',
        placeholder: 'Filter by branch ID'
      }
    ];
  }

  const shared: FilterConfig[] = [...dateFilters];

  if (reportType === 'daily_production' || reportType === 'wastage') {
    shared.push({
      key: 'shift',
      label: 'Shift',
      type: 'select',
      value: filters.shift ?? '',
      options: [
        { label: 'Day', value: 'DAY' },
        { label: 'Night', value: 'NIGHT' }
      ]
    });
  }

  if (reportType === 'daily_production') {
    shared.push({
      key: 'productionLine',
      label: 'Production Line',
      type: 'search',
      value: filters.productionLine ?? '',
      placeholder: 'Line A'
    });
  }

  if (reportType === 'wastage' || reportType === 'branch_sales') {
    shared.push({
      key: 'productId',
      label: 'Product ID',
      type: 'search',
      value: filters.productId ?? '',
      placeholder: 'Filter by product ID'
    });
  }

  if (reportType === 'raw_material_usage') {
    shared.push(
      {
        key: 'itemId',
        label: 'Item ID',
        type: 'search',
        value: filters.itemId ?? '',
        placeholder: 'Raw material item ID'
      },
      {
        key: 'warehouseId',
        label: 'Warehouse ID',
        type: 'search',
        value: filters.warehouseId ?? '',
        placeholder: 'Warehouse ID'
      },
    );
  }

  if (reportType === 'branch_sales' || reportType === 'branch_shift_close_summary') {
    shared.push({
      key: 'branchId',
      label: 'Branch ID',
      type: 'search',
      value: filters.branchId ?? '',
      placeholder: 'Branch ID'
    });
  }

  if (reportType === 'inventory_valuation') {
    shared.push({
      key: 'warehouseId',
      label: 'Warehouse ID',
      type: 'search',
      value: filters.warehouseId ?? '',
      placeholder: 'Warehouse ID'
    });
  }

  if (reportType === 'supplier_purchase') {
    shared.push({
      key: 'supplierId',
      label: 'Supplier ID',
      type: 'search',
      value: filters.supplierId ?? '',
      placeholder: 'Supplier ID'
    });
  }

  if (reportType === 'worker_productivity') {
    shared.push({
      key: 'employeeId',
      label: 'Employee ID',
      type: 'search',
      value: filters.employeeId ?? '',
      placeholder: 'Employee ID'
    });
  }

  return shared;
}

function getNumericKeys(data: Array<Record<string, unknown>>) {
  const keys = new Set<string>();

  data.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === 'number') {
        keys.add(key);
      }
    });
  });

  return Array.from(keys);
}

function getLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ReportsPage() {
  const { currentUser } = useUserContext();
  const canReadReports = usePermission(PERMISSIONS.reports.read);
  const [reportType, setReportType] = useState<ReportType>('daily_production');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isQueueingPdf, setIsQueueingPdf] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [savedFilterName, setSavedFilterName] = useState('');
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    ...getDefaultDateRange(),
    daysAhead: 30
  }));
  const savedFiltersQuery = useSavedReportFilters();
  const createSavedFilter = useCreateSavedReportFilter();
  const roleNames = useMemo(() => currentUser?.roles.map((role) => role.name) ?? [], [currentUser?.roles]);
  const allowedReportTypes = useMemo(
    () => getAllowedReportTypesForRoles(roleNames) as ReportType[],
    [roleNames],
  );
  const activeReportType = allowedReportTypes.includes(reportType)
    ? reportType
    : (allowedReportTypes[0] ?? reportType);
  const activeSavedFilters = useMemo(
    () => (savedFiltersQuery.data ?? []).filter((savedFilter) => savedFilter.report_type === activeReportType),
    [activeReportType, savedFiltersQuery.data],
  );

  const reportQuery = useReports(activeReportType, filters, {
    enabled: canReadReports && allowedReportTypes.length > 0
  });
  const reportData = useMemo(
    () => ((reportQuery.data?.data ?? []) as Array<Record<string, unknown>>),
    [reportQuery.data?.data],
  );
  const chartData = useMemo(
    () => ((reportQuery.data?.chart ?? []) as Array<Record<string, unknown>>),
    [reportQuery.data?.chart],
  );
  const summary = (reportQuery.data?.summary ?? {}) as Record<string, unknown>;
  const tableColumns = useMemo(() => {
    const firstRow = reportData[0];

    if (!firstRow) {
      return [];
    }

    return Object.keys(firstRow).map((key) => ({
      key,
      header: getLabel(key)
    }));
  }, [reportData]);
  const numericKeys = useMemo(() => getNumericKeys(chartData), [chartData]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!allowedReportTypes.length) {
      return;
    }

    if (!allowedReportTypes.includes(reportType)) {
      const firstAllowed = allowedReportTypes[0];
      if (firstAllowed) {
        setReportType(firstAllowed);
      }
    }
  }, [allowedReportTypes, reportType]);

  if (!canReadReports) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Reports access is restricted"
        description="Your role does not currently include reports permissions."
      />
    );
  }

  if (!allowedReportTypes.length) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="No reports available"
        description="Your role does not have scoped report access."
      />
    );
  }

  const exportCsv = async () => {
    setIsExportingCsv(true);

    try {
      await downloadFromUrl(
        `/api/reports/export/csv${buildReportQuery({
          ...filters,
          reportType: activeReportType
        })}`,
        {
          filename: `${activeReportType}-${new Date().toISOString().slice(0, 10)}.csv`,
        },
      );
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'CSV export failed.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const exportPdf = async () => {
    setIsQueueingPdf(true);

    try {
      await downloadFromUrl(
        `/api/reports/export/pdf${buildReportQuery({
          ...filters,
          reportType: activeReportType
        })}`,
        {
          filename: `${activeReportType}-${new Date().toISOString().slice(0, 10)}.pdf`,
        },
      );
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'PDF export failed.');
    } finally {
      setIsQueueingPdf(false);
    }
  };

  const showPie = activeReportType === 'wastage' && chartData.some((row) => 'reason' in row && 'value' in row);
  const defaultXAxisKey = (chartData[0] ? Object.keys(chartData[0])[0] : 'label') as string;
  const defaultBarKey = numericKeys[0] ?? 'value';
  const secondaryBarKey = numericKeys[1];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Generate operational reports, visualize trends, save favorite filters, and export analytics."
        status="partial"
        actions={
          <>
            <Button variant={viewMode === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('chart')}>
              Chart View
            </Button>
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
              Table View
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSaveFilterOpen(true)}>
              Save Filter
            </Button>
            <Link href="/reports/history">
              <Button size="sm" variant="outline">
                <History className="mr-2 h-4 w-4" />
                Export History
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={isExportingCsv}>
              {isExportingCsv ? 'Exporting CSV...' : 'Export CSV'}
            </Button>
            <Button size="sm" onClick={exportPdf} disabled={isQueueingPdf}>
              {isQueueingPdf ? 'Exporting PDF...' : 'Export PDF'}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/finance/reports#trial-balance', label: 'Trial Balance' },
          { href: '/finance/reports#income-statement', label: 'Income Statement' },
          { href: '/finance/reports#financial-position', label: 'Financial Position' },
          { href: '/finance/reports#ratios', label: 'Ratios' },
        ].map((statement) => (
          <Link
            key={statement.href}
            href={statement.href}
            className="group rounded-2xl border border-border bg-cream px-4 py-4 text-sm font-semibold text-brown transition hover:border-brown/30 hover:bg-white"
          >
            <span>{statement.label}</span>
            <ArrowUpRight className="ml-2 inline h-4 w-4 text-muted transition group-hover:text-brown" />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        {allowedReportTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setReportType(type)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              reportType === type
                ? 'border-orange bg-orange/10 text-deepOrange'
                : 'border-border bg-cream text-muted hover:border-orange/40'
            }`}
          >
            <p className="font-semibold">{reportLabels[type]}</p>
          </button>
        ))}
      </div>

      <FilterBar
        filters={buildFiltersForReportType(activeReportType, filters)}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: key === 'daysAhead' ? Number(value) : value
          }))
        }
      />

      {activeSavedFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm">
          {activeSavedFilters.map((savedFilter) => (
            <SavedFilterChip
              key={savedFilter.id}
              filterName={savedFilter.filter_name}
              onApply={() => setFilters((savedFilter.filter_values ?? {}) as ReportFilters)}
              savedFilterId={savedFilter.id}
            />
          ))}
        </div>
      ) : null}

      {reportQuery.isLoading ? <LoadingState /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{getLabel(key)}</p>
            <p className="mt-2 text-2xl font-semibold text-brown">{String(value)}</p>
          </div>
        ))}
      </div>

      {viewMode === 'chart' ? (
        <ChartCard title={reportLabels[activeReportType]} subtitle="Visualization generated from the selected report and filters.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              {showPie ? (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={chartData} dataKey="value" nameKey="reason" outerRadius={105} fill="#F97316" />
                </PieChart>
              ) : activeReportType === 'raw_material_usage' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3D7B6" />
                  <XAxis dataKey="date" stroke="#6B4A3A" fontSize={12} />
                  <YAxis stroke="#6B4A3A" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="received" stroke="#16A34A" strokeWidth={2} />
                  <Line type="monotone" dataKey="issued" stroke="#F97316" strokeWidth={2} />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3D7B6" />
                  <XAxis dataKey={defaultXAxisKey} stroke="#6B4A3A" fontSize={12} />
                  <YAxis stroke="#6B4A3A" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={defaultBarKey} fill="#F97316" radius={[8, 8, 0, 0]} />
                  {secondaryBarKey ? <Bar dataKey={secondaryBarKey} fill="#3B1F12" radius={[8, 8, 0, 0]} /> : null}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : (
        <DataTable
          columns={tableColumns}
          data={reportData}
          emptyState={
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No report rows found"
              description="Try adjusting the selected report or filter values."
            />
          }
        />
      )}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-border bg-white px-4 py-3 text-sm text-brown shadow-md">
          {toastMessage}
        </div>
      ) : null}

      <FormDrawer title="Save Report Filter" open={saveFilterOpen} onClose={() => setSaveFilterOpen(false)}>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-muted">
            <span>Filter Name</span>
            <input
              value={savedFilterName}
              onChange={(event) => setSavedFilterName(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none"
              placeholder="e.g. This Week Production"
            />
          </label>
          <Button
            onClick={async () => {
              try {
                await createSavedFilter.mutateAsync({
                  category: 'general',
                  filterName: savedFilterName,
                  filters: filters as Record<string, unknown>,
                  reportType: activeReportType,
                });
                setSavedFilterName('');
                setSaveFilterOpen(false);
                setToastMessage('Report filter saved.');
              } catch (error) {
                setToastMessage(error instanceof Error ? error.message : 'Failed to save filter.');
              }
            }}
            disabled={createSavedFilter.isPending || !savedFilterName.trim()}
          >
            {createSavedFilter.isPending ? 'Saving...' : 'Save Filter'}
          </Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function SavedFilterChip({
  filterName,
  onApply,
  savedFilterId,
}: {
  filterName: string;
  onApply: () => void;
  savedFilterId: string;
}) {
  const removeFilter = useDeleteSavedReportFilter(savedFilterId);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-cream px-3 py-2 text-sm">
      <button type="button" onClick={onApply} className="font-medium text-brown">
        <BookmarkPlus className="mr-2 inline h-4 w-4" />
        {filterName}
      </button>
      <button
        type="button"
        onClick={async () => {
          await removeFilter.mutateAsync();
        }}
        className="text-xs text-muted"
      >
        Remove
      </button>
    </div>
  );
}
