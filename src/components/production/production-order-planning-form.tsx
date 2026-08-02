'use client';

import { AlertTriangle, Calculator, Save } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { ItemSelectorField } from '@/components/shared/item-selector-field';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui-library';
import { useAuthorizedBranches } from '@/hooks/useAuthorizedBranches';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import { usePermission } from '@/hooks/usePermission';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionOrderProducts } from '@/hooks/production/useProductionOrders';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { calculateRequiredMaterials, type MaterialRequirementInput } from '@/lib/production';
import { API_ROUTES } from '@/lib/shared';

const today = new Date().toISOString().slice(0, 10);

type PlanningFormMode = 'create' | 'edit';

type PlanningFormValues = {
  branchId: string;
  finishedGoodsWarehouseId: string;
  plannedDueDate: string;
  plannedQuantity: string;
  plannedStartDate: string;
  priority: string;
  productId: string;
  productionWarehouseId: string;
  remarks: string;
};

type ProductOption = Record<string, unknown> & {
  activeBom?: Record<string, unknown> | null;
  code?: string | null;
  description?: string | null;
  id: string;
  name?: string | null;
  standard_cost?: number | null;
  unit_cost?: number | null;
};

type RequirementPreviewRow = ReturnType<typeof calculateRequiredMaterials>[number] & {
  perUnitRequirement: number;
};

