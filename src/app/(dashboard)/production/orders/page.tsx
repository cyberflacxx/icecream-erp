'use client';

import Link from 'next/link';
import { AlertCircle, Plus, Search, ScrollText } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionOrderProducts, useProductionOrders } from '@/hooks/production/useProductionOrders';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { API_ROUTES } from '@/lib/shared';

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  finishedGoodsWarehouseId: '',
  plannedDueDate: '',
  plannedQuantity: '100',
  plannedStartDate: today,
  priority: 'NORMAL',
  productId: '',
  productionWarehouseId: '',
  remarks: '',
};

function formatQuantity(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default function ProductionOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const ordersQuery = useProductionOrders({ search, status });
  const productsQuery = useProductionOrderProducts();
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const router = useRouter();
  const queryClient = useQueryClient();

  const warehouses = metaQuery.data?.warehouses ?? [];
  const productionWarehouses = warehouses.filter((warehouse) => warehouse.isProductionMaterialWarehouse || warehouse.isProductionWarehouse);
  const finishedWarehouses = warehouses.filter((warehouse) => warehouse.isProductionFinishedWarehouse || warehouse.isMainWarehouse || warehouse.isProductionWarehouse);
  const selectedProduct = useMemo(
    () => (productsQuery.data ?? []).find((product) => String(product.id) === form.productId),
    [form.productId, productsQuery.data],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      const result = await request<{ productionOrderId?: string }>(API_ROUTES.PRODUCTION.ORDERS, {
        body: JSON.stringify({
          finishedGoodsWarehouseId: form.finishedGoodsWarehouseId,
          plannedDueDate: form.plannedDueDate || null,
          plannedQuantity: Number(form.plannedQuantity),
          plannedStartDate: form.plannedStartDate || null,
          priority: form.priority,
          productId: form.productId,
          productionWarehouseId: form.productionWarehouseId,
          remarks: form.remarks || null,
        }),
        method: 'POST',
      });

      setOpen(false);
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: ['production'] });
      if (result.productionOrderId) router.push(`/production/orders/${result.productionOrderId}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create production order.');
    }
  }

  if (ordersQuery.isLoading || metaQuery.isLoading || productsQuery.isLoading) return <LoadingState />;
  if (ordersQuery.isError) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Production orders unavailable" description={ordersQuery.error.message} />;
  }

  const orders = ordersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Orders"
        description="Plan, release, issue materials, receive output, and close production from one controlled document."
        actions={
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        }
      />
      <ProductionNav />

      <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 shadow-sm md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" />
          <input
            className="surface-input-soft pl-9"
            placeholder="Order, product number, or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select className="surface-input-soft md:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="RELEASED">Released</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'production_order_number',
            header: 'Order #',
            render: (row) => <Link className="font-semibold text-[color:var(--app-accent-strong)]" href={`/production/orders/${row.id}`}>{row.production_order_number}</Link>,
          },
          { key: 'product_number', header: 'Product #' },
          { key: 'product_description_snapshot', header: 'Description' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'planned_quantity', header: 'Planned', render: (row) => formatQuantity(row.planned_quantity) },
          { key: 'released_quantity', header: 'Released', render: (row) => formatQuantity(row.released_quantity) },
          { key: 'completed_quantity', header: 'Completed', render: (row) => formatQuantity(row.completed_quantity) },
          { key: 'remaining_quantity', header: 'Remaining', render: (row) => formatQuantity(row.remaining_quantity) },
          { key: 'planned_due_date', header: 'Due Date', render: (row) => String(row.planned_due_date ?? '') },
        ]}
        data={orders}
        emptyState={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No production orders" description="Create the first planned production order from an active product BOM." />}
      />

      <FormDrawer title="New Production Order" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{formError}</div> : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Product Number</span>
            <select className="surface-input-soft" value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}>
              <option value="">Select product</option>
              {(productsQuery.data ?? []).map((product) => (
                <option key={String(product.id)} value={String(product.id)}>
                  {String(product.code ?? '')} - {String(product.name ?? product.description ?? '')}
                </option>
              ))}
            </select>
          </label>

          {selectedProduct ? (
            <div className="grid gap-3 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-3 text-sm md:grid-cols-3">
              <span><span className="text-[color:var(--app-muted)]">BOM</span> {String((selectedProduct.activeBom as Record<string, unknown> | null)?.code ?? '')}</span>
              <span><span className="text-[color:var(--app-muted)]">Version</span> {String((selectedProduct.activeBom as Record<string, unknown> | null)?.version ?? '')}</span>
              <span><span className="text-[color:var(--app-muted)]">Unit Cost</span> {formatQuantity(selectedProduct.unit_cost ?? selectedProduct.standard_cost)}</span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Planned Quantity</span>
              <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={form.plannedQuantity} onChange={(event) => setForm((current) => ({ ...current, plannedQuantity: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Priority</span>
              <select className="surface-input-soft" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Production Warehouse</span>
              <select className="surface-input-soft" value={form.productionWarehouseId} onChange={(event) => setForm((current) => ({ ...current, productionWarehouseId: event.target.value }))}>
                <option value="">Select warehouse</option>
                {productionWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Finished-Goods Warehouse</span>
              <select className="surface-input-soft" value={form.finishedGoodsWarehouseId} onChange={(event) => setForm((current) => ({ ...current, finishedGoodsWarehouseId: event.target.value }))}>
                <option value="">Select warehouse</option>
                {finishedWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Start Date</span>
              <input className="surface-input-soft" type="date" value={form.plannedStartDate} onChange={(event) => setForm((current) => ({ ...current, plannedStartDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Due Date</span>
              <input className="surface-input-soft" type="date" value={form.plannedDueDate} onChange={(event) => setForm((current) => ({ ...current, plannedDueDate: event.target.value }))} />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Remarks</span>
            <textarea className="surface-input-soft min-h-24" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Planned Order</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
