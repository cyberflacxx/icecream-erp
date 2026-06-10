import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ROLES } from '@/lib/auth-roles';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;

  // Return hardcoded ROLES from auth-roles with db-enrichment if available
  const service = createServiceRoleClient();

  try {
    let roles = ROLES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: true,
      permissions: [] as Array<{ id: string; code: string; module: string }>,
      userCount: 0,
    }));

    if (search) {
      const term = search.toLowerCase();
      roles = roles.filter((r) => r.name.toLowerCase().includes(term) || r.id.toLowerCase().includes(term));
    }

    // Try to enrich with db roles
    const { data: dbRoles } = await service
      .schema('icecream_erp')
      .from('roles')
      .select('id, name, description, is_system_role, role_permissions(permissions(id, code, module)), user_roles(id)');

    if (dbRoles?.length) {
      const total = dbRoles.length;
      const start = (page - 1) * pageSize;
      const filtered = search
        ? dbRoles.filter((r: { name: string }) => r.name.toLowerCase().includes(search.toLowerCase()))
        : dbRoles;

      return NextResponse.json({
        data: filtered.slice(start, start + pageSize).map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          isSystemRole: r.is_system_role ?? false,
          permissions: ((r.role_permissions as Array<{ permissions: { id: string; code: string; module: string } }>) ?? []).map((rp) => rp.permissions),
          userCount: Array.isArray(r.user_roles) ? r.user_roles.length : 0,
        })),
        pagination: { page, pageSize, total: filtered.length },
      });
    }

    const start = (page - 1) * pageSize;
    return NextResponse.json({
      data: roles.slice(start, start + pageSize),
      pagination: { page, pageSize, total: roles.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as { name: string; description?: string };
    if (!body.name) return badRequest('name is required');

    const { data: role, error } = await service
      .schema('icecream_erp')
      .from('roles')
      .insert({
        name: body.name,
        description: body.description ?? null,
        is_system_role: false,
      })
      .select()
      .single();

    if (error) throw error;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'ROLE_CREATED',
      entity_id: role.id,
      entity_type: 'role',
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
