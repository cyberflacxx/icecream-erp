'use client';

import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { TestingNav } from '@/components/testing/testing-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useCreateTestingTestCase, useTestingTestCases } from '@/hooks/testing/useTesting';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/lib/shared/permissions';

export default function TestingTestCasesPage() {
  const query = useTestingTestCases();
  const createCase = useCreateTestingTestCase();
  const canWrite = usePermission([PERMISSIONS.settings.manage, PERMISSIONS.finance.manage]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ moduleName: '', scenario: '', testSteps: '', expectedResult: '', priority: 'MEDIUM', assignedTesterName: '' });

  const rows = useMemo(() => {
    const data = Array.isArray(query.data) ? query.data : [];
    return data.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  }, [query.data, search]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Test cases unavailable" description={query.error.message} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Test Cases" description="Define scenarios, steps, expected results, and assigned testers for every major ERP workflow." status="partial" actions={<div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search test cases" className="rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" /><Button disabled={!canWrite} onClick={() => setOpen(true)}>New Test Case</Button></div>} />
      <TestingNav />
      <DataTable
        data={rows}
        columns={[
          { key: 'test_case_number', header: 'Test Case' },
          { key: 'module_name', header: 'Module' },
          { key: 'scenario', header: 'Scenario' },
          { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={String(row.priority ?? '')} /> },
          { key: 'assigned_tester_name', header: 'Assigned Tester' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '')} /> },
        ]}
        emptyState={<EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No test cases" description="Seeded and custom test cases will appear here." />}
      />
      <FormDrawer title="Create Test Case" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <input value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} placeholder="Module" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.scenario} onChange={(event) => setForm({ ...form, scenario: event.target.value })} placeholder="Scenario" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.testSteps} onChange={(event) => setForm({ ...form, testSteps: event.target.value })} placeholder="One step per line" className="min-h-32 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <textarea value={form.expectedResult} onChange={(event) => setForm({ ...form, expectedResult: event.target.value })} placeholder="Expected result" className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <input value={form.assignedTesterName} onChange={(event) => setForm({ ...form, assignedTesterName: event.target.value })} placeholder="Assigned tester" className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:border-darkBorder dark:bg-darkCard" />
          <Button onClick={async () => { await createCase.mutateAsync(form); setOpen(false); setForm({ moduleName: '', scenario: '', testSteps: '', expectedResult: '', priority: 'MEDIUM', assignedTesterName: '' }); }}>Save Test Case</Button>
        </div>
      </FormDrawer>
    </div>
  );
}