const defaultValues: PlanningFormValues = {
  branchId: '',
  finishedGoodsWarehouseId: '',
  plannedDueDate: '',
  plannedQuantity: '1',
  plannedStartDate: today,
  priority: 'NORMAL',
  productId: '',
  productionWarehouseId: '',
  remarks: '',
};

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function buildInitialValues(order: Record<string, unknown> | null | undefined, branchId: string | null | undefined): PlanningFormValues {
  if (!order) {
    return {
      ...defaultValues,
      branchId: branchId ?? '',
    };
  }

  return {
    branchId: String(order.branch_id ?? branchId ?? ''),
    finishedGoodsWarehouseId: String(order.finished_goods_warehouse_id ?? ''),
    plannedDueDate: String(order.planned_due_date ?? ''),
    plannedQuantity: String(order.planned_quantity ?? '1'),
    plannedStartDate: String(order.planned_start_date ?? today),
    priority: String(order.priority ?? 'NORMAL'),
    productId: String(order.product_id ?? ''),
    productionWarehouseId: String(order.production_warehouse_id ?? ''),
    remarks: String(order.remarks ?? ''),
  };
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function ProductionOrderPlanningForm({
  existingOrder,
  hasPostedDocuments = false,
  mode,
  orderId,
}: {
  existingOrder?: Record<string, unknown> | null;
  hasPostedDocuments?: boolean;
  mode: PlanningFormMode;
  orderId?: string;
}) {
  const currentUserQuery = useCurrentUser();
  const metaQuery = useProductionMeta();
  const productsQuery = useProductionOrderProducts();
  const branchesQuery = useAuthorizedBranches();
  const request = useProductionRequest();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canChooseBranch = usePermission('view_all_branches');
  const [form, setForm] = useState<PlanningFormValues>(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const branchId = currentUserQuery.data?.branch?.id ?? null;
  const isBranchScoped = currentUserQuery.data?.isBranchScoped ?? false;
  const productOptionsQuery = useItemSelectorOptions({
    branchId: isBranchScoped ? branchId : form.branchId || undefined,
    includeCost: true,
    itemType: ['FINISHED_GOOD', 'FINISHED'],
    limit: 250,
  });

  useEffect(() => {
    setForm(buildInitialValues(existingOrder, branchId));
  }, [branchId, existingOrder]);

  useEffect(() => {
    if (mode !== 'create') return;
    const onlyBranchId = branchesQuery.data?.length === 1 ? branchesQuery.data[0]?.id ?? '' : '';
    if (!onlyBranchId) return;
    setForm((current) => (current.branchId ? current : { ...current, branchId: onlyBranchId }));
  }, [branchesQuery.data, mode]);

  const branches = useMemo(() => branchesQuery.data ?? [], [branchesQuery.data]);
  const warehouses = useMemo(() => metaQuery.data?.warehouses ?? [], [metaQuery.data?.warehouses]);
  const productionWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isProductionMaterialWarehouse || warehouse.isProductionWarehouse),
    [warehouses],
  );
  const finishedWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isProductionFinishedWarehouse || warehouse.isMainWarehouse || warehouse.isProductionWarehouse),
    [warehouses],
  );

  const products = useMemo(() => {
    const byId = new Map<string, ProductOption>();
    for (const product of productOptionsQuery.data ?? []) {
      const id = String(product.id ?? '');
      byId.set(id, {
        code: product.code,
        description: product.name,
        id,
        name: product.name,
        standard_cost: product.currentInventoryCost,
        unit_cost: product.currentInventoryCost,
      });
    }
    for (const product of productsQuery.data ?? []) {
      const id = String(product.id ?? '');
      byId.set(id, { ...(byId.get(id) ?? {}), ...(product as ProductOption), id });
    }
    return Array.from(byId.values())
      .filter((product) => product.id)
      .sort((left, right) => String(left.code ?? '').localeCompare(String(right.code ?? '')));
  }, [productOptionsQuery.data, productsQuery.data]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? null,
    [form.productId, products],
  );
  const selectedBom = asRecord(selectedProduct?.activeBom) ?? null;
  const selectedRecipe = useMemo(() => {
    if (!selectedBom?.id) return null;
    return (metaQuery.data?.recipes ?? []).find((recipe) => recipe.id === String(selectedBom.id)) ?? null;
  }, [metaQuery.data?.recipes, selectedBom]);

  const requirementRows = useMemo(() => {
    const plannedQuantity = Number(form.plannedQuantity);
    const expectedOutput = Number(selectedRecipe?.expectedOutputQuantity ?? 0);
    if (!selectedRecipe || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0 || expectedOutput <= 0) return [];

    const stockByItemId = new Map<string, number>();
    const stockByItemWarehouse = metaQuery.data?.stockByItemWarehouse ?? {};
    const recipeItems = [...selectedRecipe.ingredients, ...selectedRecipe.packagingItems] as MaterialRequirementInput[];

    for (const line of recipeItems) {
      const itemId = String(line.item_id ?? '');
      if (!itemId) continue;
      stockByItemId.set(itemId, Number(stockByItemWarehouse[`${itemId}:${form.productionWarehouseId}`] ?? 0));
    }

    return calculateRequiredMaterials(recipeItems, plannedQuantity, expectedOutput, stockByItemId)
      .map((row, index) => ({
        ...row,
        perUnitRequirement: expectedOutput > 0 ? Number(recipeItems[index]?.quantity_required ?? 0) / expectedOutput : 0,
      }));
  }, [form.plannedQuantity, form.productionWarehouseId, metaQuery.data?.stockByItemWarehouse, selectedRecipe]);

  const estimatedTotalCost = requirementRows.reduce((sum, row) => sum + Number(row.estimatedMaterialCost ?? 0), 0);
  const totalRequiredQuantity = requirementRows.reduce((sum, row) => sum + Number(row.requiredQuantity ?? 0), 0);
  const totalShortageQuantity = requirementRows.reduce((sum, row) => sum + Number(row.shortageQuantity ?? 0), 0);
  const blockingStatus = String(existingOrder?.status ?? '').toUpperCase();
  const structureChanged = mode === 'edit'
    && Boolean(existingOrder)
    && (
      String(existingOrder?.product_id ?? '') !== form.productId
      || Number(existingOrder?.planned_quantity ?? 0) !== Number(form.plannedQuantity || 0)
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    const plannedQuantity = Number(form.plannedQuantity);
    if (!form.productId) {
      setError('Product Number is required.');
      return;
    }
    if (!selectedRecipe) {
      setError('The selected product does not have an active BOM.');
      return;
    }
    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
      setError('Planned Quantity must be greater than zero.');
      return;
    }
    if (!form.productionWarehouseId) {
      setError('Production Warehouse is required.');
      return;
    }
    if (!form.finishedGoodsWarehouseId) {
      setError('Finished-Goods Warehouse is required.');
      return;
    }
    if (mode === 'edit' && blockingStatus !== 'PLANNED') {
      setError('Only PLANNED production orders can be edited.');
      return;
    }
    if (mode === 'edit' && hasPostedDocuments) {
      setError('This order cannot be edited because production issue or receipt documents already exist.');
      return;
    }
    if (mode === 'edit' && structureChanged) {
      const confirmed = window.confirm('Saving will rebuild component requirements from the latest active BOM. Continue?');
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchId: isBranchScoped ? branchId : form.branchId || null,
        finishedGoodsWarehouseId: form.finishedGoodsWarehouseId,
        plannedDueDate: form.plannedDueDate || null,
        plannedQuantity,
        plannedStartDate: form.plannedStartDate || null,
        priority: form.priority,
        productId: form.productId,
        productionWarehouseId: form.productionWarehouseId,
        remarks: form.remarks || null,
      };

      const result = mode === 'edit' && orderId
        ? await request<Record<string, unknown>>(API_ROUTES.PRODUCTION.ORDER(orderId), {
          body: JSON.stringify(payload),
          method: 'PUT',
        })
        : await request<{ productionOrderId?: string }>(API_ROUTES.PRODUCTION.ORDERS, {
          body: JSON.stringify(payload),
          method: 'POST',
        });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production'] }),
        orderId ? queryClient.invalidateQueries({ queryKey: ['production', 'order', orderId] }) : Promise.resolve(),
      ]);

      const nextOrderId = mode === 'edit' ? orderId : String((result as { productionOrderId?: string }).productionOrderId ?? '');
      router.push(nextOrderId ? `/production/orders/${nextOrderId}` : '/production/orders');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save production order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (metaQuery.isLoading || productsQuery.isLoading || currentUserQuery.isLoading) {
    return <LoadingState />;
  }

  if (metaQuery.isError || productsQuery.isError || currentUserQuery.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Planning data unavailable"
        description={metaQuery.error?.message ?? productsQuery.error?.message ?? currentUserQuery.error?.message ?? 'The planning form could not be loaded.'}
      />
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error ? <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div> : null}

      {mode === 'edit' && structureChanged ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Saving will replace calculated component requirements using the latest active BOM and the revised planned quantity.
        </div>
      ) : null}

      {hasPostedDocuments ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Editing is blocked because issue or receipt documents already exist for this order.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Product Number</span>
              <ItemSelectorField
                value={form.productId}
                options={productOptionsQuery.data ?? []}
                loading={productOptionsQuery.isLoading}
                onRetry={() => productOptionsQuery.refetch()}
                errorMessage={productOptionsQuery.error?.message ?? null}
                emptyMessage="No production products are available."
                onChange={(nextProductId) => setForm((current) => ({ ...current, productId: nextProductId }))}
              />
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Product Name</span>
              <input
                className="surface-input-soft"
                readOnly
                value={String(selectedProduct?.name ?? selectedProduct?.description ?? '')}
              />
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Planned Quantity</span>
              <input
                className="surface-input-soft"
                min="0.001"
                step="0.001"
                type="number"
                value={form.plannedQuantity}
                onChange={(event) => setForm((current) => ({ ...current, plannedQuantity: event.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Priority</span>
              <select
                className="surface-input-soft"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Planned Start Date</span>
              <input
                className="surface-input-soft"
                type="date"
                value={form.plannedStartDate}
                onChange={(event) => setForm((current) => ({ ...current, plannedStartDate: event.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Planned Completion Date</span>
              <input
                className="surface-input-soft"
                type="date"
                value={form.plannedDueDate}
                onChange={(event) => setForm((current) => ({ ...current, plannedDueDate: event.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Branch</span>
              <select
                className="surface-input-soft"
                disabled={isBranchScoped || !canChooseBranch}
                value={isBranchScoped ? (branchId ?? '') : form.branchId}
                onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={String(branch.id)} value={String(branch.id)}>
                    {String(branch.code ?? '')} {String(branch.name)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-muted">
              <span>Production Warehouse</span>
              <select
                className="surface-input-soft"
                value={form.productionWarehouseId}
                onChange={(event) => setForm((current) => ({ ...current, productionWarehouseId: event.target.value }))}
              >
                <option value="">Select warehouse</option>
                {productionWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-muted md:col-span-2">
              <span>Finished-Goods Warehouse</span>
              <select
                className="surface-input-soft"
                value={form.finishedGoodsWarehouseId}
                onChange={(event) => setForm((current) => ({ ...current, finishedGoodsWarehouseId: event.target.value }))}
              >
                <option value="">Select warehouse</option>
                {finishedWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-muted md:col-span-2">
              <span>Notes</span>
              <textarea
                className="surface-input-soft min-h-24"
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calculator className="h-4 w-4" />
            Active BOM Summary
          </div>
          <div className="grid gap-3 text-sm">
            <SummaryRow label="BOM Code" value={String(selectedBom?.code ?? '')} />
            <SummaryRow label="BOM Version" value={String(selectedBom?.version ?? '')} />
            <SummaryRow label="Expected Output" value={selectedRecipe ? formatNumber(Number(selectedRecipe.expectedOutputQuantity ?? 0)) : ''} />
            <SummaryRow label="Estimated Total Cost" value={formatMoney(estimatedTotalCost)} />
            <SummaryRow label="Total Material Requirement" value={formatNumber(totalRequiredQuantity)} />
            <SummaryRow label="Total Shortage" value={formatNumber(totalShortageQuantity)} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[color:var(--app-border)] pb-4">
          <h2 className="text-sm font-semibold">Calculated Material Requirements</h2>
          <p className="text-sm text-[color:var(--app-muted)]">Requirements recalculate immediately from the latest active BOM and the planned quantity.</p>
        </div>

        {selectedRecipe && requirementRows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--app-border)] text-left text-[color:var(--app-muted)]">
                  <th className="pb-3 pr-4 font-medium">Item</th>
                  <th className="pb-3 pr-4 font-medium">Unit</th>
                  <th className="pb-3 pr-4 font-medium">Per Unit</th>
                  <th className="pb-3 pr-4 font-medium">Total Requirement</th>
                  <th className="pb-3 pr-4 font-medium">Available</th>
                  <th className="pb-3 pr-4 font-medium">Shortage</th>
                  <th className="pb-3 font-medium">Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {requirementRows.map((row) => (
                  <tr key={row.itemId} className="border-b border-[color:var(--app-border)] last:border-b-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{row.itemCode ? `${row.itemCode} - ` : ''}{row.itemName}</div>
                    </td>
                    <td className="py-3 pr-4">{String(row.unit ?? '')}</td>
                    <td className="py-3 pr-4">{formatNumber(row.perUnitRequirement)}</td>
                    <td className="py-3 pr-4">{formatNumber(Number(row.requiredQuantity ?? 0))}</td>
                    <td className="py-3 pr-4">{formatNumber(Number(row.availableQuantity ?? 0))}</td>
                    <td className={`py-3 pr-4 ${Number(row.shortageQuantity ?? 0) > 0 ? 'text-error' : 'text-success'}`}>
                      {formatNumber(Number(row.shortageQuantity ?? 0))}
                    </td>
                    <td className="py-3">{formatMoney(Number(row.estimatedMaterialCost ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              icon={<Calculator className="h-6 w-6" />}
              title="No calculated requirements yet"
              description={selectedProduct ? 'Enter a positive planned quantity and select a production warehouse.' : 'Select a Product Number with an active BOM to calculate requirements.'}
            />
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push(orderId ? `/production/orders/${orderId}` : '/production/orders')}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            submitting
            || (mode === 'edit' && blockingStatus !== 'PLANNED')
            || (mode === 'edit' && hasPostedDocuments)
          }
        >
          <Save className="mr-2 h-4 w-4" />
          {submitting ? 'Saving...' : mode === 'edit' ? 'Save Planned Order' : 'Create Planned Order'}
        </Button>
      </div>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <span className="text-[color:var(--app-muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
