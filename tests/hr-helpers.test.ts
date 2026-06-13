import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateEfficiencyPercentage,
  calculateHoursWorked,
  calculateLabourCost,
  calculateLabourCostPerUnit,
  calculateLateMinutes,
  calculateOperatorProductivity,
  calculatePayrollAmounts,
  calculateProductivityPerEmployee,
  detectShiftOverlap,
  deriveAttendanceMetrics,
  validateEmployeeImportRows,
} from '../src/lib/hr';

test('hours worked handles same-day and overnight shifts', () => {
  assert.equal(calculateHoursWorked('2026-06-13T06:00:00Z', '2026-06-13T14:30:00Z'), 8.5);
  assert.equal(calculateHoursWorked('2026-06-13T18:00:00Z', '2026-06-13T06:00:00Z'), 12);
});

test('late minutes and overtime derive from shift windows', () => {
  const metrics = deriveAttendanceMetrics({
    attendanceStatus: 'LATE',
    checkIn: '2026-06-13T06:20:00',
    checkOut: '2026-06-13T18:30:00',
    shiftDate: '2026-06-13',
    shiftEndTime: '18:00',
    shiftStartTime: '06:00',
    standardShiftHours: 12,
  });

  assert.equal(calculateLateMinutes('2026-06-13T06:20:00', '2026-06-13T06:00:00'), 20);
  assert.equal(metrics.hoursWorked, 12.17);
  assert.equal(metrics.lateMinutes, 20);
  assert.equal(metrics.overtimeHours, 0.17);
});

test('productivity and labour cost calculations stay stable', () => {
  assert.equal(calculateProductivityPerEmployee(240, 8), 30);
  assert.equal(calculateOperatorProductivity(125, 10), 12.5);
  assert.equal(calculateLabourCost(12, 4.5), 54);
  assert.equal(calculateLabourCostPerUnit(540, 180), 3);
  assert.equal(calculateEfficiencyPercentage(180, 200), 90);
});

test('payroll gross and net pay derive from earnings and deductions', () => {
  assert.deepEqual(
    calculatePayrollAmounts({ basicPay: 600, overtimePay: 75, allowances: 25, deductions: 40 }),
    {
      allowances: 25,
      basicPay: 600,
      deductions: 40,
      grossPay: 700,
      netPay: 660,
      overtimePay: 75,
    },
  );
});

test('overlapping shift schedules are blocked', () => {
  const existing = [
    {
      employeeId: 'emp-1',
      endTime: '18:00',
      scheduleId: 'schedule-1',
      shiftDate: '2026-06-13',
      startTime: '06:00',
    },
  ];

  assert.equal(
    detectShiftOverlap(existing, {
      employeeId: 'emp-1',
      endTime: '20:00',
      shiftDate: '2026-06-13',
      startTime: '17:00',
    }),
    true,
  );
  assert.equal(
    detectShiftOverlap(existing, {
      employeeId: 'emp-1',
      endTime: '06:00',
      shiftDate: '2026-06-13',
      startTime: '18:00',
    }),
    false,
  );
});

test('employee import validation reports duplicate codes and bad departments', () => {
  const result = validateEmployeeImportRows(
    [
      { department: 'Production', employee_code: 'EMP-001', full_name: 'Tendai Moyo', job_role: 'Operator', hourly_rate: 4 },
      { department: 'Unknown', employee_code: 'EMP-001', full_name: '', job_role: '', hourly_rate: -1 },
    ],
    {
      existingCodes: ['EMP-000'],
      validDepartments: ['Production', 'Finance'],
      validShiftNames: ['DAY', 'NIGHT'],
    },
  );

  assert.equal(result.errors.length, 5);
  assert.equal(result.errors.some((error) => error.field === 'employee_code' && error.message.includes('Duplicate')), true);
  assert.equal(result.errors.some((error) => error.field === 'department' && error.message.includes('Unknown department')), true);
});
