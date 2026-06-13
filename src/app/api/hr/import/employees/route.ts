import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateEmployeeImportRows } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return badRequest('rows are required.');

    const service = hrService();
    const [{ data: departments }, { data: employees }] = await Promise.all([
      service.from('departments').select('name').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      service.from('employees').select('employee_number').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    ]);

    const validation = validateEmployeeImportRows(rows, {
      existingCodes: (employees ?? []).map((row: Record<string, unknown>) => String(row.employee_number ?? '')),
      validDepartments: (departments ?? []).map((row: Record<string, unknown>) => String(row.name ?? '')),
      validShiftNames: ['DAY', 'NIGHT'],
    });
    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors, inserted: 0 }, { status: 400 });
    }

    const payload = validation.rows.map((row) => {
      const fullName = String(row.full_name ?? '');
      const parts = fullName.split(/\s+/).filter(Boolean);
      return {
        basic_rate: Number(row.basic_rate ?? 0),
        department: row.department,
        employee_number: row.employee_code,
        first_name: parts.slice(0, -1).join(' ') || (parts[0] ?? ''),
        full_name: fullName,
        hire_date: String(row.hire_date ?? new Date().toISOString().slice(0, 10)),
        hourly_rate: Number(row.hourly_rate ?? 0),
        job_title: row.job_role,
        last_name: parts.slice(-1)[0] ?? '',
        organization_id: ctx.organizationId,
        phone: row.phone_number ?? null,
        shift_rate: Number(row.shift_rate ?? 0),
        status: row.status ?? 'ACTIVE',
        warehouse_id: null,
      };
    });

    const { data, error } = await service.from('employees').insert(payload).select();
    if (error) throw error;
    await writeHrAuditLog('HR_EMPLOYEE_IMPORT', `import-${Date.now()}`, ctx.userId, { rows: payload.length }, 'employee_import');
    return NextResponse.json({ data: data ?? [], inserted: payload.length });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to import employees.');
  }
}
