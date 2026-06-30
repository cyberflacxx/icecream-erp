'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Plus, ShieldAlert } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { type CustomerListItem, useCustomers } from '@/hooks/sales/useCustomers';
import { useCreateCustomer } from '@/hooks/sales/useCreateCustomer';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

const initialCustomerForm = {
  address: '',
  code: '',
  creditAllowed: false,
  creditLimit: '0',
  customerGroupId: '',
  customerType: 'DIRECT_CUSTOMER',
  email: '',
  name: '',
  paymentTerms: 'Cash',
  phone: '',
  priceListCode: 'STANDARD',
  status: 'ACTIVE',
  taxNumber: '',
};

function getCreditState(row: CustomerListItem) {
  if (!row.creditAllowed) return { label: 'Cash Only', tone: 'text-brown' };
  if (row.creditLimit > 0 && row.currentBalance > row.creditLimit) return { label: 'Over Limit', tone: 'text-red-600' };
  if (row.creditLimit > 0 && row.currentBalance >= row.creditLimit * 0.8) return { label: 'Near Limit', tone: 'text-amber-600' };
  return { label: 'Within Limit', tone: 'text-emerald-600' };
}

export default function CustomersPage() {
  const query = useCustomers();
  const metaQuery = useSalesMeta();
  const createCustomer = useCreateCustomer();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialCustomerForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    try {
      await createCustomer.mutateAsync({
        address: formState.address || undefined,
        code: formState.code || undefined,
        creditAllowed: formState.creditAllowed,
        creditLimit: Number(formState.creditLimit || 0),
        customerGroupId: formState.customerGroupId || null,
        customerType: formState.customerType,
        email: formState.email || undefined,
        name: formState.name,
        paymentTerms: formState.paymentTerms || undefined,
        phone: formState.phone || undefined,
        priceListCode: formState.priceListCode || null,
        status: formState.status,
        taxNumber: formState.taxNumber || null,
      });
      setFormState(initialCustomerForm);
      setFormError(null);
      setIsDrawerOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create customer.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Customers unavailable" description={query.error?.message ?? 'No customer data returned.'} />;
  }

  const rows = query.data.data;
  const overLimitCount = rows.filter((row) => row.creditAllowed && row.creditLimit > 0 && row.currentBalance > row.creditLimit).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Manage customer accounts, price lists, credit terms, and balances."
        actions={
          <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        }
        status="partial"
      />
      <SalesNav />
      {overLimitCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">{overLimitCount} customer account{overLimitCount === 1 ? '' : 's'} over credit limit</p>
            <p className="mt-1 text-amber-800">Orders tied to these accounts should be approved against credit exposure before dispatch.</p>
          </div>
        </div>
      ) : null}
      <DataTable
        columns={[
          { key: 'code', header: 'Customer #' },
          {
            key: 'name',
            header: 'Customer',
            render: (row) => (
              <div>
                <div className="font-semibold text-brown">{row.name}</div>
                <div className="text-xs text-muted">{row.email ?? row.phone ?? 'No contact details'}</div>
              </div>
            ),
          },
          { key: 'customerType', header: 'Type' },
          { key: 'customerGroup', header: 'Group', render: (row) => row.customerGroup ?? 'Unassigned' },
          { key: 'priceListCode', header: 'Price List', render: (row) => row.priceListCode ?? 'Standard' },
          { key: 'paymentTerms', header: 'Terms', render: (row) => row.paymentTerms ?? 'Not set' },
          { key: 'creditLimit', header: 'Credit Limit', render: (row) => currency.format(row.creditLimit), className: 'px-5 py-4 text-sm text-right text-brown' },
          { key: 'currentBalance', header: 'Balance', render: (row) => currency.format(row.currentBalance), className: 'px-5 py-4 text-sm text-right text-brown' },
          {
            key: 'status',
            header: 'Credit Status',
            render: (row) => {
              const state = getCreditState(row);
              return <span className={state.tone}>{state.label}</span>;
            },
          },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={<EmptyState icon={<AlertCircle className="h-6 w-6" />} title="No customers found" description="Create customer accounts to track credit limits and pricing." />}
      />
      <FormDrawer title="Add Customer" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Customer name</span>
              <input required className="surface-input-soft" value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Customer code</span>
              <input className="surface-input-soft" placeholder="Auto generated if blank" value={formState.code} onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Type</span>
              <select className="surface-input-soft" value={formState.customerType} onChange={(event) => setFormState((current) => ({ ...current, customerType: event.target.value }))}>
                <option value="DIRECT_CUSTOMER">Direct customer</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="RETAIL">Retail</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Status</span>
              <select className="surface-input-soft" value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Email</span>
              <input className="surface-input-soft" type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Phone</span>
              <input className="surface-input-soft" value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment terms</span>
              <input className="surface-input-soft" value={formState.paymentTerms} onChange={(event) => setFormState((current) => ({ ...current, paymentTerms: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Price list</span>
              <input className="surface-input-soft" value={formState.priceListCode} onChange={(event) => setFormState((current) => ({ ...current, priceListCode: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Customer group</span>
              <select className="surface-input-soft" value={formState.customerGroupId} onChange={(event) => setFormState((current) => ({ ...current, customerGroupId: event.target.value }))}>
                <option value="">Unassigned</option>
                {metaQuery.data?.customerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax number</span>
              <input className="surface-input-soft" value={formState.taxNumber} onChange={(event) => setFormState((current) => ({ ...current, taxNumber: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Credit limit</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.creditLimit} onChange={(event) => setFormState((current) => ({ ...current, creditLimit: event.target.value }))} />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-cream/60 px-4 py-3 text-sm text-muted">
              <input checked={formState.creditAllowed} type="checkbox" onChange={(event) => setFormState((current) => ({ ...current, creditAllowed: event.target.checked }))} />
              Allow credit sales
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Address / additional information</span>
            <textarea className="surface-textarea-soft" rows={3} value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? 'Saving...' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
