'use client';

import { AlertCircle, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { useRecipes } from '@/hooks/production/useRecipes';

type FormulaLine = {
  itemId: string;
  quantityRequired: string;
  unitId: string;
  wastageAllowancePercent: string;
};

const emptyLine: FormulaLine = {
  itemId: '',
  quantityRequired: '1',
  unitId: '',
  wastageAllowancePercent: '0',
};

const initialFormState = {
  expectedOutputQuantity: '100',
  finishedItemId: '',
  ingredients: [emptyLine],
  instructions: '',
  name: '',
  outputUnitId: '',
  packagingItems: [] as FormulaLine[],
  packagingRequirement: '',
  productionCategory: 'ICE_CREAM_MAKING',
};

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
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const recipes = Array.isArray(query.data) ? query.data as Array<Record<string, unknown>> : [];
  const units = metaQuery.data?.unitsOfMeasure ?? [];

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
      [section]: [...current[section], { ...emptyLine }],
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
      setFormState(initialFormState);
      setFormError(null);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipes'] }),
        queryClient.invalidateQueries({ queryKey: ['production'] }),
      ]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create recipe.');
    }
  }

  if (query.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Recipes unavailable" description={query.error?.message ?? 'No recipe data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recipe Management"
        description="Create standard raw-material and packaging formulas for target production volumes."
        actions={
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Recipe Formula
          </Button>
        }
      />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Recipe' },
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
            header: 'Formula Volume',
            render: (row) => String((row as Record<string, unknown>).expected_output_quantity ?? (row as Record<string, unknown>).batch_size ?? ''),
          },
        ]}
        data={recipes}
        emptyState={<EmptyState icon={<Plus className="h-6 w-6" />} title="No recipes" description="Create the first standard formula before planning production." />}
      />

      <FormDrawer title="New Recipe Formula" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Recipe Name</span>
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
              <span>Formula Output Volume</span>
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
        <div key={index} className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px_auto]">
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
