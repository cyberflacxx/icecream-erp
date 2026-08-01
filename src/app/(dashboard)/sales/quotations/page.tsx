'use client';

import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FilePlus2, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { createSalesLineDraft, normalizeSalesLines, SalesLineItemsEditor, salesLineTotal, type SalesLineDraft } from '@/components/sales/sales-line-items-editor';
import { Button } from '@/components/ui/button';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';

const initialQuotationForm = {
  customerId: '',
  discountAmount: '0',
  items: [createSalesLineDraft()],
  notes: '',
  quotationDate: new Date().toISOString().slice(0, 10),
  taxAmount: '0',
  validUntil: '',
};

function totalDraft(lines: SalesLineDraft[], discountAmount: string, taxAmount: string) {
  return lines.reduce((sum, line) => sum + salesLineTotal(line), 0) - Number(discountAmount || 0) + Number(taxAmount || 0);
}

export default function SalesQuotationsPage() {
  const query = useSalesReport(API_ROUTES.SALES.QUOTATIONS);
  const metaQuery = useSalesMeta();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialQuotationForm);
  const [formError, setFormError] = useState<string | null>(null);
  const itemOptionsQuery = useItemSelectorOptions({
    customerId: formState.customerId || undefined,
    includePrice: true,
    includeStock: true,
  });
  const request = useSalesRequest();
  const queryClient = useQueryClient();
  const rows =
    query.data && typeof query.data === 'object' && Array.isArray((query.data as { data?: unknown }).data)
      ? (query.data as { data: Array<Record<string, unknown>> }).data
      : [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = normalizeSalesLines(formState.items);

    if (!formState.customerId || !items.length) {
      setFormError('Customer and at least one ordered item are required.');
      return;
    }

    if (items.some((item) => item.quantity <= 0 || item.unitPrice < 0 || Number.isNaN(item.quantity) || Number.isNaN(item.unitPrice))) {
      setFormError('Quantities must be greater than zero and prices must not be negative.');
      return;
    }

    try {
      await request(API_ROUTES.SALES.QUOTATIONS, {
        body: JSON.stringify({
          customerId: formState.customerId,
          discountAmount: Number(formState.discountAmount || 0),
          items,
          notes: formState.notes || null,
          quotationDate: formState.quotationDate || null,
          taxAmount: Number(formState.taxAmount || 0),
          validUntil: formState.validUntil || null,
        }),
        method: 'POST',
      });
      setFormState(initialQuotationForm);
      setFormError(null);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create quotation.');
    }
  }

  async function postAction(path: string) {
    await request(path, { body: JSON.stringify({}), method: 'POST' });
    await refresh();
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Quotations unavailable" description={query.error?.message ?? 'No quotation data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quotations"
        description="Track quotation totals, validity dates, and conversion readiness."
        actions={
          <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Quotation
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'quotationNumber', header: 'Quotation #' },
          { key: 'customer', header: 'Customer', render: (row) => (row.customer as { name?: string } | null)?.name ?? 'Unassigned' },
          { key: 'quotationDate', header: 'Date' },
          { key: 'validUntil', header: 'Valid Until' },
          { key: 'status', header: 'Status' },
          { key: 'itemsCount', header: 'Items' },
          { key: 'total', header: 'Total' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const id = String(row.id ?? '');
              const status = String(row.status ?? '').toLowerCase();
              if (!id || ['accepted', 'cancelled', 'rejected', 'expired'].includes(status)) return <span className="text-sm text-muted">No actions</span>;
              return (
                <div className="flex flex-wrap gap-2">
                  {status === 'draft' ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => postAction(API_ROUTES.SALES.QUOTATION_APPROVE(id))}>
                      Approve
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => postAction(API_ROUTES.SALES.QUOTATION_CONVERT(id))}>
                    Convert
                  </Button>
                </div>
              );
            },
          },
        ]}
        data={rows}
        emptyState={<EmptyState icon={<FilePlus2 className="h-6 w-6" />} title="No quotations found" description="Create a customer quotation with ordered items and pricing." />}
      />
      <FormDrawer title="New Quotation" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Customer</span>
            <select className="surface-input-soft" required value={formState.customerId} onChange={(event) => setFormState((current) => ({ ...current, customerId: event.target.value }))}>
              <option value="">Select customer</option>
              {metaQuery.data?.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code ? `${customer.code} - ` : ''}
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Quotation date</span>
              <input className="surface-input-soft" type="date" value={formState.quotationDate} onChange={(event) => setFormState((current) => ({ ...current, quotationDate: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Valid until</span>
              <input className="surface-input-soft" type="date" value={formState.validUntil} onChange={(event) => setFormState((current) => ({ ...current, validUntil: event.target.value }))} />
            </label>
          </div>
          <SalesLineItemsEditor
            items={itemOptionsQuery.data ?? []}
            loading={itemOptionsQuery.isLoading}
            errorMessage={itemOptionsQuery.error?.message ?? null}
            emptyMessage="No saleable items are available for quotation."
            lines={formState.items}
            onChange={(items) => setFormState((current) => ({ ...current, items }))}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-muted">
              <span>Discount amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.discountAmount} onChange={(event) => setFormState((current) => ({ ...current, discountAmount: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax amount</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.taxAmount} onChange={(event) => setFormState((current) => ({ ...current, taxAmount: event.target.value }))} />
            </label>
            <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-brown">
              <span className="text-muted">Estimated total</span>
              <p className="mt-1 text-lg font-semibold">{totalDraft(formState.items, formState.discountAmount, formState.taxAmount).toFixed(2)}</p>
            </div>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea className="surface-textarea-soft" rows={3} value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Quotation</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
