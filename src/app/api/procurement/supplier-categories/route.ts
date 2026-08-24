import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  let { data, error } = await service
    .from('supplier_categories')
    .select('id, name, description')
    .eq('organization_id', ctx.organizationId)
    .order('name');

  if (error && isMissingColumnError(error, 'supplier_categories', 'description')) {
    const fallback = await service
      .from('supplier_categories')
      .select('id, name')
      .eq('organization_id', ctx.organizationId)
      .order('name');
    data = fallback.data?.map((row) => ({ ...row, description: null }));
    error = fallback.error;
  }

  if (error) return serverError(error.message);
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as { description?: string | null; name?: string };
  if (!body.name?.trim()) return badRequest('name is required.');

  const service = createServiceRoleClient();
  let { data, error } = await service
    .from('supplier_categories')
    .insert({
      description: body.description ?? null,
      name: body.name.trim(),
      organization_id: ctx.organizationId,
    })
    .select()
    .single();

  if (error && isMissingColumnError(error, 'supplier_categories', 'description')) {
    const fallback = await service
      .from('supplier_categories')
      .insert({
        name: body.name.trim(),
        organization_id: ctx.organizationId,
      })
      .select()
      .single();
    data = fallback.data ? { ...fallback.data, description: null } : fallback.data;
    error = fallback.error;
  }

  if (error) return serverError(error.message);
  return NextResponse.json(data, { status: 201 });
}
