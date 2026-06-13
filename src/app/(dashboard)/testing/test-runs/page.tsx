'use client';

import { useState } from 'react';
import { PlaySquare } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingTestRun, useTestingTestCases, useTestingTestRuns } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingTestRunsPage() {
  const runs = useTestingTestRuns();
  const cases = useTestingTestCases();
  const createRun = useCreateTestingTestRun();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ testCaseId: '', testerName: '', actualResult: '', status: 'PASSED', comments: '' });

  if (runs.isLoading || cases.isLoading) return <LoadingState />;
  if (runs.isError) return <EmptyState icon={<PlaySquare className="h-6 w-6" />} title="Test runs unavailable" description={runs.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Test Runs" description="Execute assigned tests, capture actual outcomes, and create bugs directly from failed runs." status="partial" actions={<Button disabled={!canWrite} onClick={() => setOpen(true)}>Record Test Run</Button>} />
      <TestingNav />
      <DataTable
        data={Array.isArray(runs.data) ? runs.data : []}
        columns={[
          { key: 'test_case_id', header: 'Test Case' },
          { key: 'tester_name', header: 'Tester' },
          { key: 'test_date', header: 'Date' },
          { key: 'status', header: 'Result', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
          { key: 'comments', header: 'Comments' },
        ]}
        emptyState={<EmptyState icon={<PlaySquare className="h-6 w-6" />} title="No test runs" description="Run execution history will appear here." />}
      />
      <FormDrawer title="Record Test Run" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <select value={form.testCaseId} onChange={(event) => setForm({ ...form, testCaseId: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard">
            <option value="">Select test case</option>
            {(cases.data ?? []).map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.test_case_number)} - {String(row.scenario)}</option>)}
          </select>
          <input value={form.testerName} onChange={(event) => setForm({ ...form, testerName: event.target.value })} placeholder="Tester name" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard">
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="RETEST_REQUIRED">RETEST_REQUIRED</option>
          </select>
          <textarea value={form.actualResult} onChange={(event) => setForm({ ...form, actualResult: event.target.value })} placeholder="Actual result" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} placeholder="Comments" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createRun.mutateAsync(form); setOpen(false); setForm({ testCaseId: '', testerName: '', actualResult: '', status: 'PASSED', comments: '' }); }}>Save Test Run</Button>
        </div>
      </FormDrawer>
    </div>
  );
}
