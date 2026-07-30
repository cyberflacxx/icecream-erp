import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingProductionTable, productionErrorMessage, productionService } from '@/lib/production-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.view')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const service = productionService();

    let query = service
      .from('items')
      .select(`
        id, code, name, description, item_type, type, category_id, unit_of_measure_id, unit_id, default_warehouse_id,
        is_active, unit_cost, standard_cost, production_category
      `)
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true)
      .or('item_type.eq.FINISHED_GOOD,type.eq.FINISHED_GOOD')
      .order('code', { ascending: true })
      .limit(50);

    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const productIds = rows.map((row) => String(row.id));
    const bomResult = productIds.length
      ? await service
        .from('recipes')
        .select('id, code, version, expected_output_quantity, output_unit_id, status, finished_item_id')
        .eq('organization_id', ctx.organizationId)
        .in('finished_item_id', productIds)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null)
        .order('version', { ascending: false })
      : { data: [], error: null };
    if (bomResult.error) throw bomResult.error;

    const bomByProductId = new Map<string, Record<string, unknown>>();
    for (const bom of (bomResult.data ?? []) as Array<Record<string, unknown>>) {
      const productId = String(bom.finished_item_id ?? '');
      if (productId && !bomByProductId.has(productId)) bomByProductId.set(productId, bom);
    }

    const products = rows.map((row) => {
      const activeBom = bomByProductId.get(String(row.id)) ?? null;
      return {
        ...row,
        activeBom,
        isManufacturable: Boolean(activeBom),
      };
    }).filter((row) => row.isManufacturable);

    return NextResponse.json(products);
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}
