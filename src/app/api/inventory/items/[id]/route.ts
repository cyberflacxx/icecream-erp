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
import { isProductionRawMaterialCategory, mapProductionConversion, type ProductionConversionPayload } from '@/lib/production-raw-material-conversions';
import { saveProductionConversion } from '@/app/api/inventory/items/route';

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
      ? service.from('item_categories').select('id, name, code').eq('id', categoryId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    unitId
      ? service.from('units_of_measure').select('id, name, abbreviation').eq('id', unitId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (categoryResult.error) throw categoryResult.error;
  if (unitResult.error) throw unitResult.error;

  const profileResult = await service.from('production_raw_material_conversions').select('*').eq('item_id', String(row.id)).eq('is_active', true).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data as Record<string, unknown> | null;
  const profileUnitIds = profile ? [profile.purchase_uom_id, profile.conversion_uom_id, profile.production_output_uom_id].map(String) : [];
  const profileUnits = profileUnitIds.length ? await service.from('units_of_measure').select('id, name, abbreviation').in('id', profileUnitIds) : { data: [], error: null };
  if (profileUnits.error) throw profileUnits.error;
  const units = new Map((profileUnits.data ?? []).map((unit) => [String(unit.id), unit as Record<string, unknown>]));
  return {
    ...row,
    item_categories: asSingleRow(categoryResult.data),
    productionConversion: profile ? mapProductionConversion(profile, units) : null,
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
    .select('id, organization_id, category_id, unit_id, unit_of_measure_id')
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
    productionConversion?: ProductionConversionPayload;
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

  const targetCategoryId = String(body.categoryId ?? existing.category_id ?? '');
  const targetBaseUomId = String(body.unitOfMeasureId ?? existing.unit_of_measure_id ?? existing.unit_id ?? '');
  const categoryResult = targetCategoryId
    ? await service.from('item_categories').select('id, code').eq('id', targetCategoryId).eq('organization_id', ctx.organizationId).maybeSingle()
    : { data: null, error: null };
  if (categoryResult.error) return serverError(categoryResult.error.message);
  if (!categoryResult.data) return badRequest('Item category not found.');
  const targetIsProductionRawMaterial = isProductionRawMaterialCategory(categoryResult.data.code);
  if (targetIsProductionRawMaterial && !body.productionConversion) {
    const existingProfile = await service.from('production_raw_material_conversions').select('id').eq('item_id', id).eq('is_active', true).maybeSingle();
    if (existingProfile.error) return serverError(existingProfile.error.message);
    if (!existingProfile.data) return badRequest('RAW_MATERIAL_PRODUCTION items require a valid productionConversion profile.');
  }

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

  if (body.productionConversion) {
    try {
      await saveProductionConversion({
        baseUomId: targetBaseUomId,
        categoryCode: categoryResult.data.code,
        itemId: id,
        organizationId: ctx.organizationId,
        payload: body.productionConversion,
        service,
      });
    } catch (profileError) {
      if (body.categoryId !== undefined && existing.category_id !== body.categoryId) {
        await service.from('items').update({ category_id: existing.category_id }).eq('id', id);
      }
      return badRequest(profileError instanceof Error ? profileError.message : 'Production conversion could not be saved.');
    }
  }

  try {
    return NextResponse.json(await enrichInventoryItem(service, data as Record<string, unknown>));
  } catch (enrichmentError) {
    return serverError(enrichmentError instanceof Error ? enrichmentError.message : 'Inventory item updated, but lookup enrichment failed.');
  }
}
