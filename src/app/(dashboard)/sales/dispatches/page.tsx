'use client';

import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { Button } from '@/components/ui/button';
import { useSalesReport } from '@/hooks/sales/useSalesReport';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { API_ROUTES } from '@/lib/shared';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';

const initialDispatchForm = {
  dispatchDate: new Date().toISOString().slice(0, 10),
  invoiceId: '',
  vehicleReference: '',
  warehouseId: '',
};

export default function SalesDispatchesPage() {
  const query = useSalesReport(API_ROUTES.SALES.DISPATCHES);
  const metaQuery = useSalesMeta();
  const request = useSalesRequest();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialDispatchForm);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = Array.isArray(query.data) ? (query.data as Array<Record<string, unknown>>) : [];
  const dispatchableInvoices = (metaQuery.data?.invoices ?? []).filter(
    (invoice) => invoice.invoiceItems.length > 0 && ['approved', 'sent', 'partial_paid', 'paid'].includes(invoice.status.toLowerCase()),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoice = metaQuery.data?.invoices.find((row) => row.id === formState.invoiceId);

    if (!invoice || !formState.warehouseId) {
      setFormError('Approved invoice and warehouse are required.');
      return;
    }

    if (!invoice.invoiceItems.length) {
      setFormError('Selected invoice has no dispatchable items.');
      return;
    }

    try {
      await request(API_ROUTES.SALES.DISPATCHES, {
        body: JSON.stringify({
          dispatchDate: formState.dispatchDate || null,
          invoiceId: invoice.id,
          items: invoice.invoiceItems.map((item) => ({
            invoiceItemId: item.id,
            itemId: item.itemId,
            quantityDispatched: item.quantity,
            quantityInvoiced: item.quantity,
          })),
          vehicleReference: formState.vehicleReference || null,
          warehouseId: formState.warehouseId,
        }),
        method: 'POST',
      });
      setFormState(initialDispatchForm);
      setFormError(null);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create dispatch.');
    }
  }

  async function postDispatch(id: string) {
    await request(API_ROUTES.SALES.DISPATCH_POST(id), { body: JSON.stringify({}), method: 'POST' });
    await refresh();
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Dispatches unavailable" description={query.error?.message ?? 'No dispatch data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dispatch Management"
        description="Manage dispatch notes, invoice linkage, and dispatch status."
        actions={
          <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Dispatch
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      <DataTable
        columns={[
          { key: 'dispatch_note_number', header: 'Dispatch Note' },
          { key: 'invoice_id', header: 'Invoice' },
          { key: 'warehouse_id', header: 'Warehouse' },
          { key: 'dispatch_date', header: 'Dispatch Date' },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const id = String((row as Record<string, unknown>).id ?? '');
              const status = String((row as Record<string, unknown>).status ?? '').toUpperCase();
              if (!id || status !== 'PENDING') return <span className="text-sm text-muted">No actions</span>;
              return (
                <Button type="button" size="sm" variant="outline" onClick={() => postDispatch(id)}>
                  Post Stock Issue
                </Button>
              );
            },
          },
        ]}
        data={rows}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No dispatches found" description="Create dispatches from approved invoices to deduct stock." />}
      />
      <FormDrawer title="New Dispatch" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Invoice</span>
            <select className="surface-input-soft" required value={formState.invoiceId} onChange={(event) => {
              const invoice = metaQuery.data?.invoices.find((row) => row.id === event.target.value);
              setFormState((current) => ({
                ...current,
                invoiceId: event.target.value,
                warehouseId: invoice?.warehouseId ?? current.warehouseId,
              }));
            }}>
              <option value="">Select approved invoice</option>
              {dispatchableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {invoice.invoiceItems.length} item(s)
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Warehouse</span>
              <select className="surface-input-soft" required value={formState.warehouseId} onChange={(event) => setFormState((current) => ({ ...current, warehouseId: event.target.value }))}>
                <option value="">Select warehouse</option>
                {metaQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code ? `${warehouse.code} - ` : ''}
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Dispatch date</span>
              <input className="surface-input-soft" type="date" value={formState.dispatchDate} onChange={(event) => setFormState((current) => ({ ...current, dispatchDate: event.target.value }))} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Vehicle / delivery reference</span>
            <input className="surface-input-soft" value={formState.vehicleReference} onChange={(event) => setFormState((current) => ({ ...current, vehicleReference: event.target.value }))} />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Posting a dispatch deducts stock from the selected warehouse and records a stock movement.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Dispatch</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
