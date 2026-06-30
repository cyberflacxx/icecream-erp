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

function normalizeItem(row: Record<string, unknown>, categories = new Map<string, Record<string, unknown>>(), units = new Map<string, Record<string, unknown>>()) {
  const categoryId = String(row.category_id ?? '');
  const unitId = String(row.unit_of_measure_id ?? row.unit_id ?? '');
  const category = categoryId ? categories.get(categoryId) ?? null : null;
  const unit = unitId ? units.get(unitId) ?? null : null;
  const itemType = String(row.item_type ?? row.type ?? 'RAW_MATERIAL');
  const reorderLevel = Number(row.reorder_level ?? 0);
  const reorderQuantity = Number(row.reorder_quantity ?? row.reorder_qty ?? 0);
  const sellingPrice = Number(row.selling_price ?? 0);
  const unitCost = Number(row.unit_cost ?? row.standard_cost ?? 0);

  return {
    code: String(row.code ?? ''),
    category: {
      id: categoryId,
      name: String(category?.name ?? 'Uncategorized'),
    },
    description: row.description ? String(row.description) : null,
    id: String(row.id ?? ''),
    isActive: row.is_active !== false,
    itemType,
    name: String(row.name ?? row.code ?? 'Unnamed item'),
    reorderLevel: Number.isFinite(reorderLevel) ? reorderLevel : 0,
    reorderQuantity: Number.isFinite(reorderQuantity) ? reorderQuantity : 0,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    stock: Number(row.stock ?? row.quantity_on_hand ?? 0) || 0,
    trackExpiry: Boolean(row.track_expiry ?? row.shelf_life_days),
    unitCost: Number.isFinite(unitCost) ? unitCost : 0,
    unitOfMeasure: {
      abbreviation: String(unit?.abbreviation ?? '--'),
      id: unitId,
      name: String(unit?.name ?? 'Unit'),
    },
  };
}

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
      `id, organization_id, code, name, description, type, category_id, unit_id, standard_cost,
       selling_price, reorder_level, reorder_qty, shelf_life_days, is_active, created_at`,
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

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
  if (type) query = query.eq('type', type);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  const categoryIds = [...new Set((data ?? []).map((row) => String(row.category_id ?? '')).filter(Boolean))];
  const unitIds = [...new Set((data ?? []).map((row) => String(row.unit_id ?? '')).filter(Boolean))];
  const [categoriesResult, unitsResult] = await Promise.all([
    categoryIds.length
      ? service.from('item_categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (categoriesResult.error) return serverError(categoriesResult.error.message);
  if (unitsResult.error) return serverError(unitsResult.error.message);

  const categories = new Map((categoriesResult.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));
  const units = new Map((unitsResult.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));

  return NextResponse.json({
    data: (data ?? []).map((row) => normalizeItem(row as Record<string, unknown>, categories, units)),
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

  const { code, name, unitOfMeasureId, itemType } = body;
  let { categoryId } = body;

  if (!code || !name || !unitOfMeasureId || !itemType) {
    return badRequest('code, name, unitOfMeasureId, and itemType are required.');
  }

  let categoryRecord: Record<string, unknown> | null = null;
  let unitRecord: Record<string, unknown> | null = null;

  if (!categoryId) {
    const existing = await service
      .from('item_categories')
      .select('id, name')
      .eq('organization_id', ctx.organizationId)
      .ilike('name', 'Uncategorized')
      .maybeSingle();
    if (existing.error) return serverError(existing.error.message);

    if (existing.data?.id) {
      categoryId = existing.data.id;
      categoryRecord = existing.data as Record<string, unknown>;
    } else {
      const created = await service
        .from('item_categories')
        .insert({ organization_id: ctx.organizationId, name: 'Uncategorized', description: 'Default category for uncategorized inventory items.' })
        .select('id, name')
        .single();
      if (created.error || !created.data) return serverError(created.error?.message ?? 'Failed to create default item category.');
      categoryId = created.data.id;
      categoryRecord = created.data as Record<string, unknown>;
    }
  } else {
    const { data: category, error: categoryError } = await service
      .from('item_categories')
      .select('id, name')
      .eq('id', categoryId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (categoryError) return serverError(categoryError.message);
    if (!category) return badRequest('Item category not found.');
    categoryRecord = category as Record<string, unknown>;
  }

  // Verify unit of measure exists
  const { data: unit, error: unitError } = await service
    .from('units_of_measure')
    .select('id, name, abbreviation')
    .eq('id', unitOfMeasureId)
    .single();
  if (unitError) return serverError(unitError.message);
  if (!unit) return badRequest('Unit of measure not found.');
  unitRecord = unit as Record<string, unknown>;

  const { data, error } = await service
    .from('items')
    .insert({
      code,
      name,
      description: body.description ?? null,
      organization_id: ctx.organizationId,
      category_id: categoryId,
      unit_id: unitOfMeasureId,
      type: itemType,
      is_active: body.isActive ?? true,
      reorder_level: body.reorderLevel ?? null,
      reorder_qty: body.reorderQuantity ?? null,
      shelf_life_days: body.trackExpiry ? 30 : null,
      standard_cost: body.unitCost ?? null,
      selling_price: body.sellingPrice ?? null,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  const categories = new Map<string, Record<string, unknown>>();
  const units = new Map<string, Record<string, unknown>>();
  if (categoryId && categoryRecord) categories.set(categoryId, categoryRecord);
  if (unitOfMeasureId && unitRecord) units.set(unitOfMeasureId, unitRecord);

  return NextResponse.json(normalizeItem(data as Record<string, unknown>, categories, units), { status: 201 });
}
