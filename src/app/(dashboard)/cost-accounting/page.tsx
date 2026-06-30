'use client';

import { AlertTriangle, DollarSign, Package, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';
import { useBatch, useBatches } from '@/hooks/production/useBatches';
import { useBatchAction } from '@/hooks/production/useBatchAction';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';

function money(value: number) {
  return new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(value);
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

type CostDraft = {
  id: string;
  itemId: string;
  quantityActual: string;
  quantityIssued: string;
  unitCost: string;
};

export default function CostAccountingPage() {
  const batchesQuery = useBatches({ limit: 50 });
  const metaQuery = useProductionMeta();
  const actions = useBatchAction();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [costDrafts, setCostDrafts] = useState<CostDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const batchDetailQuery = useBatch(selectedBatchId ?? '');
  const batchDetail = batchDetailQuery.data as Record<string, unknown> | undefined;
  const rows =
    batchesQuery.data && typeof batchesQuery.data === 'object' && Array.isArray((batchesQuery.data as { data?: unknown }).data)
      ? (batchesQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const itemById = new Map((metaQuery.data?.items ?? []).map((item) => [item.id, item]));

  useEffect(() => {
    if (!batchDetail) return;
    const materials = Array.isArray(batchDetail.materials) ? batchDetail.materials as Array<Record<string, unknown>> : [];
    setCostDrafts(materials.map((material) => ({
      id: String(material.id),
      itemId: String(material.item_id ?? ''),
      quantityActual: String(material.quantity_actual ?? material.quantity_issued ?? 0),
      quantityIssued: String(material.quantity_issued ?? material.quantity_actual ?? 0),
      unitCost: String(material.unit_cost ?? 0),
    })));
  }, [batchDetail]);

  const totalMaterialCost = rows.reduce((sum, row) => sum + numberValue(row.materialCost), 0);
  const totalLabourCost = rows.reduce((sum, row) => sum + numberValue(row.labourCost), 0);
  const totalOverheadCost = rows.reduce((sum, row) => sum + numberValue(row.overheadCost), 0);
  const totalOutput = rows.reduce((sum, row) => sum + numberValue(row.actualOutput), 0);
  const totalCost = totalMaterialCost + totalLabourCost + totalOverheadCost;
  const costPerUnit = totalOutput > 0 ? totalCost / totalOutput : 0;

  async function saveCostAdjustments() {
    if (!selectedBatchId) return;
    try {
      setFormError(null);
      await actions.recordMaterialUsage.mutateAsync({
        id: selectedBatchId,
        materials: costDrafts.map((draft) => ({
          id: draft.id,
          quantityActual: Number(draft.quantityActual),
          quantityIssued: Number(draft.quantityIssued),
          unitCost: Number(draft.unitCost),
        })),
      });
      await batchDetailQuery.refetch();
      await batchesQuery.refetch();
      setSelectedBatchId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save cost adjustments.');
    }
  }

  if (batchesQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (batchesQuery.isError || !batchesQuery.data) {
    return <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Cost accounting unavailable" description={batchesQuery.error?.message ?? 'No production batch costing data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cost Accounting"
        description="Review materials used per batch and adjust actual unit prices for production costing."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Production Cost" value={money(totalCost)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Material Cost" value={money(totalMaterialCost)} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Labour + Overhead" value={money(totalLabourCost + totalOverheadCost)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Cost Per Unit" value={money(costPerUnit)} icon={<SlidersHorizontal className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          {
            key: 'recipe',
            header: 'Recipe',
            render: (row) => String(((row as Record<string, unknown>).recipe as Record<string, unknown> | null)?.name ?? ''),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String((row as Record<string, unknown>).status ?? '')} />,
          },
          {
            key: 'actualOutput',
            header: 'Output',
            render: (row) => numberValue((row as Record<string, unknown>).actualOutput).toFixed(3),
          },
          {
            key: 'materialCost',
            header: 'Materials',
            render: (row) => money(numberValue((row as Record<string, unknown>).materialCost)),
          },
          {
            key: 'totalCost',
            header: 'Total Cost',
            render: (row) => money(numberValue((row as Record<string, unknown>).materialCost) + numberValue((row as Record<string, unknown>).labourCost) + numberValue((row as Record<string, unknown>).overheadCost)),
          },
          {
            key: 'costPerUnit',
            header: 'Cost/Unit',
            render: (row) => {
              const output = numberValue((row as Record<string, unknown>).actualOutput);
              const rowCost = numberValue((row as Record<string, unknown>).materialCost) + numberValue((row as Record<string, unknown>).labourCost) + numberValue((row as Record<string, unknown>).overheadCost);
              return money(output > 0 ? rowCost / output : 0);
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedBatchId(String((row as Record<string, unknown>).id))}>
                Adjust Prices
              </Button>
            ),
          },
        ]}
        data={rows}
        emptyState={<EmptyState icon={<DollarSign className="h-6 w-6" />} title="No batch costs" description="Material costs appear after production material usage is recorded." />}
      />

      <FormDrawer title="Adjust Material Prices" open={Boolean(selectedBatchId)} onClose={() => setSelectedBatchId(null)}>
        <div className="space-y-5">
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          {batchDetailQuery.isLoading ? <LoadingState /> : null}
          {costDrafts.length === 0 && !batchDetailQuery.isLoading ? (
            <EmptyState icon={<Package className="h-6 w-6" />} title="No material usage lines" description="Reserve and record production materials before adjusting costs." />
          ) : null}
          {costDrafts.map((draft, index) => {
            const item = itemById.get(draft.itemId);
            const lineCost = Number(draft.quantityActual || 0) * Number(draft.unitCost || 0);
            return (
              <div key={draft.id} className="grid gap-3 rounded-2xl border border-border bg-cream/60 p-4 dark:border-darkBorder dark:bg-darkBg/40 md:grid-cols-[1fr_120px_120px_120px]">
                <div>
                  <p className="font-medium text-brown dark:text-darkText">{String(item?.code ?? '')} {String(item?.name ?? draft.itemId)}</p>
                  <p className="text-xs text-muted">Line total: {money(lineCost)}</p>
                </div>
                <label className="space-y-2 text-sm text-muted">
                  <span>Issued Qty</span>
                  <input className="surface-input-soft" min="0" step="0.001" type="number" value={draft.quantityIssued} onChange={(event) => setCostDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantityIssued: event.target.value } : row))} />
                </label>
                <label className="space-y-2 text-sm text-muted">
                  <span>Actual Used</span>
                  <input className="surface-input-soft" min="0" step="0.001" type="number" value={draft.quantityActual} onChange={(event) => setCostDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantityActual: event.target.value } : row))} />
                </label>
                <label className="space-y-2 text-sm text-muted">
                  <span>Actual Unit Price</span>
                  <input className="surface-input-soft" min="0" step="0.0001" type="number" value={draft.unitCost} onChange={(event) => setCostDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row))} />
                </label>
              </div>
            );
          })}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSelectedBatchId(null)}>Cancel</Button>
            <Button type="button" onClick={saveCostAdjustments} disabled={costDrafts.length === 0}>Save Adjusted Prices</Button>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}
