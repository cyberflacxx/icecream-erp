'use client';

import { Plus } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useInventoryMeta } from '@/hooks/inventory';
import { useProcurementRequest, useSupplierCategories } from '@/hooks/procurement';

import { Button } from '@/components/ui/button';
import { FormDrawer } from '@/components/ui-library';

type ShortcutMode = 'item' | 'supplier' | 'uom' | null;

interface TransactionShortcutsProps {
  allowItem?: boolean;
  allowSupplier?: boolean;
  allowUom?: boolean;
  className?: string;
  onItemCreated?: (item: {
    code: string;
    description: string | null;
    id: string;
    itemType: string;
    name: string;
    unitCost: number;
    unitOfMeasureId: string;
  }) => void;
  onSupplierCreated?: (supplier: {
    code: string | null;
    id: string;
    name: string;
  }) => void;
  onUomCreated?: (unit: {
    abbreviation: string;
    code: string | null;
    id: string;
    name: string;
  }) => void;
}

const itemTypes = [
  'RAW_MATERIAL',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'SPARE_PART',
] as const;

const initialItemState = {
  categoryId: '',
  code: '',
  description: '',
  itemType: 'RAW_MATERIAL',
  name: '',
  sellingPrice: '0',
  unitCost: '0',
  unitOfMeasureId: '',
};

const initialSupplierState = {
  categoryId: '',
  code: '',
  contactPerson: '',
  email: '',
  name: '',
  paymentTerms: '',
  phone: '',
  status: 'ACTIVE',
};

const initialUomState = {
  abbreviation: '',
  code: '',
  name: '',
};

