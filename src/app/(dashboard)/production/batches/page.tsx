'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Factory,
  PackageCheck,
  Plus,
  Scale,
  Warehouse,
  XCircle,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useBatch, useBatches } from '@/hooks/production/useBatches';
import { useBatchAction } from '@/hooks/production/useBatchAction';
import { type ProductionMetaRecipe, useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';

const today = new Date().toISOString().slice(0, 10);

const actionButtonClassNames = {
  cancel: 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white',
  issue: 'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white',
  release: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white',
  view: 'border border-brown/15 bg-white text-brown hover:border-brown hover:bg-brown hover:text-white',
} as const;

const initialCreateState = {
  expectedOutput: '1000',
  plannedQuantity: '1000',
  productionCategory: 'ICE_CREAM_MAKING',
  productionDate: today,
  productionLine: 'Main Line',
  recipeId: '',
  shift: 'DAY',
  warehouseId: '',
};

type RequirementRow = {
  availableQuantity: number;
  itemCode: string;
  itemId: string;
  itemName: string;
  requiredQuantity: number;
  unit: string;
};

type FeedbackState = {
  message: string;
  tone: 'error' | 'success';
};

function asRows(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatStatus(status: unknown) {
  return String(status ?? '').replaceAll('_', ' ') || 'UNKNOWN';
}

function statusVariant(status: unknown) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'COMPLETED') return 'success' as const;
  if (['IN_PROGRESS', 'WIP', 'QUALITY_CHECK'].includes(normalized)) return 'info' as const;
  if (normalized === 'CANCELLED') return 'error' as const;
  if (normalized.includes('MATERIAL') || normalized === 'PLANNED') return 'warning' as const;
  return 'neutral' as const;
}

function isIssued(status: string) {
  return ['IN_PROGRESS', 'WIP', 'QUALITY_CHECK', 'COMPLETED'].includes(status);
}

function canIssue(status: string) {
  return ['PLANNED', 'MATERIALS_REQUESTED', 'MATERIALS_APPROVED', 'MATERIALS_RESERVED'].includes(status);
}

function canRelease(status: string) {
  return ['IN_PROGRESS', 'WIP', 'QUALITY_CHECK'].includes(status);
}

