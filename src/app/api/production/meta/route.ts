import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { selectLatestActiveBom } from '@/lib/production';
import { productionService } from '@/lib/production-server';

type SupabaseResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

async function safeList<T>(query: PromiseLike<SupabaseResult<T>>) {
  const result = await query;
  if (result.error) return [];
  return result.data ?? [];
}

function itemType(row: Record<string, unknown>) {
  return String(row.item_type ?? row.type ?? '').toUpperCase();
}

function unitId(row: Record<string, unknown>) {
  return row.unit_of_measure_id ?? row.unit_id ?? null;
}

function warehouseType(row: Record<string, unknown>) {
  return String(row.warehouse_type ?? row.type ?? '').toUpperCase();
}

function warehouseRole(row: Record<string, unknown>) {
  return String(row.production_role ?? '').toUpperCase();
}

function warehouseName(row: Record<string, unknown>) {
  return String(row.name ?? '').toLowerCase();
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();

    const [
      items,
      unitsOfMeasure,
      categories,
      warehouses,
      branches,
      recipes,
      recipeItems,
      recipePackagingItems,
      stockBalances,
      employees,
      flavours,
      chocolateTypes,
    ] = await Promise.all([
      safeList<Record<string, unknown>>(
        service.from('items').select('*').eq('is_active', true).order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('units_of_measure').select('*').order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('item_categories').select('*').order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('warehouses').select('*').eq('is_active', true).order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('branches').select('id, name, code, status').eq('organization_id', ctx.organizationId).eq('status', 'ACTIVE').order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('recipes').select('*').is('deleted_at', null).order('updated_at', { ascending: false }),
      ),
      safeList<Record<string, unknown>>(
        service.from('recipe_items').select('*').order('sort_order', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('recipe_packaging_items').select('*').order('sort_order', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(service.from('stock_balances').select('*')),
      safeList<Record<string, unknown>>(
        service.from('employees').select('*').order('full_name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('production_flavours').select('*').eq('is_active', true).order('name', { ascending: true }),
      ),
      safeList<Record<string, unknown>>(
        service.from('production_chocolate_types').select('*').eq('is_active', true).order('name', { ascending: true }),
      ),
    ]);

    const stockByItemId = new Map<string, number>();
    const stockByItemWarehouse = new Map<string, number>();
    for (const row of stockBalances) {
      const itemId = String(row.item_id ?? '');
      const warehouseId = String(row.warehouse_id ?? '');
      const quantity = Number(row.quantity_available ?? row.quantity ?? 0);
      if (!itemId) continue;
      stockByItemId.set(itemId, (stockByItemId.get(itemId) ?? 0) + quantity);
      if (warehouseId) stockByItemWarehouse.set(`${itemId}:${warehouseId}`, quantity);
    }

    const normalizedItems: Array<Record<string, unknown> & {
      id: string;
      itemType: string;
      unitCost: number;
      unitOfMeasureId: string | null;
    }> = items.map((item) => ({
      ...item,
      id: String(item.id ?? ''),
      itemType: itemType(item),
      unitCost: Number(item.unit_cost ?? item.standard_cost ?? 0),
      unitOfMeasureId: item.unit_id || item.unit_of_measure_id ? String(unitId(item) ?? '') : null,
    }));

    const recipeItemsByRecipe = new Map<string, Record<string, unknown>[]>();
    for (const row of recipeItems) {
      const recipeId = String(row.recipe_id ?? '');
      if (!recipeId) continue;
      recipeItemsByRecipe.set(recipeId, [...(recipeItemsByRecipe.get(recipeId) ?? []), row]);
    }

    const packagingItemsByRecipe = new Map<string, Record<string, unknown>[]>();
    for (const row of recipePackagingItems) {
      const recipeId = String(row.recipe_id ?? '');
      if (!recipeId) continue;
      packagingItemsByRecipe.set(recipeId, [...(packagingItemsByRecipe.get(recipeId) ?? []), row]);
    }

    const itemById = new Map(normalizedItems.map((item) => [String(item.id), item]));
    const unitById = new Map(unitsOfMeasure.map((unit) => [String(unit.id ?? ''), unit]));

    const normalizedRecipes = recipes.map((recipe) => ({
      ...recipe,
      expectedOutputQuantity: Number(recipe.expected_output_quantity ?? recipe.batch_size ?? 0),
      finishedItemId: recipe.finished_item_id ?? null,
      outputUnitId: recipe.output_unit_id ?? recipe.batch_unit_id ?? null,
      ingredients: (recipeItemsByRecipe.get(String(recipe.id)) ?? []).map((row) => ({
        ...row,
        items: itemById.get(String(row.item_id ?? '')) ?? null,
        units_of_measure: unitById.get(String(row.unit_id ?? '')) ?? null,
      })),
      packagingItems: (packagingItemsByRecipe.get(String(recipe.id)) ?? []).map((row) => ({
        ...row,
        items: itemById.get(String(row.item_id ?? '')) ?? null,
        units_of_measure: unitById.get(String(row.unit_id ?? '')) ?? null,
      })),
    }));

    const recipeGroupsByFinishedItem = new Map<string, Array<Record<string, unknown>>>();
    for (const recipe of normalizedRecipes) {
      const finishedItemId = String(recipe.finishedItemId ?? '');
      if (!finishedItemId) continue;
      recipeGroupsByFinishedItem.set(finishedItemId, [...(recipeGroupsByFinishedItem.get(finishedItemId) ?? []), recipe]);
    }

    const products = normalizedItems
      .filter((item) => ['FINISHED_GOOD', 'FINISHED'].includes(String(item.itemType)))
      .map((item) => ({
        ...item,
        activeBom: selectLatestActiveBom(recipeGroupsByFinishedItem.get(String(item.id)) ?? []),
      }));

    const normalizedWarehouses = warehouses.map((warehouse) => {
      const type = warehouseType(warehouse);
      const role = warehouseRole(warehouse);
      const name = warehouseName(warehouse);
      const isProductionWarehouse =
        Boolean(warehouse.is_production_warehouse) ||
        role === 'PRODUCTION' ||
        type.includes('PRODUCTION') ||
        name.includes('production');

      return {
        ...warehouse,
        isMainWarehouse:
          type === 'MAIN' ||
          name.includes('main') ||
          name.includes('hq') ||
          name.includes('head office'),
        isProductionFinishedWarehouse:
          isProductionWarehouse &&
          (type.includes('FINISHED') || name.includes('finished') || name.includes('fg')),
        isProductionMaterialWarehouse:
          isProductionWarehouse ||
          type.includes('PRODUCTION_MATERIAL') ||
          name.includes('production raw') ||
          name.includes('production material'),
        isProductionWarehouse,
        productionRole: role || null,
        warehouseType: type || null,
      };
    });

    return NextResponse.json({
      categories,
      chocolateTypes,
      branches,
      employees: employees.map((employee) => ({
        ...employee,
        displayName: employee.full_name ?? employee.name ?? employee.employee_name ?? 'Unnamed employee',
      })),
      flavours,
      items: normalizedItems,
      products,
      rawMaterials: normalizedItems.filter((item) => ['RAW_MATERIAL', 'RAW'].includes(String(item.itemType))),
      packagingItems: normalizedItems.filter((item) => ['PACKAGING', 'PACKAGING_MATERIAL'].includes(String(item.itemType))),
      finishedGoods: normalizedItems.filter((item) => ['FINISHED_GOOD', 'FINISHED'].includes(String(item.itemType))),
      mainWarehouses: normalizedWarehouses.filter((warehouse) => warehouse.isMainWarehouse),
      productionCategories: [
        { label: 'Ice Cream Making', value: 'ICE_CREAM_MAKING' },
        { label: 'Packaging', value: 'PACKAGING' },
      ],
      productionFinishedWarehouses: normalizedWarehouses.filter((warehouse) => warehouse.isProductionFinishedWarehouse),
      productionMaterialWarehouses: normalizedWarehouses.filter((warehouse) => warehouse.isProductionMaterialWarehouse),
      recipes: normalizedRecipes,
      stockByItemId: Object.fromEntries(stockByItemId.entries()),
      stockByItemWarehouse: Object.fromEntries(stockByItemWarehouse.entries()),
      unitsOfMeasure,
      warehouses: normalizedWarehouses,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
