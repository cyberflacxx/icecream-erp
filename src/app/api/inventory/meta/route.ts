import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const includeInactiveItems = searchParams.get('includeInactiveItems') === 'true';

  // Run all meta queries in parallel
  const [
    categoriesResult,
    unitsOfMeasureResult,
    branchesResult,
    warehousesResult,
    itemsResult,
  ] = await Promise.all([
    service
      .from('item_categories')
      .select('id, name, description')
      .order('name', { ascending: true }),

    service
      .from('units_of_measure')
      .select('id, name, abbreviation')
      .order('name', { ascending: true }),

    service
      .from('branches')
      .select('id, name, code')
      .is('deleted_at', null)
      .order('name', { ascending: true }),

    (() => {
      let q = service
        .from('warehouses')
        .select('id, name, code, type, is_active, branch_id')
        .order('name', { ascending: true });
      if (ctx.isBranchScoped && ctx.branchId) {
        q = q.eq('branch_id', ctx.branchId);
      }
      return q;
    })(),

    (() => {
      let q = service
        .from('items')
        .select('id, code, name, item_type, unit_of_measure_id, category_id')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (!includeInactiveItems) {
        q = q.eq('is_active', true);
      }
      return q;
    })(),
  ]);

  if (categoriesResult.error) return serverError(categoriesResult.error.message);
  if (unitsOfMeasureResult.error) return serverError(unitsOfMeasureResult.error.message);
  if (branchesResult.error) return serverError(branchesResult.error.message);
  if (warehousesResult.error) return serverError(warehousesResult.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  return NextResponse.json({
    categories: categoriesResult.data ?? [],
    unitsOfMeasure: unitsOfMeasureResult.data ?? [],
    branches: branchesResult.data ?? [],
    warehouses: warehousesResult.data ?? [],
    items: itemsResult.data ?? [],
  });
}
