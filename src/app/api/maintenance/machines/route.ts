import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const machineType = searchParams.get('machineType') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const isActive = searchParams.get('isActive');

  try {
    let query = service
      .schema('icecream_erp')
      .from('machines')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (machineType) query = query.eq('machine_type', machineType);
    if (status) query = query.eq('status', status);
    if (isActive !== null && isActive !== '') query = query.eq('is_active', isActive === 'true');
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%`);

    const from = (page - 1) * limit;
    const { data, count, error } = await query.range(from, from + limit - 1);
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'maintenance.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      code: string;
      name: string;
      machineType: string;
      status?: string;
      location?: string;
      purchaseDate?: string;
      warrantyExpiry?: string;
      isActive?: boolean;
    };

    if (!body.code || !body.name || !body.machineType) {
      return badRequest('code, name, machineType are required');
    }

    // Check for duplicate code
    const { data: existing } = await service
      .schema('icecream_erp')
      .from('machines')
      .select('id')
      .eq('code', body.code)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) return badRequest(`Machine code ${body.code} already exists`);

    const { data: machine, error } = await service
      .schema('icecream_erp')
      .from('machines')
      .insert({
        code: body.code,
        name: body.name,
        machine_type: body.machineType,
        status: body.status ?? 'OPERATIONAL',
        location: body.location ?? null,
        purchase_date: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : null,
        warranty_expiry: body.warrantyExpiry ? new Date(body.warrantyExpiry).toISOString() : null,
        is_active: body.isActive ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(machine, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
