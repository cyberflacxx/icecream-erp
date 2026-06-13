import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  try {
    const service = hrService();
    const { data, error } = await service
      .from('departments')
      .select('id, organization_id, code, name, description, is_active, created_at, updated_at')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load departments.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const body = await request.json() as {
      active_status?: boolean;
      department_code?: string;
      department_name?: string;
      description?: string;
      manager?: string;
    };
    const code = String(body.department_code ?? '').trim();
    const name = String(body.department_name ?? '').trim();
    if (!code || !name) return badRequest('department_code and department_name are required.');

    const service = hrService();
    const { data, error } = await service
      .from('departments')
      .insert({
        code,
        description: body.description ?? body.manager ?? null,
        is_active: body.active_status ?? true,
        name,
        organization_id: ctx.organizationId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeHrAuditLog('HR_DEPARTMENT_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'department');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create department.');
  }
}