export function TransactionShortcuts({
  allowItem = true,
  allowSupplier = true,
  allowUom = true,
  className,
  onItemCreated,
  onSupplierCreated,
  onUomCreated,
}: TransactionShortcutsProps) {
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const inventoryMetaQuery = useInventoryMeta({ includeInactiveItems: true });
  const supplierCategoriesQuery = useSupplierCategories();
  const [mode, setMode] = useState<ShortcutMode>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemState, setItemState] = useState(initialItemState);
  const [supplierState, setSupplierState] = useState(initialSupplierState);
  const [uomState, setUomState] = useState(initialUomState);

  const title = useMemo(() => {
    if (mode === 'item') return 'Create Item';
    if (mode === 'supplier') return 'Create Supplier';
    if (mode === 'uom') return 'Create Unit of Measure';
    return '';
  }, [mode]);

  function resetState() {
    setFormError(null);
    setIsSubmitting(false);
    setItemState(initialItemState);
    setSupplierState(initialSupplierState);
    setUomState(initialUomState);
  }

  function closeDrawer() {
    setMode(null);
    resetState();
  }

  async function refreshLookups() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    ]);
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!itemState.code.trim() || !itemState.name.trim() || !itemState.unitOfMeasureId) {
      setFormError('Item code, name, and unit of measure are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await request<{
        code: string;
        description: string | null;
        id: string;
        itemType: string;
        name: string;
        unitCost: number;
        unitOfMeasure: { id: string };
      }>('/api/inventory/items', {
        body: JSON.stringify({
          categoryId: itemState.categoryId || undefined,
          code: itemState.code.trim(),
          description: itemState.description.trim() || null,
          itemType: itemState.itemType,
          name: itemState.name.trim(),
          sellingPrice: Number(itemState.sellingPrice || 0),
          unitCost: Number(itemState.unitCost || 0),
          unitOfMeasureId: itemState.unitOfMeasureId,
        }),
        method: 'POST',
      });

      await refreshLookups();
      onItemCreated?.({
        code: created.code,
        description: created.description,
        id: created.id,
        itemType: created.itemType,
        name: created.name,
        unitCost: Number(created.unitCost ?? 0),
        unitOfMeasureId: String(created.unitOfMeasure?.id ?? itemState.unitOfMeasureId),
      });
      closeDrawer();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create item right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!supplierState.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await request<{
        code?: string | null;
        id: string;
        name: string;
      }>('/api/suppliers', {
        body: JSON.stringify({
          categoryId: supplierState.categoryId || undefined,
          code: supplierState.code.trim() || null,
          contactPerson: supplierState.contactPerson.trim() || null,
          email: supplierState.email.trim() || null,
          name: supplierState.name.trim(),
          paymentTerms: supplierState.paymentTerms.trim() || null,
          phone: supplierState.phone.trim() || null,
          status: supplierState.status,
        }),
        method: 'POST',
      });

      await refreshLookups();
      onSupplierCreated?.({
        code: created.code ?? null,
        id: created.id,
        name: created.name,
      });
      closeDrawer();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create supplier right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateUom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!uomState.name.trim() || !uomState.abbreviation.trim()) {
      setFormError('Unit name and abbreviation are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await request<{
        abbreviation: string;
        code?: string | null;
        id: string;
        name: string;
      }>('/api/settings/units', {
        body: JSON.stringify({
          abbreviation: uomState.abbreviation.trim(),
          code: uomState.code.trim() || null,
          isActive: true,
          name: uomState.name.trim(),
        }),
        method: 'POST',
      });

      await refreshLookups();
      onUomCreated?.({
        abbreviation: created.abbreviation,
        code: created.code ?? null,
        id: created.id,
        name: created.name,
      });
      closeDrawer();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create the unit of measure right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className={className ?? 'flex flex-wrap gap-2'}>
        {allowItem ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setMode('item')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Item
          </Button>
        ) : null}
        {allowSupplier ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setMode('supplier')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Supplier
          </Button>
        ) : null}
        {allowUom ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setMode('uom')}>
            <Plus className="mr-2 h-4 w-4" />
            Create UOM
          </Button>
        ) : null}
      </div>

      <FormDrawer title={title} open={Boolean(mode)} onClose={closeDrawer}>
        {formError ? (
          <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {formError}
          </div>
        ) : null}

        {mode === 'item' ? (
          <form className="space-y-5" onSubmit={handleCreateItem}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Item code</span>
                <input
                  required
                  value={itemState.code}
                  onChange={(event) => setItemState((current) => ({ ...current, code: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Item name</span>
                <input
                  required
                  value={itemState.name}
                  onChange={(event) => setItemState((current) => ({ ...current, name: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Category</span>
                <select
                  value={itemState.categoryId}
                  onChange={(event) => setItemState((current) => ({ ...current, categoryId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">Uncategorized</option>
                  {(inventoryMetaQuery.data?.categories ?? []).map((category) => (
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
                  value={itemState.unitOfMeasureId}
                  onChange={(event) => setItemState((current) => ({ ...current, unitOfMeasureId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">Select UOM</option>
                  {(inventoryMetaQuery.data?.unitsOfMeasure ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Item type</span>
                <select
                  value={itemState.itemType}
                  onChange={(event) => setItemState((current) => ({ ...current, itemType: event.target.value }))}
                  className="surface-input-soft"
                >
                  {itemTypes.map((itemType) => (
                    <option key={itemType} value={itemType}>
                      {itemType.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Cost / purchase price</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={itemState.unitCost}
                  onChange={(event) => setItemState((current) => ({ ...current, unitCost: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Selling price</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={itemState.sellingPrice}
                  onChange={(event) => setItemState((current) => ({ ...current, sellingPrice: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
            </div>
            <label className="space-y-2 text-sm text-muted">
              <span>Description</span>
              <textarea
                rows={4}
                value={itemState.description}
                onChange={(event) => setItemState((current) => ({ ...current, description: event.target.value }))}
                className="surface-textarea-soft"
              />
            </label>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === 'supplier' ? (
          <form className="space-y-5" onSubmit={handleCreateSupplier}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Supplier name</span>
                <input
                  required
                  value={supplierState.name}
                  onChange={(event) => setSupplierState((current) => ({ ...current, name: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Supplier code</span>
                <input
                  value={supplierState.code}
                  onChange={(event) => setSupplierState((current) => ({ ...current, code: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Contact person</span>
                <input
                  value={supplierState.contactPerson}
                  onChange={(event) => setSupplierState((current) => ({ ...current, contactPerson: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Phone</span>
                <input
                  value={supplierState.phone}
                  onChange={(event) => setSupplierState((current) => ({ ...current, phone: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Email</span>
                <input
                  type="email"
                  value={supplierState.email}
                  onChange={(event) => setSupplierState((current) => ({ ...current, email: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Payment terms</span>
                <input
                  value={supplierState.paymentTerms}
                  onChange={(event) => setSupplierState((current) => ({ ...current, paymentTerms: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Category</span>
                <select
                  value={supplierState.categoryId}
                  onChange={(event) => setSupplierState((current) => ({ ...current, categoryId: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="">General</option>
                  {(supplierCategoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Status</span>
                <select
                  value={supplierState.status}
                  onChange={(event) => setSupplierState((current) => ({ ...current, status: event.target.value }))}
                  className="surface-input-soft"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Supplier'}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === 'uom' ? (
          <form className="space-y-5" onSubmit={handleCreateUom}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Unit name</span>
                <input
                  required
                  value={uomState.name}
                  onChange={(event) => setUomState((current) => ({ ...current, name: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Abbreviation</span>
                <input
                  required
                  value={uomState.abbreviation}
                  onChange={(event) => setUomState((current) => ({ ...current, abbreviation: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted sm:col-span-2">
                <span>Code</span>
                <input
                  value={uomState.code}
                  onChange={(event) => setUomState((current) => ({ ...current, code: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create UOM'}
              </Button>
            </div>
          </form>
        ) : null}
      </FormDrawer>
    </>
  );
}
