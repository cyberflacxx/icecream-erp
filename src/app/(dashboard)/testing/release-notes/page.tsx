'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingReleaseNote, useTestingReleaseNotes } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingReleaseNotesPage() {
  const notes = useTestingReleaseNotes();
  const createNote = useCreateTestingReleaseNote();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ releaseVersion: '', releaseDate: '', featuresAdded: '', bugsFixed: '', knownIssues: '', deploymentNotes: '' });

  if (notes.isLoading) return <LoadingState />;
  if (notes.isError) return <EmptyState icon={<FileText className="h-6 w-6" />} title="Release notes unavailable" description={notes.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Release Notes" description="Capture features added, bugs fixed, known issues, and deployment notes for each release candidate." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New Release Note</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(notes.data) ? notes.data : []}
        columns={[
          { key: 'release_version', header: 'Release Version' },
          { key: 'release_date', header: 'Release Date' },
          { key: 'features_added', header: 'Features' },
          { key: 'bugs_fixed', header: 'Bug Fixes' },
          { key: 'approval_status', header: 'Approval', render: (row) => <StatusBadge status={String(row.approval_status ?? '')} /> },
        ]}
        emptyState={<EmptyState icon={<FileText className="h-6 w-6" />} title="No release notes" description="Release notes for UAT and go-live will appear here." />}
      />
      <FormDrawer title="Create Release Note" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.releaseVersion} onChange={(event) => setForm({ ...form, releaseVersion: event.target.value })} placeholder="Release version" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input type="date" value={form.releaseDate} onChange={(event) => setForm({ ...form, releaseDate: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.featuresAdded} onChange={(event) => setForm({ ...form, featuresAdded: event.target.value })} placeholder="Features added" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.bugsFixed} onChange={(event) => setForm({ ...form, bugsFixed: event.target.value })} placeholder="Bugs fixed" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createNote.mutateAsync(form); setOpen(false); setForm({ releaseVersion: '', releaseDate: '', featuresAdded: '', bugsFixed: '', knownIssues: '', deploymentNotes: '' }); }}>Save Release Note</Button>
        </div>
      </FormDrawer>
    </div>
  );
}
