'use client';

import Link from 'next/link';
import { Package2, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { z } from 'zod';

import { DataTable, EmptyState, FilterBar, FormDrawer, PermissionGate, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { InventoryNav } from '@/components/inventory/inventory-nav';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { useCreateItem, useInventoryMeta, useItems, type InventoryItemRow } from '@/hooks/inventory';
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
  categoryId: z.string().min(1, 'Category is required.'),
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
  const [filters, setFilters] = useState({
    category: '',
    page: 1,
    pageSize: 10,
    search: '',
    status: '',
    type: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = itemFormSchema.safeParse(formState);

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please review the item form.');
      return;
    }

    try {
      await createItemMutation.mutateAsync({
        ...parsed.data,
        description: parsed.data.description || null
      });
      setFormState(initialFormState);
      setIsDrawerOpen(false);
      setFilters((current) => ({
        ...current,
        page: 1
      }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create inventory item.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Items"
        description="Manage item masters, replenishment thresholds, and expiry tracking rules before they flow into receiving, production, and branch operations."
        actions={
          <PermissionGate permission={PERMISSIONS.settings.manage}>
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
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
            render: (row) => formatItemType(row.itemType)
          },
          {
            key: 'category',
            header: 'Category',
            render: (row) => row.category.name
          },
          {
            key: 'unitOfMeasure',
            header: 'UOM',
            render: (row) => row.unitOfMeasure.abbreviation
          },
          {
            key: 'unitCost',
            header: 'Unit Cost',
            render: (row) => currencyFormatter.format(row.unitCost)
          },
          {
            key: 'reorderLevel',
            header: 'Reorder Level',
            render: (row) => numberFormatter.format(row.reorderLevel)
          },
          {
            key: 'stock',
            header: 'Stock',
            render: (row) => numberFormatter.format(row.stock)
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
                {row.trackExpiry ? <StatusBadge status="Expiry" variant="info" /> : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/inventory/stock-balances">View Stock</Link>
                </Button>
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
                <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
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

      <FormDrawer title="Add Inventory Item" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Item name</span>
              <input
                required
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
                required
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, categoryId: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="">Select category</option>
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
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
            <Button type="submit" disabled={createItemMutation.isPending}>
              {createItemMutation.isPending ? 'Saving...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
