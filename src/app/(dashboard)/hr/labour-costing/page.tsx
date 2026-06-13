import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function LabourCostingPage() {
  return (
    <HrResourcePage
      title="Labour Costing"
      description="Review labour allocations, overtime impact, overhead absorption, and cost-per-unit effect."
      endpoint="/api/hr/labour-costs"
      columns={[
        { key: 'batchNumber', label: 'Batch' },
        { key: 'department', label: 'Department' },
        { key: 'shift', label: 'Shift' },
        { key: 'hoursWorked', label: 'Hours' },
        { key: 'labourCost', label: 'Labour Cost' },
        { key: 'overheadAllocation', label: 'Overhead' },
        { key: 'costPerUnitImpact', label: 'Cost Per Unit' },
      ]}
    />
  );
}
