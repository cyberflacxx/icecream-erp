'use client';

import { Wallet } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useOpeningBalances, usePostOpeningBalances } from '@/hooks/admin/useAdminReadiness';

export default function AdminOpeningBalancesPage() {
  const stock = useOpeningBalances('stock');
  const customers = useOpeningBalances('customers');
  const suppliers = useOpeningBalances('suppliers');
  const accounts = useOpeningBalances('accounts');
  const postAll = usePostOpeningBalances();

  if (stock.isLoading || customers.isLoading || suppliers.isLoading || accounts.isLoading) return <LoadingState />;
  if (stock.isError) return <EmptyState icon={<Wallet className="h-6 w-6" />} title="Opening balances unavailable" description={stock.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Opening Balances" description="Review stock, customer, supplier, and account opening balances before posting them into the live ERP state." status="partial" actions={<Button onClick={() => postAll.mutate({})}>Post Opening Balances</Button>} />
      <AdminNav />
      <DataTable data={Array.isArray(stock.data) ? stock.data : []} columns={[{ key: 'warehouse_id', header: 'Warehouse' }, { key: 'item_id', header: 'Item' }, { key: 'opening_quantity', header: 'Qty' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'posting_status', header: 'Status' }]} emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No opening stock" description="Opening stock balances will appear here once migrated or entered manually." />} />
      <DataTable data={Array.isArray(customers.data) ? customers.data : []} columns={[{ key: 'customer_id', header: 'Customer' }, { key: 'opening_invoice_reference', header: 'Reference' }, { key: 'opening_balance', header: 'Balance' }, { key: 'posting_status', header: 'Status' }]} emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No customer openings" description="Customer opening balances will appear here." />} />
      <DataTable data={Array.isArray(suppliers.data) ? suppliers.data : []} columns={[{ key: 'supplier_id', header: 'Supplier' }, { key: 'opening_invoice_reference', header: 'Reference' }, { key: 'opening_balance', header: 'Balance' }, { key: 'posting_status', header: 'Status' }]} emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No supplier openings" description="Supplier opening balances will appear here." />} />
      <DataTable data={Array.isArray(accounts.data) ? accounts.data : []} columns={[{ key: 'account_id', header: 'Account' }, { key: 'debit_amount', header: 'Debit' }, { key: 'credit_amount', header: 'Credit' }, { key: 'posting_status', header: 'Status' }]} emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No account openings" description="Opening journal balances will appear here." />} />
    </div>
  );
}
