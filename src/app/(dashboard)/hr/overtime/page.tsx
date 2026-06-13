import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function OvertimePage() {
  return (
    <HrResourcePage
      title="Overtime"
      description="Track overtime requests, approval status, reasons, and payroll impact."
      endpoint="/api/hr/overtime"
      columns={[
        { key: 'overtime_date', label: 'Date' },
        { key: 'employee', label: 'Employee' },
        { key: 'shift_name', label: 'Shift' },
        { key: 'overtime_hours', label: 'Hours' },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
