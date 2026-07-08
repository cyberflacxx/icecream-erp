'use client';

import { useState } from 'react';
import { Handshake } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useApproveTestingHandoverItem, useCreateTestingHandoverItem, useTestingHandoverChecklist } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingHandoverPage() {
  const checklist = useTestingHandoverChecklist();
  const createItem = useCreateTestingHandoverItem();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', task: '', ownerName: '', isCritical: true });

  if (checklist.isLoading) return <LoadingState />;
  if (checklist.isError) return <EmptyState icon={<Handshake className="h-6 w-6" />} title="Handover checklist unavailable" description={checklist.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Handover Checklist" description="Track critical completion items, block approval on unresolved blockers, and capture final handover approvals." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New Checklist Item</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(checklist.data) ? checklist.data : []}
        columns={[
          { key: 'category', header: 'Category' },
          { key: 'task', header: 'Task' },
          { key: 'owner_name', header: 'Owner' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
          { key: 'remarks', header: 'Remarks' },
          { key: 'approval_status', header: 'Approval', render: (row) => <HandoverApproveAction row={row} /> },
        ]}
        emptyState={<EmptyState icon={<Handshake className="h-6 w-6" />} title="No handover checklist items" description="Go-live handover tasks will appear here." />}
      />
      <FormDrawer title="Create Handover Checklist Item" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })} placeholder="Task" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} placeholder="Owner" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createItem.mutateAsync(form); setOpen(false); setForm({ category: '', task: '', ownerName: '', isCritical: true }); }}>Save Checklist Item</Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function HandoverApproveAction({ row }: { row: Record<string, unknown> }) {
  const approve = useApproveTestingHandoverItem(String(row.id ?? ''));
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={String(row.approval_status ?? '')} />
      <Button size="sm" variant="success" onClick={() => { void approve.mutateAsync({ decision: 'APPROVED' }); }}>Approve</Button>
    </div>
  );
}
