import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';
import { isMissingColumnOrRelation } from '@/app/api/hr/utils';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'payroll.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const employeeId = searchParams.get('employeeId') ?? '';
  const status = searchParams.get('status') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  const service = hrService();

  let query = service
    .from('hr_payroll_summaries')
    .select(
      'id, employee_id, payroll_period_id, basic_pay, overtime_pay, gross_pay, net_pay, status, created_at',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error && isMissingColumnOrRelation(error, 'hr_payroll_summaries')) {
    return NextResponse.json({
      data: [],
      pagination: { page, pageSize, total: 0 },
    });
  }

  if (error) return serverError(error.message);

  const employeeIds = Array.from(
    new Set((data ?? []).map((row: Record<string, unknown>) => String(row.employee_id ?? '')).filter(Boolean)),
  );
  const periodIds = Array.from(
    new Set((data ?? []).map((row: Record<string, unknown>) => String(row.payroll_period_id ?? '')).filter(Boolean)),
  );

  const [employeesRes, periodsRes] = await Promise.all([
    employeeIds.length > 0
      ? service.from('employees').select('id, first_name, last_name, full_name, employee_number, branch_id, department').in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
    periodIds.length > 0
      ? service.from('hr_payroll_periods').select('id, period_name, start_date, end_date').in('id', periodIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const employeeMap = new Map((employeesRes.data ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
  const periodMap = new Map((periodsRes.data ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
  const periodDates = (periodsRes.data ?? [])
    .map((row: Record<string, unknown>) => ({
      endDate: String(row.end_date ?? ''),
      startDate: String(row.start_date ?? ''),
    }))
    .filter((row) => row.startDate && row.endDate);
  const minStartDate = periodDates.map((row) => row.startDate).sort()[0];
  const maxEndDate = periodDates.map((row) => row.endDate).sort().at(-1);

  const [attendanceRes, contractsRes] = await Promise.all([
    employeeIds.length > 0 && minStartDate && maxEndDate
      ? service
          .from('hr_attendance_records')
          .select('employee_id, attendance_date, hours_worked, overtime_hours, approval_status')
          .in('employee_id', employeeIds)
          .gte('attendance_date', minStartDate)
          .lte('attendance_date', maxEndDate)
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length > 0
      ? service
          .from('hr_employee_contracts')
          .select('employee_id, basic_rate, hourly_rate, shift_rate, is_active')
          .in('employee_id', employeeIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const attendanceRows =
    attendanceRes.error && isMissingColumnOrRelation(attendanceRes.error, 'hr_attendance_records')
      ? []
      : attendanceRes.error
        ? null
        : (attendanceRes.data ?? []);
  const contractRows =
    contractsRes.error && isMissingColumnOrRelation(contractsRes.error, 'hr_employee_contracts')
      ? []
      : contractsRes.error
        ? null
        : (contractsRes.data ?? []);

  if (attendanceRows === null) return serverError(attendanceRes.error?.message ?? 'Failed to load payroll attendance.');
  if (contractRows === null) return serverError(contractsRes.error?.message ?? 'Failed to load payroll rates.');
  const safeAttendanceRows = attendanceRows;

  const contractByEmployee = new Map(
    contractRows.map((row: Record<string, unknown>) => [
      String(row.employee_id),
      {
        basicRate: Number(row.basic_rate ?? 0),
        hourlyRate: Number(row.hourly_rate ?? row.basic_rate ?? 0),
        shiftRate: Number(row.shift_rate ?? 0),
      },
    ]),
  );

  function summarizeAttendance(employeeId: string, periodId: string) {
    const period = periodMap.get(periodId);
    const startDate = String(period?.start_date ?? '');
    const endDate = String(period?.end_date ?? '');
    if (!startDate || !endDate) return { hoursWorked: 0, overtimeHours: 0 };

    return safeAttendanceRows
      .filter((row: Record<string, unknown>) => {
        const date = String(row.attendance_date ?? '');
        return String(row.employee_id) === employeeId && date >= startDate && date <= endDate;
      })
      .reduce(
        (sum, row: Record<string, unknown>) => ({
          hoursWorked: sum.hoursWorked + Number(row.hours_worked ?? 0),
          overtimeHours: sum.overtimeHours + Number(row.overtime_hours ?? 0),
        }),
        { hoursWorked: 0, overtimeHours: 0 },
      );
  }

  const enriched = (data ?? []).map((row: Record<string, unknown>) => {
    const employeeIdValue = String(row.employee_id ?? '');
    const periodIdValue = String(row.payroll_period_id ?? '');
    const attendance = summarizeAttendance(employeeIdValue, periodIdValue);
    const contract = contractByEmployee.get(employeeIdValue);
    return {
      ...row,
      employee: employeeMap.get(employeeIdValue) ?? null,
      hours_worked: attendance.hoursWorked,
      overtime_hours: attendance.overtimeHours,
      pay_rate: contract?.hourlyRate ?? contract?.basicRate ?? 0,
      period: periodMap.get(periodIdValue) ?? null,
      rate_type: contract?.hourlyRate ? 'HOURLY' : 'BASIC',
    };
  });

  const filtered = enriched.filter((row: Record<string, unknown>) => {
    const employee = row.employee as Record<string, unknown> | null;
    if (ctx.isBranchScoped) return String(employee?.branch_id ?? '') === ctx.branchId;
    if (branchId) return String(employee?.branch_id ?? '') === branchId;
    return true;
  });

  return NextResponse.json({
    data: filtered,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  const body = await request.json() as {
    employee_id: string;
    payroll_period_id?: string;
    basic_pay?: number;
    basic_salary?: number;
    overtime_pay?: number;
    allowances?: number;
    deductions?: number;
    gross_pay?: number;
    net_pay?: number;
  };

  if (!body.employee_id || !body.payroll_period_id) {
    return badRequest('employee_id and payroll_period_id are required.');
  }

  const allowances = Number(body.allowances ?? 0);
  const deductions = Number(body.deductions ?? 0);
  const basicPay = Number(body.basic_pay ?? body.basic_salary ?? 0);
  const overtimePay = Number(body.overtime_pay ?? 0);
  const grossPay = Number(body.gross_pay ?? basicPay + overtimePay + allowances);
  const netPay = Number(body.net_pay ?? grossPay - deductions);
  if (netPay < 0) return badRequest('Net pay cannot be negative.');

  const service = hrService();
  const { data, error } = await service
    .from('hr_payroll_summaries')
    .insert({
      allowances,
      basic_pay: basicPay,
      created_by: ctx.userId,
      deductions,
      employee_id: body.employee_id,
      gross_pay: grossPay,
      net_pay: netPay,
      organization_id: ctx.organizationId,
      overtime_pay: overtimePay,
      payroll_period_id: body.payroll_period_id,
      status: 'DRAFT',
      updated_by: ctx.userId,
    })
    .select()
    .single();

  if (error && isMissingColumnOrRelation(error, 'hr_payroll_summaries')) {
    return serverError('Payroll tables are not available in the current database schema yet.');
  }
  if (error) return serverError(error.message);

  await writeHrAuditLog('HR_PAYROLL_SUMMARY_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'payroll_summary');
  return NextResponse.json(data, { status: 201 });
}
