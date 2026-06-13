'use client';

import { AlertCircle, ShieldAlert } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { SalesNav } from '@/components/sales/sales-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { type CustomerListItem, useCustomers } from '@/hooks/sales/useCustomers';

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

function getCreditState(row: CustomerListItem) {
  if (!row.creditAllowed) return { label: 'Cash Only', tone: 'text-brown' };
  if (row.creditLimit > 0 && row.currentBalance > row.creditLimit) return { label: 'Over Limit', tone: 'text-red-600' };
  if (row.creditLimit > 0 && row.currentBalance >= row.creditLimit * 0.8) return { label: 'Near Limit', tone: 'text-amber-600' };
  return { label: 'Within Limit', tone: 'text-emerald-600' };
}

export default function CustomersPage() {
  const query = useCustomers();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Customers unavailable" description={query.error?.message ?? 'No customer data returned.'} />;
  }

  const rows = query.data.data;
  const overLimitCount = rows.filter((row) => row.creditAllowed && row.creditLimit > 0 && row.currentBalance > row.creditLimit).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Customers" description="Manage customer accounts, price lists, credit terms, and balances." status="partial" />
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
    </div>
  );
}
