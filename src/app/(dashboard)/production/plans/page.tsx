'use client';

import { AlertCircle, Calculator, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionMeta, type ProductionMetaRecipe } from '@/hooks/production/useProductionMeta';
import { useProductionPlans } from '@/hooks/production/useProductionPlans';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { calculateScaledMaterialRequirement } from '@/lib/production';

const today = new Date().toISOString().slice(0, 10);

const initialFormState = {
  expectedOutput: '100',
  planDate: today,
  plannedQuantity: '100',
  productionCategory: 'ICE_CREAM_MAKING',
  productionLine: 'Main Line',
  recipeId: '',
  shift: 'DAY',
};

function requirementRows(recipe: ProductionMetaRecipe | undefined, plannedQuantity: number, stockByItemId: Record<string, number>, itemById: Map<string, Record<string, unknown>>) {
  if (!recipe || plannedQuantity <= 0) return [];
  const lines: Array<Record<string, unknown> & { productionSection: string }> = [
    ...recipe.ingredients.map((line) => ({ ...line, productionSection: 'Ice Cream Making' })),
    ...recipe.packagingItems.map((line) => ({ ...line, productionSection: 'Packaging' })),
  ];

  return lines.map((line) => {
    const itemId = String(line.item_id ?? '');
    const item = itemById.get(itemId);
    const scaled = calculateScaledMaterialRequirement({
      plannedQuantity,
      quantityRequired: Number(line.quantity_required ?? 0),
      standardOutputQuantity: recipe.expectedOutputQuantity || 1,
      standardUnitCost: Number(item?.unit_cost ?? 0),
      wastageAllowancePercent: Number(line.wastage_allowance_percent ?? 0),
    });
    const availableQuantity = Number(stockByItemId[itemId] ?? 0);
    return {
      availableQuantity,
      estimatedMaterialCost: scaled.estimatedMaterialCost,
      itemCode: String(item?.code ?? ''),
      itemName: String(item?.name ?? 'Unknown item'),
      productionSection: String(line.productionSection),
      requiredQuantity: scaled.requiredQuantity,
      scalingFactor: scaled.scalingFactor,
      shortageQuantity: Math.max(0, scaled.requiredQuantity - availableQuantity),
    };
  });
}

export default function ProductionPlansPage() {
  const plansQuery = useProductionPlans();
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const plans = Array.isArray(plansQuery.data) ? plansQuery.data as Array<Record<string, unknown>> : [];
  const selectedRecipe = metaQuery.data?.recipes.find((recipe) => recipe.id === formState.recipeId);
  const itemById = new Map((metaQuery.data?.items ?? []).map((item) => [item.id, item as Record<string, unknown>]));
  const requirements = requirementRows(
    selectedRecipe,
    Number(formState.plannedQuantity),
    metaQuery.data?.stockByItemId ?? {},
    itemById,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.planDate || !formState.recipeId || Number(formState.plannedQuantity) <= 0) {
      setFormError('Plan date, recipe, and planned quantity are required.');
      return;
    }

    try {
      await request('/api/production/plans', {
        body: JSON.stringify({
          items: [{
            expectedOutput: Number(formState.expectedOutput),
            plannedQuantity: Number(formState.plannedQuantity),
            recipeId: formState.recipeId,
          }],
          planDate: formState.planDate,
          productionCategory: formState.productionCategory,
          productionLine: formState.productionLine,
          shift: formState.shift,
        }),
        method: 'POST',
      });
      setFormState(initialFormState);
      setFormError(null);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production'] }),
        queryClient.invalidateQueries({ queryKey: ['production', 'plans'] }),
      ]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create production plan.');
    }
  }

  if (plansQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (plansQuery.isError || !plansQuery.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Plans unavailable" description={plansQuery.error?.message ?? 'No plan data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Planning"
        description="Plan production volumes from recipe formulas and compare required materials with combined store and production stock."
        actions={
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Production Plan
          </Button>
        }
      />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'plan_number', header: 'Plan #' },
          { key: 'plan_date', header: 'Date' },
          { key: 'shift', header: 'Shift' },
          { key: 'production_line', header: 'Line' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String((row as Record<string, unknown>).status ?? 'DRAFT')} />,
          },
        ]}
        data={plans}
        emptyState={<EmptyState icon={<Calculator className="h-6 w-6" />} title="No production plans" description="Create a plan to calculate raw-material and packaging needs." />}
      />

      <FormDrawer title="New Production Plan" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Plan Date</span>
              <input className="surface-input-soft" type="date" value={formState.planDate} onChange={(event) => setFormState((current) => ({ ...current, planDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Shift</span>
              <select className="surface-input-soft" value={formState.shift} onChange={(event) => setFormState((current) => ({ ...current, shift: event.target.value }))}>
                <option value="DAY">Day</option>
                <option value="NIGHT">Night</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Production Category</span>
              <select className="surface-input-soft" value={formState.productionCategory} onChange={(event) => setFormState((current) => ({ ...current, productionCategory: event.target.value }))}>
                {(metaQuery.data?.productionCategories ?? []).map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Production Line</span>
              <input className="surface-input-soft" value={formState.productionLine} onChange={(event) => setFormState((current) => ({ ...current, productionLine: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted sm:col-span-2">
              <span>Recipe Formula</span>
              <select
                className="surface-input-soft"
                value={formState.recipeId}
                onChange={(event) => {
                  const recipe = metaQuery.data?.recipes.find((row) => row.id === event.target.value);
                  setFormState((current) => ({
                    ...current,
                    expectedOutput: String(recipe?.expectedOutputQuantity ?? current.expectedOutput),
                    plannedQuantity: String(recipe?.expectedOutputQuantity ?? current.plannedQuantity),
                    recipeId: event.target.value,
                  }));
                }}
              >
                <option value="">Select recipe</option>
                {(metaQuery.data?.recipes ?? []).map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>{String(recipe.code ?? '')} - {recipe.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Planned Quantity</span>
              <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={formState.plannedQuantity} onChange={(event) => setFormState((current) => ({ ...current, plannedQuantity: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Expected Output</span>
              <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={formState.expectedOutput} onChange={(event) => setFormState((current) => ({ ...current, expectedOutput: event.target.value }))} />
            </label>
          </div>

          <div className="rounded-2xl border border-border bg-cream/60 p-4 dark:border-darkBorder dark:bg-darkBg/40">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-orange" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Required Units Preview</p>
            </div>
            {requirements.length === 0 ? (
              <p className="text-sm text-muted">Select a recipe to calculate required raw materials and packaging.</p>
            ) : (
              <div className="space-y-2">
                {requirements.map((row) => (
                  <div key={`${row.productionSection}-${row.itemCode}-${row.itemName}`} className="grid gap-2 rounded-xl bg-white px-3 py-2 text-sm dark:bg-darkCard md:grid-cols-[120px_1fr_120px_120px_120px]">
                    <span className="text-muted">{row.productionSection}</span>
                    <span className="font-medium text-brown dark:text-darkText">{row.itemCode} {row.itemName}</span>
                    <span>Need {row.requiredQuantity.toFixed(3)}</span>
                    <span>Stock {row.availableQuantity.toFixed(3)}</span>
                    <span className={row.shortageQuantity > 0 ? 'text-error' : 'text-success'}>
                      {row.shortageQuantity > 0 ? `Short ${row.shortageQuantity.toFixed(3)}` : 'Available'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Plan</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
