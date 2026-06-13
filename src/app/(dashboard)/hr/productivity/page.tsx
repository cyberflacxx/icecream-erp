import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function ProductivityPage() {
  return (
    <HrResourcePage
      title="Productivity"
      description="Monitor output per worker, operator productivity, shift output, and efficiency indicators."
      endpoint="/api/hr/productivity"
      columns={[
        { key: 'employeeNumber', label: 'Employee Code' },
        { key: 'employeeName', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'batchNumber', label: 'Batch' },
        { key: 'shift', label: 'Shift' },
        { key: 'acceptedQuantity', label: 'Accepted Output' },
        { key: 'operatorProductivity', label: 'Productivity Rate' },
      ]}
    />
  );
}
