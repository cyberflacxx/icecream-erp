'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Plus } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useBatches } from '@/hooks/production/useBatches';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { useRecipes } from '@/hooks/production/useRecipes';
import { calculateScaledMaterialRequirement } from '@/lib/production';

type FormulaLine = {
  rowId: string;
  itemId: string;
  quantityRequired: string;
  unitId: string;
  wastageAllowancePercent: string;
};

function createFormulaLine(): FormulaLine {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    itemId: '',
    quantityRequired: '1',
    unitId: '',
    wastageAllowancePercent: '0',
  };
}

function createInitialFormState() {
  return {
    expectedOutputQuantity: '1',
    finishedItemId: '',
    ingredients: [createFormulaLine()],
    instructions: '',
    name: '',
    outputUnitId: '',
    packagingItems: [] as FormulaLine[],
    packagingRequirement: '',
    productionCategory: 'ICE_CREAM_MAKING',
  };
}

function toPayloadLine(line: FormulaLine) {
  return {
    itemId: line.itemId,
    quantityRequired: Number(line.quantityRequired),
    unitId: line.unitId,
    wastageAllowancePercent: Number(line.wastageAllowancePercent || 0),
  };
}

export default function ProductionRecipesPage() {
  const query = useRecipes();
  const batchesQuery = useBatches({ limit: 20 });
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [calculatorRecipeId, setCalculatorRecipeId] = useState('');
  const [productionQuantity, setProductionQuantity] = useState('1000');

  const recipes = Array.isArray(query.data) ? query.data as Array<Record<string, unknown>> : [];
  const units = useMemo(() => metaQuery.data?.unitsOfMeasure ?? [], [metaQuery.data?.unitsOfMeasure]);
  const itemById = useMemo(
    () => new Map((metaQuery.data?.items ?? []).map((item) => [String(item.id), item])),
    [metaQuery.data?.items],
  );
  const unitById = useMemo(
    () => new Map(units.map((unit) => [String(unit.id), unit])),
    [units],
  );
  const activeRecipe =
    recipes.find((recipe) => String(recipe.status ?? '').toUpperCase() === 'ACTIVE') ??
    recipes[0] ??
    null;
  const calculatorRecipe =
    recipes.find((recipe) => String(recipe.id) === calculatorRecipeId) ??
    activeRecipe ??
    null;
  const batches =
    batchesQuery.data && typeof batchesQuery.data === 'object' && Array.isArray((batchesQuery.data as { data?: unknown }).data)
      ? (batchesQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const issueBatch =
    batches.find((batch) => !['COMPLETED', 'CANCELLED'].includes(String(batch.status ?? '').toUpperCase())) ??
    null;
  const releaseBatch =
    batches.find((batch) => ['IN_PROGRESS', 'WIP', 'QUALITY_CHECK'].includes(String(batch.status ?? '').toUpperCase())) ??
    issueBatch;
  const productionWarehouse =
    metaQuery.data?.productionMaterialWarehouses?.[0] ??
    metaQuery.data?.productionFinishedWarehouses?.[0] ??
    metaQuery.data?.warehouses?.find((warehouse) => warehouse.isProductionWarehouse) ??
    null;

  useEffect(() => {
    if (!calculatorRecipeId && activeRecipe) {
      setCalculatorRecipeId(String(activeRecipe.id));
      setProductionQuantity(String(Number((activeRecipe as Record<string, unknown>).expected_output_quantity ?? activeRecipe.expectedOutputQuantity ?? 1000) || 1000));
    }
  }, [activeRecipe, calculatorRecipeId]);

  const calculatorRows = useMemo(() => {
    if (!calculatorRecipe || Number(productionQuantity) <= 0) return [];
    const standardOutput = Number((calculatorRecipe as Record<string, unknown>).expected_output_quantity ?? calculatorRecipe.expectedOutputQuantity ?? 1) || 1;

    return [...asRecipeRows(calculatorRecipe.ingredients), ...asRecipeRows(calculatorRecipe.packagingItems)]
      .map((line) => {
        const itemId = String(line.item_id ?? line.itemId ?? '');
        const item = itemById.get(itemId);
        const unit = unitById.get(String(line.unit_id ?? line.unitId ?? ''));
        const quantityPerUnit = Number(line.quantity_required ?? line.quantityRequired ?? 0);
        const scaled = calculateScaledMaterialRequirement({
          plannedQuantity: Number(productionQuantity),
          quantityRequired: quantityPerUnit,
          standardOutputQuantity: standardOutput,
          standardUnitCost: Number((item as Record<string, unknown> | undefined)?.unit_cost ?? (item as Record<string, unknown> | undefined)?.unitCost ?? 0),
          wastageAllowancePercent: Number(line.wastage_allowance_percent ?? line.wastageAllowancePercent ?? 0),
        });

        return {
          itemCode: String((item as Record<string, unknown> | undefined)?.code ?? ''),
          itemName: String((item as Record<string, unknown> | undefined)?.name ?? 'Unknown material'),
          quantityPerUnit,
          totalQuantity: scaled.requiredQuantity,
          unit: String((unit as Record<string, unknown> | undefined)?.abbreviation ?? (unit as Record<string, unknown> | undefined)?.name ?? ''),
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [calculatorRecipe, itemById, productionQuantity, unitById]);

  function updateLine(section: 'ingredients' | 'packagingItems', index: number, next: Partial<FormulaLine>) {
    setFormState((current) => ({
      ...current,
      [section]: current[section].map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...next } : line,
      ),
    }));
  }

  function addLine(section: 'ingredients' | 'packagingItems') {
    setFormState((current) => ({
      ...current,
      [section]: [...current[section], createFormulaLine()],
    }));
  }

  function removeLine(section: 'ingredients' | 'packagingItems', index: number) {
    setFormState((current) => ({
      ...current,
      [section]: current[section].filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ingredients = formState.ingredients.filter((line) => line.itemId && line.unitId).map(toPayloadLine);
    const packagingItems = formState.packagingItems.filter((line) => line.itemId && line.unitId).map(toPayloadLine);

    if (!formState.name || !formState.finishedItemId || !formState.outputUnitId || ingredients.length === 0) {
      setFormError('Recipe name, finished item, output unit, and at least one raw material are required.');
      return;
    }

    if ([...ingredients, ...packagingItems].some((line) => line.quantityRequired <= 0 || Number.isNaN(line.quantityRequired))) {
      setFormError('Every formula quantity must be greater than zero.');
      return;
    }

    try {
      await request('/api/production/recipes', {
        body: JSON.stringify({
          expectedOutputQuantity: Number(formState.expectedOutputQuantity),
          finishedItemId: formState.finishedItemId,
          ingredients,
          instructions: formState.instructions || null,
          name: formState.name,
          outputUnitId: formState.outputUnitId,
          packagingItems,
          packagingRequirement: formState.packagingRequirement || null,
          productionCategory: formState.productionCategory,
        }),
        method: 'POST',
      });
      setFormState(createInitialFormState());
      setFormError(null);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['production'] }),
      ]);
      setFeedback({ message: 'BOM saved as the active production standard.', tone: 'success' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create recipe.');
    }
  }

  async function activateRecipe(id: string) {
    try {
      await request(`/api/production/recipes/${id}/activate`, { method: 'POST' });
      setFeedback({ message: 'BOM activated as the production standard.', tone: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['production'] }),
      ]);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Failed to activate BOM.', tone: 'error' });
    }
  }

  if (query.isLoading || metaQuery.isLoading || batchesQuery.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Recipes unavailable" description={query.error?.message ?? 'No recipe data returned.'} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM Standards"
        description="Create the standard Bill of Materials for one finished product. Production uses this BOM to calculate every issue quantity automatically."
        actions={
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New BOM
          </Button>
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

      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface-card bg-gradient-to-br from-white via-white to-amber-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">BOM Records</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{recipes.length}</p>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-emerald-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Active Standards</p>
          <p className="mt-3 text-3xl font-semibold text-brown">
            {recipes.filter((recipe) => String(recipe.status ?? '').toUpperCase() === 'ACTIVE').length}
          </p>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-sky-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">SAP Flow</p>
          <p className="mt-3 text-sm font-semibold text-brown">BOM {'->'} Issue {'->'} Receipt</p>
        </div>
      </section>

      {calculatorRecipe ? (
        <section className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--app-text)]">
                BOM - {String((calculatorRecipe as Record<string, unknown>).name ?? 'Production standard')}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--app-muted)]">
                Define the raw materials and standard quantity needed to produce one finished unit, then scale it instantly for the production quantity required.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="surface-input-soft min-w-[260px]"
                value={calculatorRecipeId}
                onChange={(event) => setCalculatorRecipeId(event.target.value)}
              >
                {recipes.map((recipe) => (
                  <option key={String(recipe.id)} value={String(recipe.id)}>
                    {String(recipe.code ?? '')} - {String(recipe.name ?? '')}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Manage BOM
              </Button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-[color:var(--app-border)]">
            <table className="min-w-full divide-y divide-[color:var(--app-border-muted)]">
              <thead className="bg-[color:var(--app-bg-subtle)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Raw Material</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Unit</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Standard Qty Per Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border-muted)]">
                {calculatorRows.map((row, index) => (
                  <tr key={`${row.itemCode}-${row.itemName}`}>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">
                      {row.itemCode ? `${row.itemCode} - ` : ''}
                      {row.itemName}
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">{row.unit || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[color:var(--app-text)]">
                      {row.quantityPerUnit.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-3">
            <div className="grid gap-3 lg:grid-cols-[220px_90px_1fr_120px] lg:items-center">
              <label className="space-y-1 text-sm text-[color:var(--app-muted)]">
                <span>I want to produce</span>
                <input
                  className="surface-input"
                  min="1"
                  step="1"
                  type="number"
                  value={productionQuantity}
                  onChange={(event) => setProductionQuantity(event.target.value)}
                />
              </label>
              <div className="text-sm font-medium text-[color:var(--app-text)]">units</div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent-strong)]">
                Total Raw Materials Required
              </div>
              <Button type="button" size="sm">
                Calculate
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--app-border)]">
            <table className="min-w-full divide-y divide-[color:var(--app-border-muted)]">
              <thead className="bg-[color:var(--app-bg-subtle)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Raw Material</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Unit</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">Qty Per 1 Unit</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">
                    Total Qty For {Number(productionQuantity || 0).toLocaleString()} Units
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--app-border-muted)]">
                {calculatorRows.map((row) => (
                  <tr key={`calc-${row.itemCode}-${row.itemName}`}>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">{row.itemName}</td>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">{row.unit || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[color:var(--app-text)]">{row.quantityPerUnit.toFixed(3)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[color:var(--app-text)]">
                      {row.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_280px]">
            <FlowCard
              index="2"
              title="Issues"
              description="Open released Production Orders and post raw-material issues from the modern order workflow."
              fields={[
                { label: 'Production Order', value: String(issueBatch?.batchNumber ?? 'Create a production run first') },
                { label: 'Quantity To Produce', value: issueBatch ? String(issueBatch.plannedQuantity ?? '') : String(Number(productionQuantity || 0)) },
                { label: 'Issue Date', value: issueBatch ? String(issueBatch.productionDate ?? '').slice(0, 10) : new Date().toISOString().slice(0, 10) },
              ]}
              actionHref="/production/orders?workflow=issue&status=RELEASED"
              actionLabel={issueBatch ? 'Open Issue Orders' : 'Open Issue Orders'}
              rows={calculatorRows.map((row) => ({
                label: row.itemName,
                unit: row.unit || '-',
                value: `${row.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${row.unit}`,
              }))}
            />

            <FlowCard
              index="3"
              title="Receipts"
              description="Open released Production Orders and post finished-goods receipts from the modern order workflow."
              fields={[
                { label: 'Production Order', value: String(releaseBatch?.batchNumber ?? 'Release after issue') },
                { label: 'Quantity Produced', value: releaseBatch ? String(releaseBatch.actualOutput ?? releaseBatch.expectedOutput ?? '') : String(Number(productionQuantity || 0)) },
                { label: 'Receipt Date', value: releaseBatch ? String(releaseBatch.productionDate ?? '').slice(0, 10) : new Date().toISOString().slice(0, 10) },
              ]}
              actionHref="/production/orders?workflow=receipt&status=RELEASED"
              actionLabel={releaseBatch ? 'Open Receipt Orders' : 'Open Receipt Orders'}
              rows={[
                {
                  label: String((calculatorRecipe as Record<string, unknown>).name ?? 'Finished Product'),
                  unit: String(
                    unitById.get(
                      String((calculatorRecipe as Record<string, unknown>).output_unit_id ?? calculatorRecipe.outputUnitId ?? ''),
                    )?.abbreviation ?? '',
                  ) || 'unit',
                  value: Number(productionQuantity || 0).toLocaleString(),
                },
              ]}
            />

            <div className="space-y-4">
              <InfoCard
                title="Production Warehouse"
                lines={[
                  productionWarehouse
                    ? `${String(productionWarehouse.name)} is the separate production-controlled inventory.`
                    : 'Production inventory is handled in a separate warehouse from the main store.',
                  'Raw materials are issued from production stock.',
                  'Finished goods are released back into production inventory first.',
                ]}
              />
              <InfoCard
                title="Key Points"
                lines={[
                  'BOM defines standard raw materials for one finished unit.',
                  'Enter quantity to produce and the system calculates total materials.',
                  'Issues deduct raw materials from the production warehouse.',
                  'Release posts finished output back into production stock.',
                ]}
              />
            </div>
          </div>
        </section>
      ) : null}

      <DataTable
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'BOM / Product Standard' },
          { key: 'version', header: 'Version' },
          {
            key: 'production_category',
            header: 'Category',
            render: (row) => String((row as Record<string, unknown>).production_category ?? 'ICE_CREAM_MAKING').replaceAll('_', ' '),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String((row as Record<string, unknown>).status ?? 'DRAFT')} />,
          },
          {
            key: 'expected_output_quantity',
            header: 'Standard Output',
            render: (row) => String((row as Record<string, unknown>).expected_output_quantity ?? (row as Record<string, unknown>).batch_size ?? ''),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const record = row as Record<string, unknown>;
              const isActive = String(record.status ?? '').toUpperCase() === 'ACTIVE';
              return isActive ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Standard
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                  onClick={() => activateRecipe(String(record.id))}
                >
                  Activate
                </Button>
              );
            },
          },
        ]}
        data={recipes}
        emptyState={<EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="No BOM standards" description="Create the first BOM before issuing materials to production." />}
      />

      <FormDrawer title="New BOM Standard" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">BOM Header</p>
            <p className="mt-1 text-sm text-muted">Enter the standard recipe once. Use output quantity `1` when the BOM is per single finished unit.</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>BOM Name</span>
              <input
                required
                className="surface-input-soft"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Production Category</span>
              <select
                className="surface-input-soft"
                value={formState.productionCategory}
                onChange={(event) => setFormState((current) => ({ ...current, productionCategory: event.target.value }))}
              >
                {(metaQuery.data?.productionCategories ?? []).map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Finished Product</span>
              <select
                required
                className="surface-input-soft"
                value={formState.finishedItemId}
                onChange={(event) => setFormState((current) => ({ ...current, finishedItemId: event.target.value }))}
              >
                <option value="">Select product</option>
                {(metaQuery.data?.finishedGoods ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{String(item.code ?? '')} - {item.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Output Unit</span>
              <select
                required
                className="surface-input-soft"
                value={formState.outputUnitId}
                onChange={(event) => setFormState((current) => ({ ...current, outputUnitId: event.target.value }))}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={String(unit.id)} value={String(unit.id)}>{String(unit.abbreviation ?? unit.name)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Standard Output Quantity</span>
              <input
                required
                min="0.001"
                step="0.001"
                type="number"
                className="surface-input-soft"
                value={formState.expectedOutputQuantity}
                onChange={(event) => setFormState((current) => ({ ...current, expectedOutputQuantity: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Packaging Requirement Note</span>
              <input
                className="surface-input-soft"
                value={formState.packagingRequirement}
                onChange={(event) => setFormState((current) => ({ ...current, packagingRequirement: event.target.value }))}
              />
            </label>
            </div>
          </div>

          <FormulaLines
            title="Raw Materials Formula"
            lines={formState.ingredients}
            items={metaQuery.data?.rawMaterials ?? []}
            units={units}
            onAdd={() => addLine('ingredients')}
            onRemove={(index) => removeLine('ingredients', index)}
            onUpdate={(index, next) => updateLine('ingredients', index, next)}
          />

          <FormulaLines
            title="Packaging Formula"
            lines={formState.packagingItems}
            items={metaQuery.data?.packagingItems ?? []}
            units={units}
            onAdd={() => addLine('packagingItems')}
            onRemove={(index) => removeLine('packagingItems', index)}
            onUpdate={(index, next) => updateLine('packagingItems', index, next)}
          />

          <label className="space-y-2 text-sm text-muted">
            <span>Production Instructions</span>
            <textarea
              rows={3}
              className="surface-textarea-soft"
              value={formState.instructions}
              onChange={(event) => setFormState((current) => ({ ...current, instructions: event.target.value }))}
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Formula</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}

function asRecipeRows(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function FlowCard({
  actionHref,
  actionLabel,
  description,
  fields,
  index,
  rows,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  fields: Array<{ label: string; value: string }>;
  index: string;
  rows: Array<{ label: string; unit: string; value: string }>;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--app-accent-strong)] px-2 text-xs font-semibold text-white">
          {index}
        </span>
        <h3 className="text-base font-semibold text-[color:var(--app-text)]">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-[color:var(--app-muted)]">{description}</p>

      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]">{field.label}</p>
            <div className="mt-1 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm text-[color:var(--app-text)]">
              {field.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--app-border)]">
        <table className="min-w-full divide-y divide-[color:var(--app-border-muted)]">
          <thead className="bg-[color:var(--app-bg-subtle)]">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-subtle)]">Material</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-subtle)]">Unit</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-subtle)]">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border-muted)]">
            {rows.map((row) => (
              <tr key={`${title}-${row.label}`}>
                <td className="px-3 py-2 text-sm text-[color:var(--app-text)]">{row.label}</td>
                <td className="px-3 py-2 text-sm text-[color:var(--app-text)]">{row.unit}</td>
                <td className="px-3 py-2 text-sm font-medium text-[color:var(--app-text)]">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button asChild type="button" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

function InfoCard({ lines, title }: { lines: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent-strong)]">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-[color:var(--app-text)]">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function FormulaLines({
  items,
  lines,
  onAdd,
  onRemove,
  onUpdate,
  title,
  units,
}: {
  items: Array<Record<string, unknown>>;
  lines: FormulaLine[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, next: Partial<FormulaLine>) => void;
  title: string;
  units: Array<Record<string, unknown>>;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4 dark:border-darkBorder dark:bg-darkBg/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{title}</p>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>Add Line</Button>
      </div>
      {lines.length === 0 ? <p className="text-sm text-muted">No lines added.</p> : null}
      {lines.map((line, index) => (
        <div key={line.rowId} className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px_auto]">
          <select className="surface-input-soft" value={line.itemId} onChange={(event) => onUpdate(index, { itemId: event.target.value })}>
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>{String(item.code ?? '')} - {String(item.name ?? '')}</option>
            ))}
          </select>
          <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={line.quantityRequired} onChange={(event) => onUpdate(index, { quantityRequired: event.target.value })} />
          <select className="surface-input-soft" value={line.unitId} onChange={(event) => onUpdate(index, { unitId: event.target.value })}>
            <option value="">Unit</option>
            {units.map((unit) => (
              <option key={String(unit.id)} value={String(unit.id)}>{String(unit.abbreviation ?? unit.name)}</option>
            ))}
          </select>
          <input className="surface-input-soft" min="0" step="0.001" type="number" value={line.wastageAllowancePercent} onChange={(event) => onUpdate(index, { wastageAllowancePercent: event.target.value })} />
          <Button type="button" variant="outline" onClick={() => onRemove(index)}>Remove</Button>
        </div>
      ))}
    </div>
  );
}
