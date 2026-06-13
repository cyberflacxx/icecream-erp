'use client';

import { useState } from 'react';
import { BookOpenText } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingDocumentation, useTestingDocumentation } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingDocumentationPage() {
  const docs = useTestingDocumentation();
  const createDoc = useCreateTestingDocumentation();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', documentType: 'User Manual', version: 'v1.0', moduleName: 'testing', content: '' });

  if (docs.isLoading) return <LoadingState />;
  if (docs.isError) return <EmptyState icon={<BookOpenText className="h-6 w-6" />} title="Documentation unavailable" description={docs.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Documentation" description="Version user manuals, admin guides, technical notes, and training content for handover readiness." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New Document</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(docs.data) ? docs.data : []}
        columns={[
          { key: 'title', header: 'Document Title' },
          { key: 'document_type', header: 'Type' },
          { key: 'version', header: 'Version' },
          { key: 'module_name', header: 'Module' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
          { key: 'last_updated_date', header: 'Last Updated' },
        ]}
        emptyState={<EmptyState icon={<BookOpenText className="h-6 w-6" />} title="No documents" description="Manuals, guides, and templates will appear here." />}
      />
      <FormDrawer title="Create Documentation Record" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="Version" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Content" className="min-h-40 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createDoc.mutateAsync(form); setOpen(false); setForm({ title: '', documentType: 'User Manual', version: 'v1.0', moduleName: 'testing', content: '' }); }}>Save Document</Button>
        </div>
      </FormDrawer>
    </div>
  );
}
