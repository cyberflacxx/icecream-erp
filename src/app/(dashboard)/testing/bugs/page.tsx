'use client';

import { useState } from 'react';
import { Bug } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCloseTestingBug, useCreateTestingBug, useReopenTestingBug, useTestingBugs } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingBugsPage() {
  const bugs = useTestingBugs();
  const createBug = useCreateTestingBug();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ moduleName: '', title: '', description: '', priority: 'HIGH', severity: 'HIGH' });

  if (bugs.isLoading) return <LoadingState />;
  if (bugs.isError) return <EmptyState icon={<Bug className="h-6 w-6" />} title="Bug tracker unavailable" description={bugs.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Bug Tracker" description="Manage defects from failed tests through assignment, retesting, closure, and reopening." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New Bug</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(bugs.data) ? bugs.data : []}
        columns={[
          { key: 'bug_number', header: 'Bug' },
          { key: 'module_name', header: 'Module' },
          { key: 'title', header: 'Title' },
          { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={String(row.priority ?? '')} /> },
          { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={String(row.severity ?? '')} /> },
          { key: 'assigned_to_name', header: 'Assigned To' },
          { key: 'status', header: 'Status', render: (row) => <BugStatusActions row={row} /> },
        ]}
        emptyState={<EmptyState icon={<Bug className="h-6 w-6" />} title="No bugs" description="Defects raised from testing and UAT will appear here." />}
      />
      <FormDrawer title="Create Bug Report" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} placeholder="Module" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="min-h-32 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createBug.mutateAsync(form); setOpen(false); setForm({ moduleName: '', title: '', description: '', priority: 'HIGH', severity: 'HIGH' }); }}>Save Bug</Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function BugStatusActions({ row }: { row: Record<string, unknown> }) {
  const closeBug = useCloseTestingBug(String(row.id ?? ''));
  const reopenBug = useReopenTestingBug(String(row.id ?? ''));
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={String(row.status ?? '')} />
      <Button size="sm" variant="outline" onClick={() => { void closeBug.mutateAsync({ resolutionNotes: 'Closed from bug tracker.' }); }}>Close</Button>
      <Button size="sm" variant="outline" onClick={() => { void reopenBug.mutateAsync({ reopenReason: 'Reopened from bug tracker.' }); }}>Reopen</Button>
    </div>
  );
}
