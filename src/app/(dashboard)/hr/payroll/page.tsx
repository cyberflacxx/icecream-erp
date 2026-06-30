import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function PayrollPage() {
  return (
    <HrResourcePage
      title="Payroll"
      description="Review payroll periods, generated payroll summaries, approvals, and posting status."
      endpoint="/api/hr/payroll?pageSize=100"
      columns={[
        { key: 'employee', label: 'Employee' },
        { key: 'period', label: 'Payroll Period' },
        { key: 'hours_worked', label: 'Hours Worked' },
        { key: 'pay_rate', label: 'Pay Rate' },
        { key: 'basic_pay', label: 'Basic Pay' },
        { key: 'overtime_pay', label: 'Overtime Pay' },
        { key: 'gross_pay', label: 'Gross Pay' },
        { key: 'net_pay', label: 'Net Pay' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
