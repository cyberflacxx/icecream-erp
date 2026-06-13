import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function HRReportsPage() {
  return (
    <HrResourcePage
      title="HR Reports"
      description="Employee, attendance, productivity, labour cost, overtime, and payroll summary reporting."
      endpoint="/api/hr/reports/productivity"
      columns={[
        { key: 'employeeNumber', label: 'Employee Code' },
        { key: 'employeeName', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'batchNumber', label: 'Batch' },
        { key: 'shift', label: 'Shift' },
        { key: 'acceptedQuantity', label: 'Output' },
        { key: 'operatorProductivity', label: 'Productivity' },
      ]}
    />
  );
}
