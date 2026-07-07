'use client';

import { AlertCircle, BarChart3, Boxes, Factory, Percent } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { useProductionReport } from '@/hooks/production/useProductionReport';
import { downloadFromUrl } from '@/lib/export';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';

function asRows(data: unknown) {
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
}

function formatNumber(value: unknown, digits = 3) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0';
  return amount.toFixed(digits);
}

function formatCurrency(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isNaN(amount) ? 0 : amount);
}

export default function ProductionReportsPage() {
  const [exportingReport, setExportingReport] = useState<string | null>(null);
  const varianceQuery = useProductionReport(API_ROUTES.PRODUCTION.REPORT_VARIANCE);
  const consumptionQuery = useProductionReport(API_ROUTES.PRODUCTION.REPORT_MATERIAL_CONSUMPTION);
  const yieldQuery = useProductionReport(API_ROUTES.PRODUCTION.REPORT_YIELD);
  const costingQuery = useProductionReport(API_ROUTES.PRODUCTION.REPORT_COSTING);

  const isLoading = [varianceQuery, consumptionQuery, yieldQuery, costingQuery].some((query) => query.isLoading);
  const hasAnyData = [varianceQuery, consumptionQuery, yieldQuery, costingQuery].some((query) => Array.isArray(query.data));
  const firstError = [varianceQuery, consumptionQuery, yieldQuery, costingQuery].find((query) => query.isError)?.error;

  if (isLoading) return <LoadingState />;
  if (!hasAnyData && firstError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Reports unavailable"
        description={firstError.message ?? 'No production report data returned.'}
      />
    );
  }

  const varianceRows = asRows(varianceQuery.data);
  const consumptionRows = asRows(consumptionQuery.data);
  const yieldRows = asRows(yieldQuery.data);
  const costingRows = asRows(costingQuery.data);

  async function handleExport(reportType: string) {
    setExportingReport(reportType);

    try {
      await downloadFromUrl(API_ROUTES.PRODUCTION.EXPORT(reportType), {
        filename: `production-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } finally {
      setExportingReport(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Reports"
        description="Review material usage, output variance, yield, and costing together so production decisions are grounded in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => handleExport('variance')} disabled={exportingReport === 'variance'}>
              {exportingReport === 'variance' ? 'Exporting...' : 'Variance CSV'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleExport('material-consumption')}
              disabled={exportingReport === 'material-consumption'}
            >
              {exportingReport === 'material-consumption' ? 'Exporting...' : 'Materials CSV'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => handleExport('yield')} disabled={exportingReport === 'yield'}>
              {exportingReport === 'yield' ? 'Exporting...' : 'Yield CSV'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => handleExport('costing')} disabled={exportingReport === 'costing'}>
              {exportingReport === 'costing' ? 'Exporting...' : 'Costing CSV'}
            </Button>
          </div>
        }
      />
      <ProductionNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5 text-orange" />}
          label="Variance Rows"
          value={String(varianceRows.length)}
          helper="Expected versus actual output"
        />
        <SummaryCard
          icon={<Boxes className="h-5 w-5 text-orange" />}
          label="Material Usage Rows"
          value={String(consumptionRows.length)}
          helper="Raw-material consumption trail"
        />
        <SummaryCard
          icon={<Percent className="h-5 w-5 text-orange" />}
          label="Yield Rows"
          value={String(yieldRows.length)}
          helper="Accepted output versus mix used"
        />
        <SummaryCard
          icon={<Factory className="h-5 w-5 text-orange" />}
          label="Costing Rows"
          value={String(costingRows.length)}
          helper="Batch cost and unit cost view"
        />
      </div>

      <ReportSection
        title="Output Variance"
        description="Compare expected material usage and output against what actually happened in each batch."
        rows={varianceRows}
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'productName', header: 'Product' },
          { key: 'shift', header: 'Shift' },
          { key: 'expectedOutput', header: 'Expected Output', render: (row) => formatNumber(row.expectedOutput) },
          { key: 'actualOutput', header: 'Actual Output', render: (row) => formatNumber(row.actualOutput) },
          { key: 'outputVariance', header: 'Output Variance', render: (row) => formatNumber(row.outputVariance) },
          { key: 'materialVariance', header: 'Material Variance', render: (row) => formatNumber(row.materialVariance) },
        ]}
      />

      <ReportSection
        title="Material Consumption"
        description="Track raw-material quantities used per batch and spot over-issue or under-use quickly."
        rows={consumptionRows}
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'itemName', header: 'Material' },
          { key: 'shift', header: 'Shift' },
          { key: 'expectedQuantity', header: 'Expected Qty', render: (row) => formatNumber(row.expectedQuantity) },
          { key: 'actualQuantity', header: 'Actual Qty', render: (row) => formatNumber(row.actualQuantity) },
          { key: 'quantityVariance', header: 'Variance', render: (row) => formatNumber(row.quantityVariance) },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportSection
          title="Yield"
          description="Watch how much accepted output was achieved from the production mix consumed."
          rows={yieldRows}
          columns={[
            { key: 'batchNumber', header: 'Batch #' },
            { key: 'productName', header: 'Product' },
            { key: 'shift', header: 'Shift' },
            { key: 'mixUsed', header: 'Mix Used', render: (row) => formatNumber(row.mixUsed) },
            { key: 'acceptedOutput', header: 'Accepted Output', render: (row) => formatNumber(row.acceptedOutput) },
            { key: 'yieldPercentage', header: 'Yield %', render: (row) => formatNumber(row.yieldPercentage, 2) },
          ]}
        />

        <ReportSection
          title="Costing"
          description="Review total batch cost and unit cost to understand production efficiency and product profitability."
          rows={costingRows}
          columns={[
            { key: 'batchNumber', header: 'Batch #' },
            { key: 'productName', header: 'Product' },
            { key: 'shift', header: 'Shift' },
            { key: 'acceptedOutput', header: 'Accepted Output', render: (row) => formatNumber(row.acceptedOutput) },
            { key: 'totalBatchCost', header: 'Total Batch Cost', render: (row) => formatCurrency(row.totalBatchCost) },
            { key: 'costPerUnit', header: 'Cost Per Unit', render: (row) => formatCurrency(row.costPerUnit) },
          ]}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{label}</p>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-semibold text-brown">{value}</p>
      <p className="mt-2 text-sm text-muted">{helper}</p>
    </div>
  );
}

function ReportSection({
  columns,
  description,
  rows,
  title,
}: {
  columns: Array<{
    header: string;
    key: string;
    render?: (row: Record<string, unknown>) => ReactNode;
  }>;
  description: string;
  rows: Array<Record<string, unknown>>;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brown">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyState={<EmptyState icon={<BarChart3 className="h-6 w-6" />} title={`No ${title.toLowerCase()} rows`} description="This report will fill in once production activity is posted." />}
      />
    </section>
  );
}
