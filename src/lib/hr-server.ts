import {
  calculateDepartmentProductivity,
  calculateEfficiencyPercentage,
  calculateLabourCost,
  calculateLabourCostPerUnit,
  calculateOperatorProductivity,
  calculatePayrollAmounts,
  calculateProductivityPerEmployee,
  deriveAttendanceMetrics,
  normalizeShiftName,
  round,
} from '@/lib/hr';
import { createServiceRoleClient } from '@/lib/supabase/server';

export function hrService() {
  return createServiceRoleClient().schema('icecream_erp');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function isMissingColumnOrRelation(error: unknown, token: string) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes(`column ${token.toLowerCase()} does not exist`) ||
    message.includes(`relation "${token.toLowerCase()}" does not exist`) ||
    message.includes(`could not find the table 'icecream_erp.${token.toLowerCase()}'`)
  );
}

export async function writeHrAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'hr_record',
) {
  const service = hrService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function ensureEmployeeAssignable(employeeId: string) {
  const service = hrService();
  const { data, error } = await service
    .from('employees')
    .select('id, status, branch_id, department, job_title, employee_number, first_name, last_name')
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Employee not found.');
  if (String(data.status ?? '').toUpperCase() !== 'ACTIVE') {
    throw new Error('Inactive employees cannot be assigned to active shifts.');
  }

  return data;
}

export async function getReferenceCount(table: string) {
  const service = hrService();
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function generateReference(prefix: string, table: string) {
  const count = await getReferenceCount(table);
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
}

export async function fetchShiftDefinitionMap() {
  const service = hrService();
  const { data, error } = await service
    .from('hr_shift_definitions')
    .select('id, shift_name, start_time, end_time, standard_shift_hours, default_department_id, is_active');
  if (error) throw error;

  return new Map((data ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
}

export async function fetchDepartmentMap(organizationId: string) {
  const service = hrService();
  const { data, error } = await service
    .from('departments')
    .select('id, code, name, is_active')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);
  if (error) throw error;
  return new Map((data ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
}

export async function computeAttendancePayload(input: {
  attendanceStatus?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftDate: string;
  shiftDefinitionId?: string | null;
  shiftName?: string | null;
}) {
  const shiftMap = await fetchShiftDefinitionMap();
  const shiftDefinition = input.shiftDefinitionId ? shiftMap.get(input.shiftDefinitionId) : undefined;
  const shiftStart = String(shiftDefinition?.start_time ?? (normalizeShiftName(input.shiftName) === 'NIGHT' ? '18:00' : '06:00'));
  const shiftEnd = String(shiftDefinition?.end_time ?? (normalizeShiftName(input.shiftName) === 'NIGHT' ? '06:00' : '18:00'));
  const standardShiftHours = Number(shiftDefinition?.standard_shift_hours ?? 12);

  return deriveAttendanceMetrics({
    attendanceStatus: input.attendanceStatus,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    shiftDate: input.shiftDate,
    shiftEndTime: shiftEnd,
    shiftStartTime: shiftStart,
    standardShiftHours,
  });
}

export async function fetchHRDashboardMetrics(filters: {
  branchId?: string | null;
  isBranchScoped?: boolean;
  organizationId: string;
}) {
  const service = hrService();
  const today = new Date().toISOString().slice(0, 10);

  const buildEmployeeQuery = () => {
    let query = service
      .from('employees')
      .select('id, status, department, branch_id')
      .eq('organization_id', filters.organizationId);
    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    return query;
  };

  const employeesPrimary = await buildEmployeeQuery().is('deleted_at', null);
  const employeesRes =
    employeesPrimary.error && isMissingColumnOrRelation(employeesPrimary.error, 'employees.deleted_at')
      ? await buildEmployeeQuery()
      : employeesPrimary;
  if (employeesRes.error) throw employeesRes.error;

  async function optionalRows(
    queryFactory: () => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: unknown }>,
    missingToken: string,
  ) {
    const result = await queryFactory();
    if (result.error) {
      if (isMissingColumnOrRelation(result.error, missingToken)) {
        return [] as Array<Record<string, unknown>>;
      }
      throw result.error;
    }
    return (result.data ?? []) as Array<Record<string, unknown>>;
  }

  const [attendance, schedules, overtime, payrollPeriods] = await Promise.all([
    optionalRows(
      () =>
        service
          .from('hr_attendance_records')
          .select('id, attendance_status, branch_id')
          .eq('organization_id', filters.organizationId)
          .eq('attendance_date', today),
      'hr_attendance_records',
    ),
    optionalRows(
      () =>
        service
          .from('hr_shift_schedules')
          .select('id, status, branch_id')
          .eq('organization_id', filters.organizationId)
          .eq('shift_date', today),
      'hr_shift_schedules',
    ),
    optionalRows(
      () =>
        service
          .from('hr_overtime_records')
          .select('id, status, branch_id')
          .eq('organization_id', filters.organizationId),
      'hr_overtime_records',
    ),
    optionalRows(
      () =>
        service
          .from('hr_payroll_periods')
          .select('id, status')
          .eq('organization_id', filters.organizationId),
      'hr_payroll_periods',
    ),
  ]);

  const employees = (employeesRes.data ?? []) as Array<Record<string, unknown>>;

  return {
    absentEmployees: attendance.filter((row) => String(row.attendance_status ?? '') === 'ABSENT').length,
    activeEmployees: employees.filter((row) => String(row.status ?? '') === 'ACTIVE').length,
    activeShifts: schedules.filter((row) => ['SCHEDULED', 'OPEN'].includes(String(row.status ?? ''))).length,
    employeesByDepartment: Object.entries(
      employees.reduce<Record<string, number>>((acc, row) => {
        const key = String(row.department ?? 'Unassigned');
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([department, count]) => ({ count, department })),
    lateEmployees: attendance.filter((row) => String(row.attendance_status ?? '') === 'LATE').length,
    overtimePendingApproval: overtime.filter((row) => String(row.status ?? '') === 'PENDING_APPROVAL').length,
    payrollPendingApproval: payrollPeriods.filter((row) => String(row.status ?? '') === 'PENDING_APPROVAL').length,
    todayAttendance: attendance.length,
    totalEmployees: employees.length,
  };
}

export async function fetchProductivityRows(filters: {
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
}) {
  const service = hrService();
  let query = service
    .from('hr_production_worker_outputs')
    .select(`
      id, batch_id, employee_id, schedule_id, shift_name, accepted_quantity, rejected_quantity, hours_worked_snapshot,
      quantity_produced, created_at,
      employee:employees(id, employee_number, first_name, last_name, department, branch_id),
      batch:production_batches(id, batch_number, shift, planned_date, actual_qty, warehouse_id, recipes(name), warehouses(branch_id, name)),
      product:items(id, code, name)
    `)
    .order('created_at', { ascending: false });

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    if (isMissingColumnOrRelation(error, 'hr_production_worker_outputs')) {
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => {
      const employee = row.employee as Record<string, unknown> | null;
      const batch = row.batch as Record<string, unknown> | null;
      const warehouses = batch?.warehouses as Record<string, unknown> | undefined;
      if (filters.branchId && String(employee?.branch_id ?? warehouses?.branch_id ?? '') !== filters.branchId) return false;
      if (filters.departmentId && String(employee?.department ?? '') !== filters.departmentId) return false;
      return true;
    })
    .map((row: Record<string, unknown>) => {
      const employee = row.employee as Record<string, unknown> | null;
      const batch = row.batch as Record<string, unknown> | null;
      const product = row.product as Record<string, unknown> | null;
      const recipe = (batch?.recipes ?? null) as Record<string, unknown> | null;
      const output = Number(row.accepted_quantity ?? row.quantity_produced ?? 0);
      const rejected = Number(row.rejected_quantity ?? 0);
      const hoursWorked = Number(row.hours_worked_snapshot ?? 0);
      return {
        acceptedQuantity: output,
        batchId: String(row.batch_id ?? ''),
        batchNumber: String(batch?.batch_number ?? ''),
        department: String(employee?.department ?? ''),
        employeeId: String(row.employee_id ?? ''),
        employeeName: [employee?.first_name, employee?.last_name].filter(Boolean).join(' '),
        employeeNumber: String(employee?.employee_number ?? ''),
        efficiency: calculateOperatorProductivity(output, hoursWorked),
        hoursWorked,
        operatorProductivity: calculateOperatorProductivity(output, hoursWorked),
        productName: String(product?.name ?? recipe?.name ?? ''),
        quantityProduced: Number(row.quantity_produced ?? 0),
        rejectedQuantity: rejected,
        shift: String(row.shift_name ?? batch?.shift ?? ''),
      };
    });
}

export async function fetchLabourCostRows(filters: {
  batchId?: string | null;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  departmentId?: string | null;
}) {
  const service = hrService();
  let query = service
    .from('hr_labour_cost_allocations')
    .select(`
      id, batch_id, employee_id, schedule_id, department_id, branch_id, shift_name, rate_type, rate, hours_worked,
      labour_cost, overhead_allocation, total_cost, approval_status, created_at,
      batch:production_batches(id, batch_number, actual_output, shift, production_date, warehouses(branch_id, name)),
      employee:employees(id, employee_number, first_name, last_name, department),
      department:departments(id, name)
    `)
    .order('created_at', { ascending: false });

  if (filters.batchId) query = query.eq('batch_id', filters.batchId);
  if (filters.branchId) query = query.eq('branch_id', filters.branchId);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const batch = row.batch as Record<string, unknown> | null;
    const employee = row.employee as Record<string, unknown> | null;
    const department = row.department as Record<string, unknown> | null;
    const labourCost = Number(row.labour_cost ?? 0);
    const overheadAllocation = Number(row.overhead_allocation ?? 0);
    const totalCost = Number(row.total_cost ?? labourCost + overheadAllocation);
    const acceptedOutput = Number(batch?.actual_output ?? 0);
    return {
      approvalStatus: String(row.approval_status ?? ''),
      batchId: String(row.batch_id ?? ''),
      batchNumber: String(batch?.batch_number ?? ''),
      costPerUnitImpact: calculateLabourCostPerUnit(totalCost, acceptedOutput),
      department: String(department?.name ?? employee?.department ?? ''),
      employeeName: [employee?.first_name, employee?.last_name].filter(Boolean).join(' '),
      hoursWorked: Number(row.hours_worked ?? 0),
      labourCost,
      overheadAllocation,
      rate: Number(row.rate ?? 0),
      rateType: String(row.rate_type ?? ''),
      shift: String(row.shift_name ?? batch?.shift ?? ''),
      totalCost,
      workers: employee ? 1 : Number(row.worker_count ?? 0),
    };
  });
}

export async function buildPayrollSummaryRows(periodId: string) {
  const service = hrService();
  const { data: period, error: periodError } = await service
    .from('hr_payroll_periods')
    .select('*')
    .eq('id', periodId)
    .single();
  if (periodError) throw periodError;

  const { data: employees, error: employeeError } = await service
    .from('employees')
    .select('id, employee_number, first_name, last_name, department, branch_id')
    .eq('organization_id', String(period.organization_id))
    .eq('status', 'ACTIVE')
    .is('deleted_at', null);
  if (employeeError) throw employeeError;

  const { data: attendanceRows, error: attendanceError } = await service
    .from('hr_attendance_records')
    .select('employee_id, hours_worked, overtime_hours')
    .gte('attendance_date', String(period.start_date))
    .lte('attendance_date', String(period.end_date))
    .eq('approval_status', 'APPROVED');
  if (attendanceError) throw attendanceError;

  const { data: employeeRates, error: rateError } = await service
    .from('hr_employee_contracts')
    .select('employee_id, basic_rate, hourly_rate, shift_rate')
    .eq('is_active', true);
  if (rateError) throw rateError;

  const attendanceByEmployee = new Map<string, { hours: number; overtime: number }>();
  for (const row of attendanceRows ?? []) {
    const key = String(row.employee_id);
    const current = attendanceByEmployee.get(key) ?? { hours: 0, overtime: 0 };
    current.hours += Number(row.hours_worked ?? 0);
    current.overtime += Number(row.overtime_hours ?? 0);
    attendanceByEmployee.set(key, current);
  }

  const ratesByEmployee = new Map<string, Record<string, unknown>>();
  for (const row of employeeRates ?? []) {
    ratesByEmployee.set(String(row.employee_id), row as Record<string, unknown>);
  }

  return (employees ?? []).map((employee: Record<string, unknown>) => {
    const attendance = attendanceByEmployee.get(String(employee.id)) ?? { hours: 0, overtime: 0 };
    const rates = ratesByEmployee.get(String(employee.id)) ?? {};
    const basicRate = Number(rates.basic_rate ?? 0);
    const hourlyRate = Number(rates.hourly_rate ?? basicRate);
    const overtimePay = round(attendance.overtime * hourlyRate);
    const payroll = calculatePayrollAmounts({
      allowances: 0,
      basicPay: basicRate,
      deductions: 0,
      overtimePay,
    });

    return {
      allowances: payroll.allowances,
      basicPay: payroll.basicPay,
      deductions: payroll.deductions,
      employeeId: String(employee.id),
      employeeName: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
      employeeNumber: String(employee.employee_number ?? ''),
      grossPay: payroll.grossPay,
      hoursWorked: attendance.hours,
      netPay: payroll.netPay,
      overtimeHours: attendance.overtime,
      overtimePay: payroll.overtimePay,
      payRate: hourlyRate,
    };
  });
}

export async function createLabourCostAllocation(input: {
  approvalStatus?: string;
  batchId: string;
  branchId?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  hoursWorked: number;
  overheadAllocation?: number;
  rate: number;
  rateType: string;
  scheduleId?: string | null;
  shiftName?: string | null;
}) {
  const service = hrService();
  const labourCost = calculateLabourCost(input.hoursWorked, input.rate);
  const overheadAllocation = round(Math.max(0, input.overheadAllocation ?? 0));
  const totalCost = round(labourCost + overheadAllocation);

  const { data, error } = await service
    .from('hr_labour_cost_allocations')
    .insert({
      approval_status: input.approvalStatus ?? 'DRAFT',
      batch_id: input.batchId,
      branch_id: input.branchId ?? null,
      department_id: input.departmentId ?? null,
      employee_id: input.employeeId ?? null,
      hours_worked: input.hoursWorked,
      labour_cost: labourCost,
      overhead_allocation: overheadAllocation,
      rate: input.rate,
      rate_type: input.rateType,
      schedule_id: input.scheduleId ?? null,
      shift_name: normalizeShiftName(input.shiftName),
      total_cost: totalCost,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function summarizeDepartmentProductivity(rows: Array<{
  acceptedQuantity: number;
  department: string;
  employeeId: string;
}>) {
  const groups = new Map<string, { output: number; employees: Set<string> }>();
  for (const row of rows) {
    const current = groups.get(row.department) ?? { output: 0, employees: new Set<string>() };
    current.output += row.acceptedQuantity;
    current.employees.add(row.employeeId);
    groups.set(row.department, current);
  }

  return Array.from(groups.entries()).map(([department, current]) => ({
    department,
    departmentProductivity: calculateDepartmentProductivity(current.output, current.employees.size),
    output: current.output,
    workerCount: current.employees.size,
  }));
}

export function summarizeOperatorProductivity(rows: Array<{
  acceptedQuantity: number;
  employeeId: string;
  employeeName: string;
  hoursWorked: number;
}>) {
  return rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    hoursWorked: row.hoursWorked,
    operatorProductivity: calculateOperatorProductivity(row.acceptedQuantity, row.hoursWorked),
    output: row.acceptedQuantity,
  }));
}

export function summarizeShiftPerformance(input: {
  actualOutput: number;
  labourCost: number;
  targetOutput: number;
}) {
  return {
    efficiencyPercentage: calculateEfficiencyPercentage(input.actualOutput, input.targetOutput),
    labourCostPerUnit: calculateLabourCostPerUnit(input.labourCost, input.actualOutput),
  };
}
