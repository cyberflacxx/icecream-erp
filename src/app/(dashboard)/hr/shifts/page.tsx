import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function ShiftsPage() {
  return (
    <HrResourcePage
      title="Shift Schedules"
      description="Configure day and night shifts, review scheduled employees, and approve shift allocations."
      endpoint="/api/hr/shift-schedules"
      columns={[
        { key: 'shift_date', label: 'Date' },
        { key: 'shiftDefinition', label: 'Shift' },
        { key: 'department', label: 'Department' },
        { key: 'branch', label: 'Branch' },
        { key: 'employees', label: 'Assigned Employees' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
