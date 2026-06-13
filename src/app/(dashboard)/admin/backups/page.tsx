'use client';

import { HardDriveDownload } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatCard, StatusBadge } from '@/components/ui-library';
import { useBackups, useCreateRestoreTest, useRunBackup } from '@/hooks/admin/useAdminReadiness';

export default function AdminBackupsPage() {
  const query = useBackups();
  const runBackup = useRunBackup();
  const restoreTest = useCreateRestoreTest();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <EmptyState icon={<HardDriveDownload className="h-6 w-6" />} title="Backup management unavailable" description={query.error?.message ?? 'Failed to load backup data.'} />;

  const logs = Array.isArray(query.data.logs) ? query.data.logs as Array<Record<string, unknown>> : [];
  const restoreTests = Array.isArray(query.data.restoreTests) ? query.data.restoreTests as Array<Record<string, unknown>> : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Backup Management" description="Track manual backup runs, view backup history, and record restore test readiness." status="partial" actions={<div className="flex gap-2"><Button variant="outline" onClick={() => restoreTest.mutate({ result: 'SUCCESS', remarks: 'Manual restore test recorded.' })}>Record Restore Test</Button><Button onClick={() => runBackup.mutate({ backupType: 'MANUAL', backupLocation: 'manual://backup' })}>Run Backup</Button></div>} />
      <AdminNav />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Backup Logs" value={String(logs.length)} icon={<HardDriveDownload className="h-5 w-5" />} />
        <StatCard title="Restore Tests" value={String(restoreTests.length)} icon={<HardDriveDownload className="h-5 w-5" />} color="warning" />
        <StatCard title="Last Status" value={String(logs[0]?.status ?? 'NONE')} icon={<HardDriveDownload className="h-5 w-5" />} color="success" />
      </div>
      <DataTable data={logs} columns={[{ key: 'backup_type', header: 'Type' }, { key: 'started_at', header: 'Started' }, { key: 'completed_at', header: 'Completed' }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> }, { key: 'file_reference', header: 'Reference' }]} emptyState={<EmptyState icon={<HardDriveDownload className="h-6 w-6" />} title="No backup logs" description="Manual backup requests and backup automation logs will appear here." />} />
    </div>
  );
}
