import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function asSingleRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

async function enrichInventoryItem(
  service: ReturnType<typeof createServiceRoleClient>,
  row: Record<string, unknown>,
) {
  const categoryId = row.category_id ? String(row.category_id) : '';
  const unitId = row.unit_of_measure_id ? String(row.unit_of_measure_id) : '';

  const [categoryResult, unitResult] = await Promise.all([
    categoryId
      ? service.from('item_categories').select('id, name').eq('id', categoryId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    unitId
      ? service.from('units_of_measure').select('id, name, abbreviation').eq('id', unitId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (categoryResult.error) throw categoryResult.error;
  if (unitResult.error) throw unitResult.error;

  return {
    ...row,
    item_categories: asSingleRow(categoryResult.data),
    units_of_measure: asSingleRow(unitResult.data),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const { id } = await params;
  if (!id) return badRequest('Item id is required.');

  const service = createServiceRoleClient();

  // Verify the item exists and is not deleted
  const { data: existing } = await service
    .from('items')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existing) return notFound('Inventory item not found.');

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

  // Build update payload — only include provided fields
  const updateData: Record<string, unknown> = {};
  if (body.code !== undefined) updateData.code = body.code;
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
  if (body.unitOfMeasureId !== undefined) updateData.unit_of_measure_id = body.unitOfMeasureId;
  if (body.itemType !== undefined) updateData.item_type = body.itemType;
  if (body.isActive !== undefined) updateData.is_active = body.isActive;
  if (body.trackExpiry !== undefined) updateData.track_expiry = body.trackExpiry;
  if (body.reorderLevel !== undefined) updateData.reorder_level = body.reorderLevel;
  if (body.reorderQuantity !== undefined) updateData.reorder_quantity = body.reorderQuantity;
  if (body.unitCost !== undefined) updateData.unit_cost = body.unitCost;
  if (body.sellingPrice !== undefined) updateData.selling_price = body.sellingPrice;

  if (Object.keys(updateData).length === 0) {
    return badRequest('No fields provided for update.');
  }

  const { data, error } = await service
    .from('items')
    .update(updateData)
    .eq('id', id)
    .select(
      `id, code, name, description, category_id, unit_of_measure_id, item_type, is_active, reorder_level, reorder_quantity,
       selling_price, track_expiry, unit_cost, created_at`,
    )
    .single();

  if (error) return serverError(error.message);

  try {
    return NextResponse.json(await enrichInventoryItem(service, data as Record<string, unknown>));
  } catch (enrichmentError) {
    return serverError(enrichmentError instanceof Error ? enrichmentError.message : 'Inventory item updated, but lookup enrichment failed.');
  }
}
