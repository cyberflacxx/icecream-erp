import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

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

test('employee transfer workflow updates assignment without creating duplicate employees', () => {
  const route = fs.readFileSync('src/app/api/hr/employee-transfers/route.ts', 'utf8');
  const approveRoute = fs.readFileSync('src/app/api/hr/employee-transfers/[id]/approve/route.ts', 'utf8');
  const completeRoute = fs.readFileSync('src/app/api/hr/employee-transfers/[id]/complete/route.ts', 'utf8');
  const page = fs.readFileSync('src/app/(dashboard)/hr/transfers/page.tsx', 'utf8');
  const hrPage = fs.readFileSync('src/app/(dashboard)/hr/page.tsx', 'utf8');
  const migration = fs.readFileSync('migrations/060_hr_employee_transfers.sql', 'utf8');

  assert.match(route, /from\('hr_employee_transfers'\)/);
  assert.match(route, /\.from\('employees'\)\s*[\s\S]*\.update\(updates\)/);
  assert.doesNotMatch(route, /\.from\('employees'\)\s*\r?\n\s*\.insert/);
  assert.match(route, /Employee already has a pending transfer/);
  assert.match(route, /Destination assignment must differ from the current assignment/);
  assert.match(route, /HR_EMPLOYEE_TRANSFER_CREATED/);
  assert.match(route, /can\(ctx, 'hr\.employee\.transfer', 'hr\.write'\)/);
  assert.match(route, /body\.completeNow === true \? 'COMPLETED' : 'PENDING'/);

  assert.match(approveRoute, /HR_EMPLOYEE_TRANSFER_APPROVED/);
  assert.match(approveRoute, /Only pending employee transfers can be approved/);
  assert.match(approveRoute, /\.eq\('status', 'PENDING'\)/);
  assert.match(completeRoute, /HR_EMPLOYEE_TRANSFER_COMPLETED/);
  assert.match(completeRoute, /\.from\('employees'\)\s*[\s\S]*\.update\(updates\)/);
  assert.doesNotMatch(completeRoute, /\.from\('employees'\)\s*\r?\n\s*\.insert/);
  assert.match(completeRoute, /\.in\('status', \['PENDING', 'APPROVED'\]\)/);

  assert.match(page, /\/api\/hr\/employee-transfers/);
  assert.match(page, /\/api\/hr\/employee-transfers\/\$\{transferId\}\/\$\{action\}/);
  assert.match(page, /Current assignment/);
  assert.match(page, /Approve/);
  assert.match(page, /Complete/);
  assert.match(page, /Destination Branch/);
  assert.match(page, /Destination Warehouse/);
  assert.match(page, /Effective Date/);
  assert.match(hrPage, /\/hr\/transfers/);

  assert.match(migration, /create table if not exists icecream_erp\.hr_employee_transfers/i);
  assert.match(migration, /hr_employee_transfers_one_pending_uq/i);
  assert.match(migration, /where status in \('PENDING', 'APPROVED'\)/i);
  assert.doesNotMatch(migration, /create table if not exists public\./i);
});
