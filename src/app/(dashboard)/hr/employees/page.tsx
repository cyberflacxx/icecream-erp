import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function EmployeesPage() {
  return (
    <HrResourcePage
      title="Employees"
      description="Manage employee records, departments, job roles, branches, rates, and status."
      endpoint="/api/hr/employees?pageSize=100"
      columns={[
        { key: 'employee_number', label: 'Employee Code' },
        { key: 'full_name', label: 'Full Name' },
        { key: 'department', label: 'Department' },
        { key: 'job_title', label: 'Job Role' },
        { key: 'status', label: 'Status' },
        { key: 'hire_date', label: 'Hire Date' },
      ]}
    />
  );
}
