import { HrResourcePage } from '@/components/hr/hr-resource-page';

export default function AttendancePage() {
  return (
    <HrResourcePage
      title="Attendance"
      description="Track shift attendance, clock-in and clock-out times, lateness, and overtime."
      endpoint="/api/hr/attendance?pageSize=100"
      columns={[
        { key: 'attendance_date', label: 'Date' },
        { key: 'shift_name', label: 'Shift' },
        { key: 'employee', label: 'Employee' },
        { key: 'attendance_status', label: 'Status' },
        { key: 'hours_worked', label: 'Hours Worked' },
        { key: 'late_minutes', label: 'Late Minutes' },
        { key: 'overtime_hours', label: 'Overtime Hours' },
      ]}
    />
  );
}
