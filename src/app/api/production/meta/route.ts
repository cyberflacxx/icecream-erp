import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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

    const normalizedItems = items.map((item) => ({
      ...item,
      itemType: itemType(item),
      unitCost: Number(item.unit_cost ?? item.standard_cost ?? 0),
      unitOfMeasureId: unitId(item),
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

    const normalizedRecipes = recipes.map((recipe) => ({
      ...recipe,
      expectedOutputQuantity: Number(recipe.expected_output_quantity ?? recipe.batch_size ?? 0),
      finishedItemId: recipe.finished_item_id ?? null,
      outputUnitId: recipe.output_unit_id ?? recipe.batch_unit_id ?? null,
      ingredients: recipeItemsByRecipe.get(String(recipe.id)) ?? [],
      packagingItems: packagingItemsByRecipe.get(String(recipe.id)) ?? [],
    }));

    return NextResponse.json({
      categories,
      chocolateTypes,
      employees: employees.map((employee) => ({
        ...employee,
        displayName: employee.full_name ?? employee.name ?? employee.employee_name ?? 'Unnamed employee',
      })),
      flavours,
      items: normalizedItems,
      rawMaterials: normalizedItems.filter((item) => ['RAW_MATERIAL', 'RAW'].includes(String(item.itemType))),
      packagingItems: normalizedItems.filter((item) => String(item.itemType) === 'PACKAGING'),
      finishedGoods: normalizedItems.filter((item) => ['FINISHED_GOOD', 'FINISHED'].includes(String(item.itemType))),
      productionCategories: [
        { label: 'Ice Cream Making', value: 'ICE_CREAM_MAKING' },
        { label: 'Packaging', value: 'PACKAGING' },
      ],
      recipes: normalizedRecipes,
      stockByItemId: Object.fromEntries(stockByItemId.entries()),
      stockByItemWarehouse: Object.fromEntries(stockByItemWarehouse.entries()),
      unitsOfMeasure,
      warehouses: warehouses.map((warehouse) => ({
        ...warehouse,
        isProductionWarehouse:
          Boolean(warehouse.is_production_warehouse) ||
          String(warehouse.production_role ?? '').toUpperCase() === 'PRODUCTION' ||
          String(warehouse.name ?? '').toLowerCase().includes('production'),
      })),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
