import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  fetchLabourCostRows,
  fetchProductivityRows,
  hrService,
  summarizeDepartmentProductivity,
  summarizeOperatorProductivity,
} from '@/lib/hr-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportType: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'reports.read')) return forbidden();

  try {
    const { reportType } = await params;
    const { searchParams } = new URL(request.url);
    const branchId = ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null);
    const service = hrService();

    switch (reportType) {
      case 'employees': {
        const { data, error } = await service
          .from('employees')
          .select('employee_number, full_name, first_name, last_name, department, job_title, branch_id, status, hire_date')
          .eq('organization_id', ctx.organizationId)
          .is('deleted_at', null)
          .order('employee_number');
        if (error) throw error;
        return NextResponse.json((data ?? []).filter((row: Record<string, unknown>) => !branchId || String(row.branch_id ?? '') === branchId));
      }
      case 'attendance':
      case 'day-shift':
      case 'night-shift':
      case 'shifts':
      case 'absenteeism':
      case 'late-coming': {
        let query = service
          .from('hr_attendance_records')
          .select('*, employee:employees(employee_number, first_name, last_name, department, branch_id)')
          .eq('organization_id', ctx.organizationId)
          .order('attendance_date', { ascending: false });
        if (branchId) query = query.eq('branch_id', branchId);
        if (searchParams.get('dateFrom')) query = query.gte('attendance_date', searchParams.get('dateFrom')!);
        if (searchParams.get('dateTo')) query = query.lte('attendance_date', searchParams.get('dateTo')!);
        if (reportType === 'day-shift') query = query.eq('shift_name', 'DAY');
        if (reportType === 'night-shift') query = query.eq('shift_name', 'NIGHT');
        if (reportType === 'absenteeism') query = query.eq('attendance_status', 'ABSENT');
        if (reportType === 'late-coming') query = query.eq('attendance_status', 'LATE');
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }
      case 'overtime': {
        const { data, error } = await service
          .from('hr_overtime_records')
          .select('*, employee:employees(employee_number, first_name, last_name, department, branch_id)')
          .eq('organization_id', ctx.organizationId)
          .order('overtime_date', { ascending: false });
        if (error) throw error;
        return NextResponse.json((data ?? []).filter((row: Record<string, unknown>) => !branchId || String(row.branch_id ?? '') === branchId));
      }
      case 'productivity': {
        return NextResponse.json(await fetchProductivityRows({
          branchId,
          dateFrom: searchParams.get('dateFrom'),
          dateTo: searchParams.get('dateTo'),
          departmentId: searchParams.get('departmentId'),
          employeeId: searchParams.get('employeeId'),
        }));
      }
      case 'department-productivity': {
        const rows = await fetchProductivityRows({
          branchId,
          dateFrom: searchParams.get('dateFrom'),
          dateTo: searchParams.get('dateTo'),
          departmentId: searchParams.get('departmentId'),
        });
        return NextResponse.json(summarizeDepartmentProductivity(rows));
      }
      case 'operator-productivity': {
        const rows = await fetchProductivityRows({
          branchId,
          dateFrom: searchParams.get('dateFrom'),
          dateTo: searchParams.get('dateTo'),
          departmentId: searchParams.get('departmentId'),
          employeeId: searchParams.get('employeeId'),
        });
        return NextResponse.json(summarizeOperatorProductivity(rows));
      }
      case 'labour-cost': {
        return NextResponse.json(await fetchLabourCostRows({
          batchId: searchParams.get('batchId'),
          branchId,
          dateFrom: searchParams.get('dateFrom'),
          dateTo: searchParams.get('dateTo'),
          departmentId: searchParams.get('departmentId'),
        }));
      }
      case 'payroll-summary': {
        if (!can(ctx, 'payroll.read', 'finance.read', 'hr.write')) return forbidden();
        const { data, error } = await service
          .from('hr_payroll_summaries')
          .select('*, employee:employees(employee_number, first_name, last_name, department, branch_id), period:hr_payroll_periods(period_name, start_date, end_date)')
          .eq('organization_id', ctx.organizationId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json((data ?? []).filter((row: Record<string, unknown>) => {
          const employee = row.employee as Record<string, unknown> | null;
          return !branchId || String(employee?.branch_id ?? '') === branchId;
        }));
      }
      default:
        return NextResponse.json({ error: 'Unsupported HR report type.' }, { status: 400 });
    }
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to build HR report.');
  }
}
