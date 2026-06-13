'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingUatSession, useSignOffTestingUatSession, useTestingUatSessions } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingUatPage() {
  const sessions = useTestingUatSessions();
  const createSession = useCreateTestingUatSession();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sessionName: '', moduleName: '', sessionDate: '', participants: '', testScope: '' });

  if (sessions.isLoading) return <LoadingState />;
  if (sessions.isError) return <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="UAT unavailable" description={sessions.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="UAT Management" description="Plan UAT sessions, assign participants, capture outcomes, and block sign-off until critical bugs are resolved." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New UAT Session</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(sessions.data) ? sessions.data : []}
        columns={[
          { key: 'session_name', header: 'UAT Session' },
          { key: 'module_name', header: 'Module' },
          { key: 'session_date', header: 'Date' },
          { key: 'outcome', header: 'Outcome' },
          { key: 'sign_off_status', header: 'Sign-Off', render: (row) => <UatSignOffActions row={row} /> },
        ]}
        emptyState={<EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No UAT sessions" description="UAT planning and sign-off records will appear here." />}
      />
      <FormDrawer title="Create UAT Session" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.sessionName} onChange={(event) => setForm({ ...form, sessionName: event.target.value })} placeholder="Session name" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} placeholder="Module" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input type="date" value={form.sessionDate} onChange={(event) => setForm({ ...form, sessionDate: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })} placeholder="One participant per line: Name | Role" className="min-h-32 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.testScope} onChange={(event) => setForm({ ...form, testScope: event.target.value })} placeholder="Test scope" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => {
            const participants = form.participants.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
              const [participantName, participantRole] = line.split('|').map((part) => part.trim());
              return { participantName, participantRole: participantRole || 'Participant' };
            });
            await createSession.mutateAsync({ ...form, participants });
            setOpen(false);
            setForm({ sessionName: '', moduleName: '', sessionDate: '', participants: '', testScope: '' });
          }}>Save UAT Session</Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function UatSignOffActions({ row }: { row: Record<string, unknown> }) {
  const signOff = useSignOffTestingUatSession(String(row.id ?? ''));
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={String(row.sign_off_status ?? '')} />
      <Button size="sm" variant="outline" onClick={() => { void signOff.mutateAsync({ decision: 'SIGNED_OFF' }); }}>Sign Off</Button>
    </div>
  );
}
