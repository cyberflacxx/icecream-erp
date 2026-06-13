'use client';

import { ShieldAlert } from 'lucide-react';

import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useDataIntegrity, useResolveDataIntegrityIssue, useRunDataIntegrityCheck } from '@/hooks/admin/useAdminReadiness';

export default function AdminDataIntegrityPage() {
  const query = useDataIntegrity();
  const runCheck = useRunDataIntegrityCheck();
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="Integrity checks unavailable" description={query.error?.message ?? 'Failed to load integrity issues.'} />;
  const rows = Array.isArray(query.data) ? query.data : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Data Integrity" description="Detect deployment blockers such as negative stock, unbalanced journals, missing roles, and duplicate document numbers." status="partial" actions={<Button onClick={() => runCheck.mutate({})}>Run Integrity Check</Button>} />
      <AdminNav />
      <DataTable
        data={rows}
        columns={[
          { key: 'issue_type', header: 'Issue' },
          { key: 'affected_module', header: 'Module' },
          { key: 'affected_table', header: 'Table' },
          { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={String(row.severity ?? '')} /> },
          { key: 'resolution_status', header: 'Status', render: (row) => <StatusBadge status={String(row.resolution_status ?? '')} /> },
          { key: 'actions', header: 'Actions', render: (row) => <ResolveIssueButton id={String(row.id ?? '')} /> },
        ]}
        emptyState={<EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No integrity issues" description="Run the integrity checker to evaluate deployment data quality." />}
      />
    </div>
  );
}

function ResolveIssueButton({ id }: { id: string }) {
  const resolve = useResolveDataIntegrityIssue(id);
  return <Button size="sm" variant="outline" onClick={() => resolve.mutate({})}>Resolve</Button>;
}
