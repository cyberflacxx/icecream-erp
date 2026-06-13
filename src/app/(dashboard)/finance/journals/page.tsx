'use client';

import { AlertCircle } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { DataTable, EmptyState, LoadingState } from '@/components/ui-library';
import { useJournalEntries } from '@/hooks/finance/useFinanceResources';

export default function FinanceJournalsPage() {
  const query = useJournalEntries();

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Journal entries unavailable" description={query.error?.message ?? 'No journal entry data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Journal Entries" description="Review accounting journals, posting status, and debit-credit balancing." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'entryNumber', header: 'Entry #' },
          { key: 'entryDate', header: 'Date' },
          { key: 'description', header: 'Description' },
          { key: 'status', header: 'Status' },
          { key: 'totalDebit', header: 'Debit' },
          { key: 'totalCredit', header: 'Credit' },
        ]}
        data={query.data.data}
        pagination={query.data.pagination}
      />
    </div>
  );
}
