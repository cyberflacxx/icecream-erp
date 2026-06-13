export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] as const;
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'OFF_DUTY'] as const;
export const SHIFT_RECORD_STATUSES = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'APPROVED', 'VOIDED'] as const;
export const PAYROLL_RECORD_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'VOIDED'] as const;
export const LABOUR_RATE_TYPES = ['HOURLY', 'DAILY', 'SHIFT'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type LabourRateType = (typeof LABOUR_RATE_TYPES)[number];

type Primitive = string | number | boolean | null | undefined;

export interface ShiftWindowInput {
  start: string;
  end: string;
}

export interface ShiftScheduleOverlapInput {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  scheduleId?: string;
}

export interface EmployeeImportRow {
  employee_code?: Primitive;
  full_name?: Primitive;
  department?: Primitive;
  job_role?: Primitive;
  email?: Primitive;
  phone_number?: Primitive;
  branch_code?: Primitive;
  warehouse_code?: Primitive;
  hourly_rate?: Primitive;
  shift_rate?: Primitive;
  basic_rate?: Primitive;
  status?: Primitive;
  hire_date?: Primitive;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface EmployeeImportValidationResult {
  errors: ImportValidationError[];
  rows: Array<Record<string, Primitive>>;
}

function normalizeIsoDate(value: string) {
  return value.includes('T') ? value.slice(0, 10) : value;
}

function toNumber(value: Primitive, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeShiftName(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return 'DAY';
  if (normalized.startsWith('DAY')) return 'DAY';
  if (normalized.startsWith('NIGHT')) return 'NIGHT';
  return normalized;
}

function resolveDateTime(date: string, time: string) {
  return new Date(`${normalizeIsoDate(date)}T${time}:00`);
}

export function calculateHoursWorked(checkIn: string | Date, checkOut: string | Date) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let endValue = end.getTime();
  if (endValue < start.getTime()) {
    endValue += 24 * 60 * 60 * 1000;
  }

  return round((endValue - start.getTime()) / (1000 * 60 * 60));
}

export function calculateLateMinutes(clockIn: string | Date, shiftStart: string | Date) {
  const start = new Date(shiftStart);
  const actual = new Date(clockIn);
  if (Number.isNaN(start.getTime()) || Number.isNaN(actual.getTime())) return 0;
  return Math.max(0, Math.round((actual.getTime() - start.getTime()) / (1000 * 60)));
}

export function calculateOvertimeHours(hoursWorked: number, standardShiftHours = 8) {
  return round(Math.max(0, hoursWorked - standardShiftHours));
}

export function calculateLabourCost(hoursWorked: number, rate: number) {
  return round(Math.max(0, hoursWorked) * Math.max(0, rate));
}

export function calculateShiftLabourCost(rows: Array<{ hoursWorked: number; rate: number }>) {
  return round(rows.reduce((sum, row) => sum + calculateLabourCost(row.hoursWorked, row.rate), 0));
}

export function calculateProductivityPerEmployee(actualOutput: number, workerCount: number) {
  if (workerCount <= 0) return 0;
  return round(actualOutput / workerCount, 3);
}

export function calculateOperatorProductivity(operatorOutput: number, operatorHoursWorked: number) {
  if (operatorHoursWorked <= 0) return 0;
  return round(operatorOutput / operatorHoursWorked, 3);
}

export function calculateDepartmentProductivity(departmentOutput: number, departmentWorkerCount: number) {
  if (departmentWorkerCount <= 0) return 0;
  return round(departmentOutput / departmentWorkerCount, 3);
}

export function calculateEfficiencyPercentage(actualOutput: number, targetOutput: number) {
  if (targetOutput <= 0) return 0;
  return round((actualOutput / targetOutput) * 100, 2);
}

export function calculateLabourCostPerUnit(shiftLabourCost: number, acceptedOutput: number) {
  if (acceptedOutput <= 0) return 0;
  return round(shiftLabourCost / acceptedOutput, 4);
}

export function calculatePayrollAmounts(input: {
  basicPay: number;
  overtimePay?: number;
  allowances?: number;
  deductions?: number;
}) {
  const basicPay = Math.max(0, input.basicPay);
  const overtimePay = Math.max(0, input.overtimePay ?? 0);
  const allowances = Math.max(0, input.allowances ?? 0);
  const deductions = Math.max(0, input.deductions ?? 0);
  const grossPay = round(basicPay + overtimePay + allowances);
  const netPay = round(grossPay - deductions);

  return {
    allowances,
    basicPay,
    deductions,
    grossPay,
    netPay,
    overtimePay,
  };
}

export function detectShiftOverlap(
  schedules: ShiftScheduleOverlapInput[],
  candidate: ShiftScheduleOverlapInput,
) {
  const candidateStart = resolveDateTime(candidate.shiftDate, candidate.startTime);
  let candidateEnd = resolveDateTime(candidate.shiftDate, candidate.endTime);
  if (candidateEnd <= candidateStart) {
    candidateEnd = new Date(candidateEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  return schedules.some((schedule) => {
    if (schedule.employeeId !== candidate.employeeId) return false;
    if (schedule.scheduleId && candidate.scheduleId && schedule.scheduleId === candidate.scheduleId) return false;

    const scheduleStart = resolveDateTime(schedule.shiftDate, schedule.startTime);
    let scheduleEnd = resolveDateTime(schedule.shiftDate, schedule.endTime);
    if (scheduleEnd <= scheduleStart) {
      scheduleEnd = new Date(scheduleEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    return candidateStart < scheduleEnd && candidateEnd > scheduleStart;
  });
}

export function deriveAttendanceMetrics(input: {
  attendanceStatus?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  standardShiftHours?: number;
}) {
  const normalizedStatus = String(input.attendanceStatus ?? '').toUpperCase() as AttendanceStatus | '';
  const shiftStart = `${normalizeIsoDate(input.shiftDate)}T${input.shiftStartTime}:00`;
  let shiftEnd = `${normalizeIsoDate(input.shiftDate)}T${input.shiftEndTime}:00`;
  if (input.shiftEndTime <= input.shiftStartTime) {
    const nextDay = new Date(`${normalizeIsoDate(input.shiftDate)}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    shiftEnd = `${nextDay.toISOString().slice(0, 10)}T${input.shiftEndTime}:00`;
  }

  const hoursWorked = input.checkIn && input.checkOut
    ? calculateHoursWorked(input.checkIn, input.checkOut)
    : 0;
  const lateMinutes = input.checkIn ? calculateLateMinutes(input.checkIn, shiftStart) : 0;
  const overtimeHours = calculateOvertimeHours(hoursWorked, input.standardShiftHours ?? calculateHoursWorked(shiftStart, shiftEnd));

  return {
    hoursWorked,
    lateMinutes: normalizedStatus === 'ABSENT' || normalizedStatus === 'OFF_DUTY' ? 0 : lateMinutes,
    overtimeHours: normalizedStatus === 'ABSENT' || normalizedStatus === 'OFF_DUTY' ? 0 : overtimeHours,
  };
}

export function validateEmployeeImportRows(
  rows: EmployeeImportRow[],
  options: {
    existingCodes?: string[];
    validDepartments?: string[];
    validShiftNames?: string[];
  } = {},
): EmployeeImportValidationResult {
  const errors: ImportValidationError[] = [];
  const seenCodes = new Set((options.existingCodes ?? []).map((code) => code.trim().toUpperCase()));
  const departments = new Set((options.validDepartments ?? []).map((value) => value.trim().toUpperCase()));
  const shifts = new Set((options.validShiftNames ?? ['DAY', 'NIGHT']).map((value) => value.trim().toUpperCase()));

  const normalizedRows = rows.map((row, index) => {
    const employeeCode = String(row.employee_code ?? '').trim();
    const fullName = String(row.full_name ?? '').trim();
    const department = String(row.department ?? '').trim();
    const jobRole = String(row.job_role ?? '').trim();
    const status = String(row.status ?? 'ACTIVE').trim().toUpperCase();
    const hourlyRate = toNumber(row.hourly_rate, 0);
    const shiftRate = toNumber(row.shift_rate, 0);
    const basicRate = toNumber(row.basic_rate, 0);
    const shiftName = normalizeShiftName(String((row as Record<string, Primitive>).shift_name ?? 'DAY'));

    if (!employeeCode) errors.push({ row: index + 2, field: 'employee_code', message: 'Employee code is required.' });
    if (!fullName) errors.push({ row: index + 2, field: 'full_name', message: 'Full name is required.' });
    if (!department) {
      errors.push({ row: index + 2, field: 'department', message: 'Department is required.' });
    } else if (departments.size > 0 && !departments.has(department.toUpperCase())) {
      errors.push({ row: index + 2, field: 'department', message: `Unknown department: ${department}.` });
    }
    if (!jobRole) errors.push({ row: index + 2, field: 'job_role', message: 'Job role is required.' });
    if (employeeCode) {
      const key = employeeCode.toUpperCase();
      if (seenCodes.has(key)) {
        errors.push({ row: index + 2, field: 'employee_code', message: `Duplicate employee code: ${employeeCode}.` });
      }
      seenCodes.add(key);
    }
    if (hourlyRate < 0) errors.push({ row: index + 2, field: 'hourly_rate', message: 'Hourly rate cannot be negative.' });
    if (shiftRate < 0) errors.push({ row: index + 2, field: 'shift_rate', message: 'Shift rate cannot be negative.' });
    if (basicRate < 0) errors.push({ row: index + 2, field: 'basic_rate', message: 'Basic rate cannot be negative.' });
    if (shiftName && shifts.size > 0 && !shifts.has(shiftName)) {
      errors.push({ row: index + 2, field: 'shift_name', message: `Invalid shift name: ${shiftName}.` });
    }

    return {
      ...row,
      basic_rate: basicRate,
      department,
      employee_code: employeeCode,
      full_name: fullName,
      hourly_rate: hourlyRate,
      job_role: jobRole,
      shift_name: shiftName,
      shift_rate: shiftRate,
      status,
    };
  });

  return { errors, rows: normalizedRows };
}
