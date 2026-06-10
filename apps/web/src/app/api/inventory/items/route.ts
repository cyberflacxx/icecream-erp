import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';

  let query = service
    .from('items')
    .select(
      `id, code, name, description, item_type, is_active, reorder_level, reorder_quantity,
       selling_price, track_expiry, unit_cost, created_at,
       item_categories!category_id(id, name),
       units_of_measure!unit_of_measure_id(id, name, abbreviation)`,
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq('category_id', category);
  }
  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }
  if (type) {
    query = query.eq('item_type', type);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    description?: string | null;
    categoryId?: string;
    unitOfMeasureId?: string;
    itemType?: string;
    isActive?: boolean;
    trackExpiry?: boolean;
    reorderLevel?: number | null;
    reorderQuantity?: number | null;
    unitCost?: number | null;
    sellingPrice?: number | null;
  };

  const { code, name, categoryId, unitOfMeasureId, itemType } = body;

  if (!code || !name || !categoryId || !unitOfMeasureId || !itemType) {
    return badRequest('code, name, categoryId, unitOfMeasureId, and itemType are required.');
  }

  // Verify category exists
  const { data: category } = await service
    .from('item_categories')
    .select('id')
    .eq('id', categoryId)
    .single();
  if (!category) return badRequest('Item category not found.');

  // Verify unit of measure exists
  const { data: unit } = await service
    .from('units_of_measure')
    .select('id')
    .eq('id', unitOfMeasureId)
    .single();
  if (!unit) return badRequest('Unit of measure not found.');

  const { data, error } = await service
    .from('items')
    .insert({
      code,
      name,
      description: body.description ?? null,
      category_id: categoryId,
      unit_of_measure_id: unitOfMeasureId,
      item_type: itemType,
      is_active: body.isActive ?? true,
      track_expiry: body.trackExpiry ?? false,
      reorder_level: body.reorderLevel ?? null,
      reorder_quantity: body.reorderQuantity ?? null,
      unit_cost: body.unitCost ?? null,
      selling_price: body.sellingPrice ?? null,
    })
    .select(
      `id, code, name, description, item_type, is_active, reorder_level, reorder_quantity,
       selling_price, track_expiry, unit_cost, created_at,
       item_categories!category_id(id, name),
       units_of_measure!unit_of_measure_id(id, name, abbreviation)`,
    )
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
