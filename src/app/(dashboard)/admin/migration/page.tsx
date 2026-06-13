'use client';

import { useMemo, useState } from 'react';
import { ArrowDownToLine, DatabaseZap } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';
import { useApproveMigrationBatch, useImportMigrationBatch, useMigrationDashboard, useMigrationHistory, useMigrationTemplates, useUploadMigrationBatch, useValidateMigrationBatch } from '@/hooks/admin/useAdminReadiness';

export default function AdminMigrationPage() {
  const dashboard = useMigrationDashboard();
  const history = useMigrationHistory();
  const templates = useMigrationTemplates();
  const upload = useUploadMigrationBatch();
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const firstTemplate = useMemo(() => Array.isArray(templates.data) ? templates.data[0] : null, [templates.data]);

  if (dashboard.isLoading || history.isLoading || templates.isLoading) return <LoadingState />;
  if (dashboard.isError || history.isError) {
    return <EmptyState icon={<DatabaseZap className="h-6 w-6" />} title="Migration center unavailable" description={dashboard.error?.message ?? history.error?.message ?? 'Failed to load migration data.'} />;
  }

  const stats = (dashboard.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(history.data) ? history.data : [];

  return (
    <div className="space-y-8">
      <PageHeader title="Migration Center" description="Upload migration batches, validate row-level issues, approve imports, and review import history for go-live." status="partial" />
      <AdminNav />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Batches" value={String(stats.totalMigrationBatches ?? 0)} icon={<DatabaseZap className="h-5 w-5" />} />
        <StatCard title="Pending Validation" value={String(stats.pendingValidations ?? 0)} icon={<DatabaseZap className="h-5 w-5" />} color="warning" />
        <StatCard title="Failed" value={String(stats.failedMigrations ?? 0)} icon={<DatabaseZap className="h-5 w-5" />} color="brown" />
        <StatCard title="Imported" value={String(stats.successfulMigrations ?? 0)} icon={<DatabaseZap className="h-5 w-5" />} color="success" />
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <h3 className="text-lg font-semibold text-brown dark:text-darkText">Quick Upload</h3>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="text-sm text-muted dark:text-darkMuted">
            {firstTemplate ? `First template available: ${String((firstTemplate as Record<string, unknown>).template_name ?? '')}` : 'No template metadata found.'}
          </div>
          <Button
            onClick={() =>
              upload.mutate({
                migrationType: 'opening-stock-balances',
                fileName: 'opening-stock.xlsx',
                templateVersion: 'v1',
                remarks: 'Seed opening stock balances',
                rows: [],
              })
            }
          >
            Create Empty Batch
          </Button>
        </div>
      </section>

      <DataTable
        data={rows}
        columns={[
          { key: 'batch_number', header: 'Batch' },
          { key: 'data_type', header: 'Type' },
          { key: 'file_name', header: 'File' },
          { key: 'total_rows', header: 'Rows' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <MigrationBatchActions
                batchId={String(row.id ?? '')}
                pendingBatchId={pendingBatchId}
                setPendingBatchId={setPendingBatchId}
              />
            ),
          },
        ]}
        emptyState={<EmptyState icon={<DatabaseZap className="h-6 w-6" />} title="No migration batches" description="Upload the first approved migration file to begin deployment prep." />}
      />
    </div>
  );
}

function MigrationBatchActions({
  batchId,
  pendingBatchId,
  setPendingBatchId,
}: {
  batchId: string;
  pendingBatchId: string | null;
  setPendingBatchId: (value: string | null) => void;
}) {
  const validate = useValidateMigrationBatch(batchId);
  const approve = useApproveMigrationBatch(batchId);
  const runImport = useImportMigrationBatch(batchId);
  const isPending =
    pendingBatchId === batchId && (validate.isPending || approve.isPending || runImport.isPending);

  async function runAction(action: 'validate' | 'approve' | 'import') {
    setPendingBatchId(batchId);
    try {
      if (action === 'validate') {
        await validate.mutateAsync({});
      } else if (action === 'approve') {
        await approve.mutateAsync({});
      } else {
        await runImport.mutateAsync({});
      }
    } finally {
      setPendingBatchId(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => { void runAction('validate'); }}>
        Validate
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => { void runAction('approve'); }}>
        Approve
      </Button>
      <Button size="sm" disabled={isPending} onClick={() => { void runAction('import'); }}>
        <ArrowDownToLine className="mr-2 h-4 w-4" />
        Import
      </Button>
    </div>
  );
}
