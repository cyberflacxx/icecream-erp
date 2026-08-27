'use client';

import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { Button } from '@/components/ui/button';
import { useSalesPrices } from '@/hooks/sales/useSalesPrices';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';

const initialPriceForm = {
  effectiveDate: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  itemId: '',
  priceListCode: 'STANDARD',
  sellingPrice: '0',
};

export default function SalesPricesPage() {
  const query = useSalesPrices();
  const metaQuery = useSalesMeta();
  const request = useSalesRequest();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialPriceForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.itemId || !formState.priceListCode.trim()) {
      setFormError('Item and price list are required.');
      return;
    }

    const sellingPrice = Number(formState.sellingPrice);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setFormError('Selling price must be zero or greater.');
      return;
    }

    try {
      await request(API_ROUTES.SALES.PRICES, {
        body: JSON.stringify({
          effectiveDate: formState.effectiveDate || null,
          expiryDate: formState.expiryDate || null,
          itemId: formState.itemId,
          priceListCode: formState.priceListCode,
          sellingPrice,
        }),
        method: 'POST',
      });
      setFormState(initialPriceForm);
      setFormError(null);
      setIsDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save price adjustment.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Prices unavailable" description={query.error?.message ?? 'No price data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Price Management"
        description="Review price lists, effective dates, and active selling prices."
        actions={
          <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Price Adjustment
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <DataTable
        columns={[
          {
            key: 'items',
            header: 'Item',
            render: (row) => {
              const item = (row as { items?: { code?: string; name?: string } | Array<{ code?: string; name?: string }> }).items;
              const resolved = Array.isArray(item) ? item[0] : item;
              return resolved ? `${resolved.code ? `${resolved.code} - ` : ''}${resolved.name ?? ''}` : String((row as { item_id?: string }).item_id ?? '');
            },
          },
          { key: 'price_list_code', header: 'Price List' },
          { key: 'selling_price', header: 'Selling Price', render: (row) => Number((row as { selling_price?: number }).selling_price ?? 0).toFixed(2) },
          { key: 'effective_date', header: 'Effective Date' },
          { key: 'expiry_date', header: 'Expiry Date' },
          { key: 'is_active', header: 'Active', render: (row) => ((row as { is_active?: boolean }).is_active === false ? 'No' : 'Yes') },
        ]}
        data={Array.isArray(query.data) ? query.data : []}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No prices found" description="Add a price adjustment for a saleable inventory item." />}
      />
      <FormDrawer title="Price Adjustment" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Item</span>
            <select className="surface-input-soft" required value={formState.itemId} onChange={(event) => setFormState((current) => ({ ...current, itemId: event.target.value }))}>
              <option value="">Select item</option>
              {metaQuery.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Price list</span>
              <input className="surface-input-soft" required value={formState.priceListCode} onChange={(event) => setFormState((current) => ({ ...current, priceListCode: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Selling price</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.sellingPrice} onChange={(event) => setFormState((current) => ({ ...current, sellingPrice: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Effective date</span>
              <input className="surface-input-soft" type="date" value={formState.effectiveDate} onChange={(event) => setFormState((current) => ({ ...current, effectiveDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Expiry date</span>
              <input className="surface-input-soft" type="date" value={formState.expiryDate} onChange={(event) => setFormState((current) => ({ ...current, expiryDate: event.target.value }))} />
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Price</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