function calculateRequirements(input: {
  plannedQuantity: number;
  recipe: ProductionMetaRecipe | null | undefined;
  stockByItemWarehouse: Record<string, number>;
  units: Array<Record<string, unknown>>;
  warehouseId: string;
  items: Array<Record<string, unknown>>;
}) {
  const recipe = input.recipe;
  if (!recipe || !input.plannedQuantity || input.plannedQuantity <= 0) return [];

  const standardOutput = Number(recipe.expectedOutputQuantity || 1);
  const scale = standardOutput > 0 ? input.plannedQuantity / standardOutput : input.plannedQuantity;
  const itemById = new Map(input.items.map((item) => [String(item.id), item]));
  const unitById = new Map(input.units.map((unit) => [String(unit.id), unit]));
  const grouped = new Map<string, RequirementRow>();

  for (const line of [...asRows(recipe.ingredients), ...asRows(recipe.packagingItems)]) {
    const itemId = String(line.item_id ?? line.itemId ?? '');
    if (!itemId) continue;

    const baseQuantity = Number(line.quantity_required ?? line.quantityRequired ?? 0);
    const wastagePercent = Math.max(0, Number(line.wastage_allowance_percent ?? line.wastageAllowancePercent ?? 0));
    const requiredQuantity = (baseQuantity * scale) + ((baseQuantity * scale * wastagePercent) / 100);
    const item = itemById.get(itemId);
    const unit = unitById.get(String(line.unit_id ?? line.unitId ?? ''));
    const current = grouped.get(itemId);

    grouped.set(itemId, {
      availableQuantity: Number(input.stockByItemWarehouse[`${itemId}:${input.warehouseId}`] ?? 0),
      itemCode: String(item?.code ?? ''),
      itemId,
      itemName: String(item?.name ?? 'Unknown material'),
      requiredQuantity: (current?.requiredQuantity ?? 0) + requiredQuantity,
      unit: String(unit?.abbreviation ?? unit?.name ?? ''),
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
}

export default function ProductionBatchesPage() {
  const searchParams = useSearchParams();
  const batchesQuery = useBatches();
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const actions = useBatchAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [createState, setCreateState] = useState(initialCreateState);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [releaseQuantity, setReleaseQuantity] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  const batchDetailQuery = useBatch(manageBatchId ?? '');
  const batchDetail = batchDetailQuery.data as Record<string, unknown> | undefined;
  const rows =
    batchesQuery.data && typeof batchesQuery.data === 'object' && Array.isArray((batchesQuery.data as { data?: unknown }).data)
      ? (batchesQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const stage = searchParams.get('stage');
  const viewMode = stage === 'release' ? 'release' : stage === 'issue' ? 'issue' : 'workflow';
  const visibleRows = rows.filter((row) => {
    const status = String(row.status ?? '').toUpperCase();
    if (viewMode === 'issue') return !['COMPLETED', 'CANCELLED'].includes(status);
    if (viewMode === 'release') return isIssued(status) || status === 'COMPLETED';
    return true;
  });

  const activeRecipes = (metaQuery.data?.recipes ?? []).filter((recipe) => String(recipe.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE');
  const productionWarehouses =
    (metaQuery.data?.productionMaterialWarehouses?.length ? metaQuery.data.productionMaterialWarehouses : metaQuery.data?.warehouses) ?? [];
  const selectedRecipe = activeRecipes.find((recipe) => recipe.id === createState.recipeId);
  const createRequirements = calculateRequirements({
    items: metaQuery.data?.items ?? [],
    plannedQuantity: Number(createState.plannedQuantity),
    recipe: selectedRecipe,
    stockByItemWarehouse: metaQuery.data?.stockByItemWarehouse ?? {},
    units: metaQuery.data?.unitsOfMeasure ?? [],
    warehouseId: createState.warehouseId,
  });
  const detailRecipe = (metaQuery.data?.recipes ?? []).find((recipe) => recipe.id === String(batchDetail?.recipeId ?? ''));
  const detailRequirements = calculateRequirements({
    items: metaQuery.data?.items ?? [],
    plannedQuantity: Number(batchDetail?.plannedQuantity ?? 0),
    recipe: detailRecipe,
    stockByItemWarehouse: metaQuery.data?.stockByItemWarehouse ?? {},
    units: metaQuery.data?.unitsOfMeasure ?? [],
    warehouseId: String(batchDetail?.warehouseId ?? ''),
  });

  const summary = visibleRows.reduce<{ inProduction: number; released: number; toIssue: number; total: number }>(
    (accumulator, row) => {
      const status = String(row.status ?? '').toUpperCase();
      accumulator.total += 1;
      if (canIssue(status)) accumulator.toIssue += 1;
      if (isIssued(status) && status !== 'COMPLETED') accumulator.inProduction += 1;
      if (status === 'COMPLETED') accumulator.released += 1;
      return accumulator;
    },
    { inProduction: 0, released: 0, toIssue: 0, total: 0 },
  );

  useEffect(() => {
    if (!batchDetail) return;
    const actual = Number(batchDetail.actualOutput ?? 0);
    const expected = Number(batchDetail.expectedOutput ?? batchDetail.plannedQuantity ?? 0);
    setReleaseQuantity(String(actual > 0 ? actual : expected));
    setReleaseNotes('');
  }, [batchDetail]);

  async function refreshProduction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['production-batches'] }),
      queryClient.invalidateQueries({ queryKey: ['production'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
      metaQuery.refetch(),
    ]);
  }

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plannedQuantity = Number(createState.plannedQuantity);
    const expectedOutput = Number(createState.expectedOutput || createState.plannedQuantity);

    if (!createState.recipeId || !createState.warehouseId || plannedQuantity <= 0 || expectedOutput <= 0) {
      setFormError('BOM, production warehouse, quantity to produce, and expected output are required.');
      return;
    }

    try {
      await request('/api/production/batches', {
        body: JSON.stringify({
          expectedOutput,
          plannedQuantity,
          productionCategory: createState.productionCategory,
          productionDate: createState.productionDate,
          productionLine: createState.productionLine,
          recipeId: createState.recipeId,
          shift: createState.shift,
          warehouseId: createState.warehouseId,
          workerCount: 0,
        }),
        method: 'POST',
      });
      setCreateState(initialCreateState);
      setFormError(null);
      setFeedback({ message: 'Production order created. Open it and click Issue to Production when production starts.', tone: 'success' });
      setCreateOpen(false);
      await refreshProduction();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create production order.');
    }
  }

  async function runAction(successMessage: string, action: () => Promise<unknown>) {
    try {
      setFormError(null);
      setFeedback(null);
      await action();
      setFeedback({ message: successMessage, tone: 'success' });
      await batchDetailQuery.refetch();
      await refreshProduction();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Production action failed.');
    }
  }

  async function issueToProduction() {
    if (!manageBatchId) return;
    await runAction('Raw materials issued to production and deducted from production inventory.', () => actions.startBatch.mutateAsync(manageBatchId));
  }

  async function releaseFinishedGoods() {
    if (!manageBatchId) return;
    const outputs = asRows(batchDetail?.outputs);
    const actualQuantity = Number(releaseQuantity);
    if (!outputs.length || actualQuantity <= 0) {
      setFormError('Enter a valid actual quantity produced before release.');
      return;
    }

    await runAction('Finished goods released into the production warehouse.', async () => {
      await actions.recordOutput.mutateAsync({
        id: manageBatchId,
        outputs: outputs.map((output, index) => ({
          actualQuantity: index === 0 ? actualQuantity : Number(output.actual_quantity ?? 0),
          id: String(output.id),
          notes: releaseNotes || undefined,
          wastageQuantity: Math.max(0, Number(output.expected_quantity ?? batchDetail?.expectedOutput ?? 0) - (index === 0 ? actualQuantity : Number(output.actual_quantity ?? 0))),
        })),
      });

      await actions.closeBatch.mutateAsync({
        actualMaterials: asRows(batchDetail?.materials).map((material) => ({
          itemId: String(material.item_id ?? ''),
          quantityActual: Number(material.quantity_actual ?? material.quantity_issued ?? material.quantity_required ?? 0),
        })),
        id: manageBatchId,
        wastageReason: releaseNotes || 'Released from SAP-style production flow.',
      });
    });
  }

  async function cancelBatch(id: string) {
    await runAction('Production order cancelled.', () => actions.cancelBatch.mutateAsync({ id, reason: 'Cancelled from production workflow.' }));
  }

  if (batchesQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (batchesQuery.isError || !batchesQuery.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Production unavailable" description={batchesQuery.error?.message ?? 'No batch data returned.'} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          viewMode === 'issue'
            ? 'Production Issues'
            : viewMode === 'release'
              ? 'Production Release'
              : 'Production Workflow'
        }
        description={
          viewMode === 'issue'
            ? 'Issue raw materials against the production order using the selected BOM standard and quantity to produce.'
            : viewMode === 'release'
              ? 'Release actual finished output back into the production warehouse after production is complete.'
              : 'Simple SAP-style manufacturing flow: BOM standard, issue raw materials, then release finished goods into the production warehouse.'
        }
        actions={
          viewMode === 'release' ? undefined : (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Production Run
            </Button>
          )
        }
      />
      <ProductionNav />

      {feedback ? (
        <div
          className={`rounded-3xl border px-4 py-3 text-sm shadow-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Factory className="h-5 w-5" />} tone="amber" title="Open Runs" value={summary.total} />
        <SummaryCard icon={<Scale className="h-5 w-5" />} tone="sky" title="To Issue" value={summary.toIssue} />
        <SummaryCard icon={<Warehouse className="h-5 w-5" />} tone="orange" title="In Production" value={summary.inProduction} />
        <SummaryCard icon={<PackageCheck className="h-5 w-5" />} tone="emerald" title="Released" value={summary.released} />
      </section>

      {visibleRows.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRows.map((row) => {
            const status = String(row.status ?? '').toUpperCase();
            const recipe = row.recipe as Record<string, unknown> | undefined;
            const warehouse = row.warehouse as Record<string, unknown> | undefined;

            return (
              <article
                key={String(row.id)}
                className="surface-card relative overflow-hidden border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,246,232,0.92))] p-0"
              >
                <div className="border-b border-border/70 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-brown">{String(row.batchNumber ?? '')}</p>
                        <StatusBadge status={formatStatus(status)} variant={statusVariant(status)} />
                      </div>
                      <p className="text-sm text-muted">
                        {String(recipe?.name ?? 'Unknown BOM')} - {String(warehouse?.name ?? 'Production warehouse')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-right shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Quantity To Produce</p>
                      <p className="mt-2 text-2xl font-semibold text-brown">{formatNumber(row.plannedQuantity)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 px-5 py-5 md:grid-cols-3">
                  <StagePill complete icon={<CheckCircle2 className="h-4 w-4" />} label="BOM selected" />
                  <StagePill complete={isIssued(status)} icon={<Scale className="h-4 w-4" />} label="Materials issued" />
                  <StagePill complete={status === 'COMPLETED'} icon={<PackageCheck className="h-4 w-4" />} label="Goods released" />
                </div>

                <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
                  <MetricCard label="Expected Output" value={formatNumber(row.expectedOutput)} />
                  <MetricCard label="Actual Released" value={formatNumber(row.actualOutput)} />
                  <MetricCard label="Date" value={String(row.productionDate ?? '').slice(0, 10) || 'Not dated'} />
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 bg-white/55 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    {status === 'COMPLETED' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        Finished goods are now in the production warehouse.
                      </>
                    ) : canIssue(status) ? (
                      <>
                        <Scale className="h-4 w-4 text-sky-700" />
                        Ready to calculate and issue raw materials from production inventory.
                      </>
                    ) : (
                      <>
                        <Factory className="h-4 w-4 text-orange" />
                        Production is in progress. Enter actual output to release.
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className={actionButtonClassNames.view} onClick={() => setManageBatchId(String(row.id))}>
                      {viewMode === 'issue' ? 'Open Issue Screen' : viewMode === 'release' ? 'Open Release Screen' : 'Manage Flow'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {!['COMPLETED', 'CANCELLED'].includes(status) ? (
                      <Button type="button" size="sm" variant="outline" className={actionButtonClassNames.cancel} onClick={() => cancelBatch(String(row.id))}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Factory className="h-6 w-6" />}
          title={viewMode === 'release' ? 'No runs ready for release' : viewMode === 'issue' ? 'No production orders to issue' : 'No production runs'}
          description={
            viewMode === 'release'
              ? 'Finish issuing and processing production orders before release becomes available.'
              : viewMode === 'issue'
                ? 'Create a production run from an active BOM before issuing materials.'
                : 'Create a production run from an active BOM when production starts.'
          }
        />
      )}

      <FormDrawer title="New Production Run" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form className="space-y-6" onSubmit={handleCreateBatch}>
          {formError ? <ErrorBox message={formError} /> : null}

          <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">1. Select BOM and Quantity</p>
            <p className="mt-1 text-sm text-muted">The system calculates raw material quantities from the active BOM standard.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField label="BOM / Product" value={createState.recipeId} onChange={(value) => {
                const recipe = activeRecipes.find((row) => row.id === value);
                setCreateState((current) => ({
                  ...current,
                  expectedOutput: current.expectedOutput || String(recipe?.expectedOutputQuantity ?? current.plannedQuantity),
                  recipeId: value,
                }));
              }}>
                <option value="">Select BOM</option>
                {activeRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{String(recipe.code ?? '')} - {recipe.name}</option>)}
              </SelectField>
              <SelectField label="Production Raw Material Warehouse" value={createState.warehouseId} onChange={(value) => setCreateState((current) => ({ ...current, warehouseId: value }))}>
                <option value="">Select warehouse</option>
                {productionWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
              </SelectField>
              <InputField label="Quantity To Produce" type="number" value={createState.plannedQuantity} onChange={(value) => setCreateState((current) => ({ ...current, expectedOutput: value, plannedQuantity: value }))} />
              <InputField label="Expected Finished Output" type="number" value={createState.expectedOutput} onChange={(value) => setCreateState((current) => ({ ...current, expectedOutput: value }))} />
              <InputField label="Production Date" type="date" value={createState.productionDate} onChange={(value) => setCreateState((current) => ({ ...current, productionDate: value }))} />
              <SelectField label="Shift" value={createState.shift} onChange={(value) => setCreateState((current) => ({ ...current, shift: value }))}>
                <option value="DAY">Day</option>
                <option value="NIGHT">Night</option>
              </SelectField>
              <InputField label="Production Line" value={createState.productionLine} onChange={(value) => setCreateState((current) => ({ ...current, productionLine: value }))} />
              <SelectField label="Production Category" value={createState.productionCategory} onChange={(value) => setCreateState((current) => ({ ...current, productionCategory: value }))}>
                {(metaQuery.data?.productionCategories ?? []).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </SelectField>
            </div>
          </div>

          <RequirementPreview
            issued={false}
            requirements={createRequirements}
            title="2. Automatic Raw Material Calculation"
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Production Run</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title={`Production Flow${batchDetail?.batchNumber ? `: ${String(batchDetail.batchNumber)}` : ''}`} open={Boolean(manageBatchId)} onClose={() => setManageBatchId(null)}>
        {batchDetailQuery.isLoading ? <LoadingState /> : (
          <div className="space-y-6">
            {formError ? <ErrorBox message={formError} /> : null}
            <FlowStep
              complete
              description={`${String((batchDetail?.recipe as Record<string, unknown> | undefined)?.name ?? detailRecipe?.name ?? 'Selected BOM')} for ${formatNumber(batchDetail?.plannedQuantity)} units.`}
              index="1"
              title="BOM"
            />

            <FlowStep
              complete={isIssued(String(batchDetail?.status ?? '').toUpperCase())}
              description="Calculate BOM requirements and deduct raw materials from the production raw-material warehouse."
              index="2"
              title="Issue to Production"
            >
              <RequirementPreview
                issued={isIssued(String(batchDetail?.status ?? '').toUpperCase())}
                requirements={detailRequirements}
                title="Calculated raw materials"
              />
              {canIssue(String(batchDetail?.status ?? '').toUpperCase()) ? (
                <Button type="button" variant="outline" className={actionButtonClassNames.issue} onClick={issueToProduction}>
                  <Scale className="mr-2 h-4 w-4" />
                  Issue To Production
                </Button>
              ) : null}
            </FlowStep>

            <FlowStep
              complete={String(batchDetail?.status ?? '').toUpperCase() === 'COMPLETED'}
              description="Enter actual finished quantity and release it into the production finished-goods warehouse."
              index="3"
              title="Release to Production Warehouse"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Actual Quantity Produced" type="number" value={releaseQuantity} onChange={setReleaseQuantity} />
                <InputField label="Release Note" value={releaseNotes} onChange={setReleaseNotes} />
              </div>
              {canRelease(String(batchDetail?.status ?? '').toUpperCase()) ? (
                <Button type="button" variant="outline" className={actionButtonClassNames.release} onClick={releaseFinishedGoods}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Release Finished Goods
                </Button>
              ) : null}
            </FlowStep>
          </div>
        )}
      </FormDrawer>
    </div>
  );
}

function SummaryCard({ icon, title, tone, value }: { icon: ReactNode; title: string; tone: 'amber' | 'emerald' | 'orange' | 'sky'; value: number }) {
  const toneClass = {
    amber: 'to-amber-50',
    emerald: 'to-emerald-50',
    orange: 'to-orange-50',
    sky: 'to-sky-50',
  }[tone];

  return (
    <div className={`surface-card bg-gradient-to-br from-white via-white ${toneClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{value}</p>
        </div>
        <span className="app-icon-chip h-11 w-11">{icon}</span>
      </div>
    </div>
  );
}

function StagePill({ complete, icon, label }: { complete: boolean; icon: ReactNode; label: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border/70 bg-white/70 text-muted'}`}>
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-brown">{value}</p>
    </div>
  );
}

function RequirementPreview({ issued, requirements, title }: { issued: boolean; requirements: RequirementRow[]; title: string }) {
  return (
    <section className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{title}</p>
          <p className="mt-1 text-sm text-muted">Required quantities are calculated from the BOM standard and quantity to produce.</p>
        </div>
        <StatusBadge status={issued ? 'Issued' : 'Calculated'} variant={issued ? 'success' : 'info'} />
      </div>

      {requirements.length ? (
        <div className="mt-4 space-y-2">
          {requirements.map((row) => {
            const afterIssue = Math.max(0, row.availableQuantity - row.requiredQuantity);
            return (
              <div key={row.itemId} className="grid gap-3 rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.82))] p-3 md:grid-cols-[1fr_110px_110px_110px]">
                <div>
                  <p className="font-semibold text-brown">{row.itemCode ? `${row.itemCode} - ` : ''}{row.itemName}</p>
                  <p className="text-xs text-muted">{row.unit || 'unit'} from production raw material inventory</p>
                </div>
                <MetricText label="Required" value={formatNumber(row.requiredQuantity)} />
                <MetricText label={issued ? 'Balance Now' : 'Available'} value={formatNumber(row.availableQuantity)} />
                <MetricText label="After Issue" value={issued ? formatNumber(row.availableQuantity) : formatNumber(afterIssue)} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Select a BOM, quantity, and production warehouse to see automatic material requirements.</p>
      )}
    </section>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brown">{value}</p>
    </div>
  );
}

function FlowStep({ children, complete, description, index, title }: { children?: ReactNode; complete: boolean; description: string; index: string; title: string }) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
      <div className="flex gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-semibold ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-orange/10 text-orange'}`}>
          {complete ? <CheckCircle2 className="h-5 w-5" /> : index}
        </div>
        <div>
          <p className="font-semibold text-brown">{title}</p>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}

function InputField({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <input className="surface-input-soft" min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.001' : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <select className="surface-input-soft" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
