'use client';

import { Building2, Plus, Warehouse } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { EmptyState, FormDrawer, PermissionGate, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  useCreateWarehouse,
  useInventoryMeta,
  useWarehouses,
  type WarehouseCard
} from '@/hooks/inventory';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

const warehouseTypes = [
  { label: 'Raw Materials', value: 'RAW_MATERIALS' },
  { label: 'Production Materials', value: 'PRODUCTION_MATERIALS' },
  { label: 'Work in Progress', value: 'WIP' },
  { label: 'Finished Goods', value: 'FINISHED_GOODS' },
  { label: 'Dispatch', value: 'DISPATCH' },
  { label: 'Returns', value: 'RETURNS' },
  { label: 'Damaged', value: 'DAMAGED' },
  { label: 'General', value: 'GENERAL' },
] as const;

const initialFormState = {
  address: '',
  branchId: '',
  code: '',
  isActive: true,
  name: '',
  type: 'MAIN'
};

function formatWarehouseType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function WarehousesPage() {
  const canManageWarehouses = usePermission(['inventory.warehouse.create', PERMISSIONS.settings.manage]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const warehousesQuery = useWarehouses();
  const metaQuery = useInventoryMeta();
  const createWarehouseMutation = useCreateWarehouse();

  const warehouses = warehousesQuery.data ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.code || !formState.name || !formState.type) {
      setFormError('Warehouse code, name, and type are required.');
      return;
    }

    setFormError(null);

    try {
      await createWarehouseMutation.mutateAsync({
        address: formState.address || null,
        branchId: formState.branchId || null,
        code: formState.code,
        isActive: formState.isActive,
        name: formState.name,
        type: formState.type
      });
      setFormState(initialFormState);
      setIsDrawerOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create warehouse.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Maintain raw materials, production materials, finished goods, dispatch, returns, and other stock locations with independent balances and valuation visibility."
        actions={
          <PermissionGate permission={['inventory.warehouse.create', PERMISSIONS.settings.manage]}>
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          </PermissionGate>
        }
      />

      <InventoryNav />

      {warehouses.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => (
            <WarehouseCardView key={warehouse.id} warehouse={warehouse} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Warehouse className="h-6 w-6" />}
          title="No warehouses configured"
          description="Create warehouses to define where inventory can be received, stored, transferred, and counted."
          action={
            canManageWarehouses ? (
              <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
                Add warehouse
              </Button>
            ) : null
          }
        />
      )}

      <FormDrawer title="Add Warehouse" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse code</span>
              <input
                required
                value={formState.code}
                onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse name</span>
              <input
                required
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse type</span>
              <select
                required
                value={formState.type}
                onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}
                className="surface-input-soft"
              >
                {warehouseTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Branch</span>
              <select
                value={formState.branchId}
                onChange={(event) => setFormState((current) => ({ ...current, branchId: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">No branch assigned</option>
                {metaQuery.data?.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Address</span>
            <textarea
              rows={4}
              value={formState.address}
              onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <label className="surface-checkbox-row">
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-border text-orange focus:ring-orange"
            />
            Mark warehouse as active
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWarehouseMutation.isPending}>
              {createWarehouseMutation.isPending ? 'Saving...' : 'Create Warehouse'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}

function WarehouseCardView({ warehouse }: { warehouse: WarehouseCard }) {
  return (
    <div className="surface-card-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{warehouse.code}</p>
          <h2 className="mt-3 text-xl font-semibold text-brown">{warehouse.name}</h2>
        </div>
        <StatusBadge status={formatWarehouseType(warehouse.type)} variant="info" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="surface-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Branch</p>
          <p className="mt-2 text-sm font-medium text-brown">{warehouse.branch?.name ?? 'Central warehouse'}</p>
        </div>
        <div className="surface-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Item count</p>
          <p className="mt-2 text-sm font-medium text-brown">{warehouse.itemCount}</p>
        </div>
        <div className="surface-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Total value</p>
          <p className="mt-2 text-sm font-medium text-brown">{currencyFormatter.format(warehouse.totalValue)}</p>
        </div>
        <div className="surface-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Status</p>
          <div className="mt-2">
            <StatusBadge status={warehouse.isActive ? 'Active' : 'Inactive'} variant={warehouse.isActive ? 'success' : 'neutral'} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 text-sm text-muted">
        <Building2 className="h-4 w-4 text-orange" />
        {warehouse.branch?.name ?? 'Shared central inventory visibility'}
      </div>
    </div>
  );
}
