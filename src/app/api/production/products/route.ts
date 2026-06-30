import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { validateProductionCodeUniqueness } from '@/lib/production';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('items')
      .select('id, code, name, item_type, unit_of_measure_id, default_warehouse_id, is_active, selling_price, unit_cost, units_of_measure(abbreviation), warehouses(name)')
      .eq('item_type', 'FINISHED_GOOD')
      .order('name');

    if (error) throw error;

    return NextResponse.json((data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      itemType: row.item_type,
      unitOfMeasureId: row.unit_of_measure_id,
      defaultWarehouseId: row.default_warehouse_id,
      isActive: row.is_active,
      sellingPrice: Number(row.selling_price ?? 0),
      unitCost: Number(row.unit_cost ?? 0),
      unit: Array.isArray(row.units_of_measure) ? row.units_of_measure[0] : row.units_of_measure,
      defaultWarehouse: Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses,
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      categoryId: string;
      code: string;
      defaultWarehouseId?: string;
      name: string;
      unitCost?: number;
      unitOfMeasureId: string;
    };

    if (!body.name?.trim()) return badRequest('Product name is required.');
    if (!body.code?.trim()) return badRequest('Product code is required.');
    if (!body.categoryId) return badRequest('categoryId is required.');
    if (!body.unitOfMeasureId) return badRequest('unitOfMeasureId is required.');
    if (body.unitCost !== undefined) ensurePositiveQuantity(body.unitCost || 0.001, 'unitCost');

    const service = productionService();
    const { data: existing, error: existingError } = await service
      .from('items')
      .select('code')
      .eq('item_type', 'FINISHED_GOOD');
    if (existingError) throw existingError;

    if (!validateProductionCodeUniqueness((existing ?? []).map((row: { code: string }) => row.code), body.code)) {
      return badRequest('Product code must be unique.');
    }

    const { data, error } = await service
      .from('items')
      .insert({
        category_id: body.categoryId,
        code: body.code.trim().toUpperCase(),
        default_warehouse_id: body.defaultWarehouseId ?? null,
        is_active: true,
        item_type: 'FINISHED_GOOD',
        name: body.name.trim(),
        organization_id: ctx.organizationId,
        unit_cost: body.unitCost ?? 0,
        unit_of_measure_id: body.unitOfMeasureId,
      })
      .select()
      .single();

    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_PRODUCT_CREATED', String(data.id), ctx.userId, {
      code: data.code,
      name: data.name,
    }, 'item');

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
