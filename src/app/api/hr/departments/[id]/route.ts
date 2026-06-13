import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('departments').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Department not found.');

    const update = {
      code: body.department_code ?? body.code,
      description: body.description ?? body.manager ?? null,
      is_active: body.active_status ?? body.is_active,
      name: body.department_name ?? body.name,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service.from('departments').update(update).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_DEPARTMENT_UPDATED', id, ctx.userId, update, 'department');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update department.');
  }
}
