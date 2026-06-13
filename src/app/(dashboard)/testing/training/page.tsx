'use client';

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingTrainingSession, useRecordTestingAttendance, useTestingTrainingSessions } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingTrainingPage() {
  const sessions = useTestingTrainingSessions();
  const createSession = useCreateTestingTrainingSession();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ trainingTitle: '', moduleName: '', trainerName: '', sessionDate: '' });

  if (sessions.isLoading) return <LoadingState />;
  if (sessions.isError) return <EmptyState icon={<GraduationCap className="h-6 w-6" />} title="Training data unavailable" description={sessions.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Training Management" description="Schedule training by module, record attendance by role, and track operational readiness before handover." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>New Training Session</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(sessions.data) ? sessions.data : []}
        columns={[
          { key: 'training_title', header: 'Training Title' },
          { key: 'module_name', header: 'Module' },
          { key: 'trainer_name', header: 'Trainer' },
          { key: 'session_date', header: 'Date' },
          { key: 'status', header: 'Status', render: (row) => <TrainingAttendanceActions row={row} /> },
        ]}
        emptyState={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No training sessions" description="Training schedules and attendance records will appear here." />}
      />
      <FormDrawer title="Create Training Session" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.trainingTitle} onChange={(event) => setForm({ ...form, trainingTitle: event.target.value })} placeholder="Training title" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} placeholder="Module" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.trainerName} onChange={(event) => setForm({ ...form, trainerName: event.target.value })} placeholder="Trainer" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input type="date" value={form.sessionDate} onChange={(event) => setForm({ ...form, sessionDate: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createSession.mutateAsync(form); setOpen(false); setForm({ trainingTitle: '', moduleName: '', trainerName: '', sessionDate: '' }); }}>Save Training Session</Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function TrainingAttendanceActions({ row }: { row: Record<string, unknown> }) {
  const attendance = useRecordTestingAttendance(String(row.id ?? ''));
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={String(row.status ?? '')} />
      <Button size="sm" variant="outline" onClick={() => { void attendance.mutateAsync({ attendees: [{ attendeeName: 'Sample Attendee', attendeeRole: 'User', attendanceStatus: 'PRESENT' }] }); }}>Mark Attendance</Button>
    </div>
  );
}
