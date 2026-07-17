'use client';

import Link from 'next/link';
import { AlertCircle, ArrowUpRight, ReceiptText } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceEmptyState } from '@/components/finance/finance-empty-state';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useFinanceTransactions } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceTransactionsPage() {
  const query = useFinanceTransactions();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return (
      <FinanceEmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Finance transactions unavailable"
        description="Finance transactions could not be loaded right now. Please refresh or try again."
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance Transactions"
        description="Review all posted and pending finance movements with links back to the originating document."
        status="partial"
      />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'date', header: 'Date' },
          { key: 'source', header: 'Source' },
          { key: 'reference', header: 'Reference' },
          { key: 'type', header: 'Type' },
          { key: 'method', header: 'Method' },
          { key: 'counterparty', header: 'Account / Party' },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', render: (row) => currency.format(Number(row.amount ?? 0)) },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Open',
            render: (row) => (
              <Button asChild size="sm" variant="outline">
                <Link href={String(row.sourceHref ?? '/finance')}>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  View
                </Link>
              </Button>
            ),
          },
        ]}
        data={query.data}
        emptyState={
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="No finance transactions found"
            description="Journals, cash movements, bank transactions, payments, and branch transactions will appear here."
          />
        }
      />
    </div>
  );
}
