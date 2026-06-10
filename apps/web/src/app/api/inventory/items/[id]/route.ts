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
      `id, code, name, description, item_type, is_active, reorder_level, reorder_quantity,
       selling_price, track_expiry, unit_cost, created_at,
       item_categories!category_id(id, name),
       units_of_measure!unit_of_measure_id(id, name, abbreviation)`,
    )
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
