'use client';

import Link from 'next/link';
import { Package2, Pencil, Plus, Power } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { ConfirmDialog, DataTable, EmptyState, FilterBar, FormDrawer, PermissionGate, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { useCreateItem, useInventoryMeta, useItems, type InventoryItemRow } from '@/hooks/inventory';
import { useInventoryRequest } from '@/hooks/inventory/useInventoryRequest';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

const itemTypeOptions = [
  { label: 'Raw Material', value: 'RAW_MATERIAL' },
  { label: 'Packaging Material', value: 'PACKAGING_MATERIAL' },
  { label: 'Finished Good', value: 'FINISHED_GOOD' },
  { label: 'Consumable', value: 'CONSUMABLE' },
  { label: 'Spare Part', value: 'SPARE_PART' },
  { label: 'Work In Progress', value: 'WORK_IN_PROGRESS' }
] as const;

const itemFormSchema = z.object({
  categoryId: z.string().optional(),
  code: z.string().trim().min(1, 'Item code is required.'),
  description: z.string().trim().optional(),
  isActive: z.boolean(),
  itemType: z.enum([
    'RAW_MATERIAL',
    'PACKAGING_MATERIAL',
    'FINISHED_GOOD',
    'CONSUMABLE',
    'SPARE_PART',
    'WORK_IN_PROGRESS'
  ]),
  name: z.string().trim().min(1, 'Item name is required.'),
  reorderLevel: z.coerce.number().min(0, 'Reorder level must be 0 or more.'),
  reorderQuantity: z.coerce.number().min(0, 'Reorder quantity must be 0 or more.'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be 0 or more.'),
  trackExpiry: z.boolean(),
  unitCost: z.coerce.number().min(0, 'Unit cost must be 0 or more.'),
  unitOfMeasureId: z.string().min(1, 'Unit of measure is required.')
});

const initialFormState = {
  categoryId: '',
  code: '',
  description: '',
  isActive: true,
  itemType: 'RAW_MATERIAL',
  name: '',
  reorderLevel: '0',
  reorderQuantity: '0',
  sellingPrice: '0',
  trackExpiry: false,
  unitCost: '0',
  unitOfMeasureId: ''
};

function formatItemType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function InventoryItemsPage() {
  const canManageItems = usePermission(PERMISSIONS.settings.manage);
  const queryClient = useQueryClient();
  const request = useInventoryRequest();
  const [filters, setFilters] = useState({
    category: '',
    page: 1,
    pageSize: 10,
    search: '',
    status: '',
    type: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<InventoryItemRow | null>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);

  const metaQuery = useInventoryMeta({
    includeInactiveItems: true
  });
  const itemsQuery = useItems({
    category: filters.category || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    status:
      filters.status === 'active' || filters.status === 'inactive'
        ? filters.status
        : undefined,
    type: filters.type || undefined
  });
  const createItemMutation = useCreateItem();

  const items = itemsQuery.data?.data ?? [];
  const pagination = itemsQuery.data?.pagination;

  function openCreateDrawer() {
    setEditingItem(null);
    setFormState(initialFormState);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(row: InventoryItemRow) {
    setEditingItem(row);
    setFormState({
      categoryId: row.category?.id ?? '',
      code: row.code ?? '',
      description: row.description ?? '',
      isActive: Boolean(row.isActive),
      itemType: row.itemType ?? 'RAW_MATERIAL',
      name: row.name ?? '',
      reorderLevel: String(row.reorderLevel ?? 0),
      reorderQuantity: String(row.reorderQuantity ?? 0),
      sellingPrice: String(row.sellingPrice ?? 0),
      trackExpiry: Boolean(row.trackExpiry),
      unitCost: String(row.unitCost ?? 0),
      unitOfMeasureId: row.unitOfMeasure?.id ?? ''
    });
    setFormError(null);
    setIsDrawerOpen(true);
  }

  async function refreshItems() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['sales', 'meta'] }),
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey)
          && query.queryKey[0] === 'selectors'
          && query.queryKey[1] === 'items'
      })
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = itemFormSchema.safeParse(formState);

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please review the item form.');
      return;
    }

    setIsSavingItem(true);
    try {
      const payload = {
        ...parsed.data,
        description: parsed.data.description || null
      };
      if (editingItem) {
        await request(`/api/inventory/items/${editingItem.id}`, {
          body: JSON.stringify(payload),
          method: 'PATCH'
        });
        await refreshItems();
      } else {
        await createItemMutation.mutateAsync(payload);
      }
      setFormState(initialFormState);
      setEditingItem(null);
      setIsDrawerOpen(false);
      setFilters((current) => ({
        ...current,
        page: 1
      }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save inventory item.');
    } finally {
      setIsSavingItem(false);
    }
  }

  async function toggleItemStatus() {
    if (!statusTarget) return;
    setActionError(null);
    setIsSavingItem(true);
    try {
      await request(`/api/inventory/items/${statusTarget.id}`, {
        body: JSON.stringify({ isActive: !statusTarget.isActive }),
        method: 'PATCH'
      });
      await refreshItems();
      setStatusTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update item status.');
    } finally {
      setIsSavingItem(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Items"
        description="Manage item masters, replenishment thresholds, and expiry tracking rules before they flow into receiving, production, and branch operations."
        actions={
          <PermissionGate permission={PERMISSIONS.settings.manage}>
            <Button type="button" size="sm" onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </PermissionGate>
        }
      />

      <InventoryNav />

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search items',
            placeholder: 'Code or name',
            type: 'search',
            value: filters.search
          },
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            value: filters.category,
            options:
              metaQuery.data?.categories.map((category) => ({
                label: category.name,
                value: category.id
              })) ?? []
          },
          {
            key: 'type',
            label: 'Item type',
            type: 'select',
            value: filters.type,
            options: [...itemTypeOptions]
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: filters.status,
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]
          }
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1
          }))
        }
      />

      <DataTable<InventoryItemRow>
        data={items}
        loading={itemsQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name' },
          {
            key: 'itemType',
            header: 'Type',
            render: (row) => formatItemType(row.itemType ?? 'UNKNOWN')
          },
          {
            key: 'category',
            header: 'Category',
            render: (row) => row.category?.name ?? 'Uncategorized'
          },
          {
            key: 'unitOfMeasure',
            header: 'UOM',
            render: (row) => row.unitOfMeasure?.abbreviation ?? '--'
          },
          {
            key: 'unitCost',
            header: 'Unit Cost',
            render: (row) => currencyFormatter.format(Number(row.unitCost ?? 0))
          },
          {
            key: 'reorderLevel',
            header: 'Reorder Level',
            render: (row) => numberFormatter.format(Number(row.reorderLevel ?? 0))
          },
          {
            key: 'stock',
            header: 'Stock',
            render: (row) => numberFormatter.format(Number(row.stock ?? 0))
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} variant={row.isActive ? 'success' : 'neutral'} />
            )
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {canManageItems ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {canManageItems ? (
                  <Button type="button" size="sm" variant={row.isActive ? 'destructive' : 'outline'} onClick={() => { setActionError(null); setStatusTarget(row); }}>
                    <Power className="mr-2 h-4 w-4" />
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/inventory/stock-balances">View Stock</Link>
                </Button>
                {row.trackExpiry ? <StatusBadge status="Expiry" variant="info" /> : null}
              </div>
            )
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Package2 className="h-6 w-6" />}
            title="No inventory items yet"
            description="Create the item master records first so procurement, receiving, and stock valuation can work from a clean catalog."
            action={
              canManageItems ? (
                <Button type="button" size="sm" onClick={openCreateDrawer}>
                  Add the first item
                </Button>
              ) : null
            }
          />
        }
      />

      {pagination ? (
        <PaginationControls
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(page) =>
            setFilters((current) => ({
              ...current,
              page
            }))
          }
        />
      ) : null}

      <FormDrawer
        title={editingItem ? `Edit Inventory Item: ${editingItem.name}` : 'Add Inventory Item'}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingItem(null);
          setFormState(initialFormState);
          setFormError(null);
        }}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Item code</span>
              <input
                required
                value={formState.code}
                onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Item name</span>
              <input
                required
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({ ...current, description: event.target.value }))
              }
              className="surface-textarea-soft"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Item type</span>
              <select
                required
                value={formState.itemType}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, itemType: event.target.value }))
                }
                className="surface-input-soft"
              >
                {itemTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Category</span>
              <select
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, categoryId: event.target.value }))
                }
                className="surface-input-soft"
              >
                <option value="">Uncategorized</option>
                {metaQuery.data?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Unit of measure</span>
              <select
                required
                value={formState.unitOfMeasureId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, unitOfMeasureId: event.target.value }))
                }
                className="surface-input-soft"
              >
                <option value="">Select UOM</option>
                {metaQuery.data?.unitsOfMeasure.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.abbreviation})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reorder level</span>
              <input
                required
                min="0"
                step="0.001"
                type="number"
                value={formState.reorderLevel}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, reorderLevel: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Reorder quantity</span>
              <input
                required
                min="0"
                step="0.001"
                type="number"
                value={formState.reorderQuantity}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, reorderQuantity: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Unit cost</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={formState.unitCost}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, unitCost: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Selling price</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={formState.sellingPrice}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, sellingPrice: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-cream/60 p-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-brown">
              <input
                type="checkbox"
                checked={formState.trackExpiry}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, trackExpiry: event.target.checked }))
                }
                className="h-4 w-4 rounded border-border text-orange focus:ring-orange"
              />
              Track expiry on this item
            </label>
            <label className="flex items-center gap-3 text-sm text-brown">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="h-4 w-4 rounded border-border text-orange focus:ring-orange"
              />
              Mark item as active
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createItemMutation.isPending || isSavingItem}>
              {createItemMutation.isPending || isSavingItem ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.isActive ? 'Deactivate inventory item' : 'Activate inventory item'}
        description={
          statusTarget?.isActive
            ? 'This keeps the item history intact and removes it from active operational selectors. Stock and posting history are not deleted.'
            : 'This makes the item available again in operational selectors.'
        }
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Activate'}
        loading={isSavingItem}
        errorMessage={actionError}
        onCancel={() => {
          setStatusTarget(null);
          setActionError(null);
        }}
        onConfirm={() => void toggleItemStatus()}
      />
    </div>
  );
}
