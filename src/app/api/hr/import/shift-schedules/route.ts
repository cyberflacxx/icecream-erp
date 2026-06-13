import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeShiftName } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return badRequest('rows are required.');

    const service = hrService();
    const { data: shifts, error: shiftError } = await service
      .from('hr_shift_definitions')
      .select('id, shift_name')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true);
    if (shiftError) throw shiftError;
    const shiftMap = new Map((shifts ?? []).map((row: Record<string, unknown>) => [String(row.shift_name ?? ''), String(row.id ?? '')]));

    const payload: Array<Record<string, unknown>> = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] ?? {};
      const shiftName = normalizeShiftName(String(row.shift_name ?? ''));
      const shiftDefinitionId = shiftMap.get(shiftName);
      if (!row.shift_date || !shiftDefinitionId) {
        errors.push({ row: index + 2, field: 'shift_name', message: `Invalid shift name: ${shiftName || 'blank'}.` });
        continue;
      }

      payload.push({
        branch_id: row.branch_id ?? ctx.branchId ?? null,
        department_id: row.department_id ?? null,
        organization_id: ctx.organizationId,
        scheduled_by: ctx.userId,
        shift_date: row.shift_date,
        shift_definition_id: shiftDefinitionId,
        status: row.status ?? 'SCHEDULED',
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors, inserted: 0 }, { status: 400 });
    }

    const { data, error } = await service.from('hr_shift_schedules').insert(payload).select();
    if (error) throw error;
    await writeHrAuditLog('HR_SHIFT_SCHEDULE_IMPORT', `import-${Date.now()}`, ctx.userId, { rows: payload.length }, 'shift_schedule_import');
    return NextResponse.json({ data: data ?? [], inserted: payload.length });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to import shift schedules.');
  }
}
