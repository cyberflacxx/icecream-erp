'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { AlertCircle, Pencil, Plus, Power, Search, ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCustomers } from '@/hooks/sales/useCustomers';
import { useCreateCustomer } from '@/hooks/sales/useCreateCustomer';
import { useSalesRequest } from '@/hooks/sales/useSalesRequest';
import { usePermission } from '@/hooks/usePermission';
import { API_ROUTES } from '@/lib/shared';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

const initialCustomerForm = {
  address: '',
  code: '',
  creditLimit: '0',
  customerType: 'DIRECT_CUSTOMER',
  email: '',
  name: '',
  paymentTerms: 'Cash',
  phone: '',
  status: 'ACTIVE',
};

type CustomerFormState = typeof initialCustomerForm;
type EditableCustomer = {
  address: string | null;
  availableCredit: number;
  code: string;
  creditLimit: number;
  currentBalance: number;
  customerType: string;
  email: string | null;
  id: string;
  name: string;
  paymentTerms: string | null;
  phone: string | null;
  status: string;
};

function getCreditState(row: EditableCustomer) {
  if (row.creditLimit > 0 && row.currentBalance > row.creditLimit) {
    return { label: 'Over Limit', tone: 'text-red-600' };
  }
  if (row.creditLimit > 0 && row.currentBalance >= row.creditLimit * 0.8) {
    return { label: 'Near Limit', tone: 'text-amber-600' };
  }
  if (row.creditLimit <= 0) {
    return { label: 'Cash / Open', tone: 'text-brown' };
  }

  return { label: 'Within Limit', tone: 'text-emerald-600' };
}

function toFormState(customer: EditableCustomer): CustomerFormState {
  return {
    address: customer.address ?? '',
    code: customer.code,
    creditLimit: String(customer.creditLimit ?? 0),
    customerType: customer.customerType,
    email: customer.email ?? '',
    name: customer.name,
    paymentTerms: customer.paymentTerms ?? '',
    phone: customer.phone ?? '',
    status: customer.status,
  };
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<EditableCustomer | null>(null);
  const [formState, setFormState] = useState<CustomerFormState>(initialCustomerForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = useCustomers({ search, status: status || undefined });
  const createCustomer = useCreateCustomer();
  const request = useSalesRequest();
  const queryClient = useQueryClient();

  const canCreate = usePermission(['sales.customer.create', 'sales.write']);
  const canEdit = usePermission(['sales.customer.edit', 'sales.write']);
  const canActivate = usePermission(['sales.customer.activate', 'sales.write']);
  const canDeactivate = usePermission(['sales.customer.deactivate', 'sales.write']);

  const rows = query.data?.data ?? [];
  const overLimitCount = useMemo(
    () => rows.filter((row) => row.creditLimit > 0 && row.currentBalance > row.creditLimit).length,
    [rows],
  );

  async function refreshCustomers() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['sales', 'meta'] }),
    ]);
  }

  function openCreateDrawer() {
    setEditingCustomer(null);
    setFormState(initialCustomerForm);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(customer: EditableCustomer) {
    setEditingCustomer(customer);
    setFormState(toFormState(customer));
    setFormError(null);
    setIsDrawerOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (Number(formState.creditLimit) < 0) {
      setFormError('Credit limit must not be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        address: formState.address || undefined,
        code: formState.code || undefined,
        creditLimit: Number(formState.creditLimit || 0),
        customerType: formState.customerType,
        email: formState.email || undefined,
        name: formState.name,
        paymentTerms: formState.paymentTerms || undefined,
        phone: formState.phone || undefined,
        status: formState.status,
      };

      if (editingCustomer) {
        await request(API_ROUTES.SALES.CUSTOMER(editingCustomer.id), {
          body: JSON.stringify(payload),
          method: 'PATCH',
        });
        await refreshCustomers();
      } else {
        await createCustomer.mutateAsync(payload);
      }

      setFormState(initialCustomerForm);
      setEditingCustomer(null);
      setFormError(null);
      setIsDrawerOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleCustomerStatus(customer: EditableCustomer, nextStatus: 'ACTIVE' | 'INACTIVE') {
    setFormError(null);
    try {
      await request(
        nextStatus === 'ACTIVE'
          ? API_ROUTES.SALES.CUSTOMER_ACTIVATE(customer.id)
          : API_ROUTES.SALES.CUSTOMER_DEACTIVATE(customer.id),
        { method: 'POST' },
      );
      await refreshCustomers();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update customer status.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Customers unavailable"
        description={query.error?.message ?? 'No customer data returned.'}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Create, edit, activate, and deactivate customer accounts while monitoring balances and available credit."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          ) : undefined
        }
        status="partial"
      />
      <SalesNav />

      {overLimitCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">{overLimitCount} customer account{overLimitCount === 1 ? '' : 's'} over credit limit</p>
            <p className="mt-1 text-amber-800">Review these accounts before approving new credit sales.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="surface-input-soft pl-9"
            placeholder="Search customer name, code, email, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select className="surface-input-soft" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
      </div>

      {formError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {formError}
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
          {
            key: 'status',
            header: 'Account Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'paymentTerms', header: 'Terms', render: (row) => row.paymentTerms ?? 'Not set' },
          {
            key: 'creditLimit',
            header: 'Credit Limit',
            render: (row) => currency.format(row.creditLimit),
            className: 'px-5 py-4 text-right text-sm text-brown',
          },
          {
            key: 'currentBalance',
            header: 'Outstanding',
            render: (row) => currency.format(row.currentBalance),
            className: 'px-5 py-4 text-right text-sm text-brown',
          },
          {
            key: 'availableCredit',
            header: 'Available Credit',
            render: (row) => currency.format(row.availableCredit),
            className: 'px-5 py-4 text-right text-sm text-brown',
          },
          {
            key: 'creditState',
            header: 'Credit Status',
            render: (row) => {
              const state = getCreditState(row);
              return <span className={state.tone}>{state.label}</span>;
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {row.status === 'ACTIVE' && canDeactivate ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void toggleCustomerStatus(row, 'INACTIVE')}>
                    <Power className="mr-2 h-4 w-4" />
                    Deactivate
                  </Button>
                ) : null}
                {row.status !== 'ACTIVE' && canActivate ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void toggleCustomerStatus(row, 'ACTIVE')}>
                    <Power className="mr-2 h-4 w-4" />
                    Activate
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
        data={rows}
        pagination={query.data.pagination}
        emptyState={
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="No customers found"
            description="Create customer accounts to track balances and control credit exposure."
          />
        }
      />

      <FormDrawer
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add Customer'}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingCustomer(null);
          setFormState(initialCustomerForm);
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
                <option value="BLACKLISTED">Blacklisted</option>
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
              <span>Credit limit</span>
              <input className="surface-input-soft" min="0" step="0.01" type="number" value={formState.creditLimit} onChange={(event) => setFormState((current) => ({ ...current, creditLimit: event.target.value }))} />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Address</span>
            <textarea className="surface-textarea-soft" rows={3} value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCustomer.isPending || isSubmitting}>
              {createCustomer.isPending || isSubmitting ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
