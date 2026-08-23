import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveBranchWarehouse } from '@/lib/branches-server';
import { isMissingColumnError, isMissingTableError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read', 'inventory.read', 'sales.read', 'sales.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== id) return forbidden();

    const warehouse = await resolveBranchWarehouse(id);
    if (!warehouse) return badRequest('No warehouse linked to this branch.');

    const buildStockQuery = (includeDeletedItemFilter: boolean) => {
      let query = service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity_on_hand, quantity_available, quantity_reserved, items!inner(*)', { count: 'exact' })
        .eq('warehouse_id', warehouse.id)
        .order('items(name)', { ascending: true });

      if (includeDeletedItemFilter) {
        query = query.is('items.deleted_at', null);
      }

      if (search) {
        query = query.or(`items.code.ilike.%${search}%,items.name.ilike.%${search}%`);
      }

      return query;
    };

    const from = (page - 1) * pageSize;
    let stockResult = await buildStockQuery(true).range(from, from + pageSize - 1);

    if (stockResult.error && isMissingColumnError(stockResult.error, 'items', 'deleted_at')) {
      stockResult = await buildStockQuery(false).range(from, from + pageSize - 1);
    }

    const { data, count, error } = stockResult;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const categoryIds = [...new Set(rows.map((row) => String((row.items as Record<string, unknown> | undefined)?.category_id ?? '')).filter(Boolean))];
    const unitIds = [...new Set(rows.map((row) => String((row.items as Record<string, unknown> | undefined)?.unit_of_measure_id ?? (row.items as Record<string, unknown> | undefined)?.unit_id ?? '')).filter(Boolean))];
    const itemIds = [...new Set(rows.map((row) => String((row.items as Record<string, unknown> | undefined)?.id ?? '')).filter(Boolean))];

    const [categoriesResult, unitsResult, ledgerResult] = await Promise.all([
      categoryIds.length
        ? service.schema('icecream_erp').from('item_categories').select('id, name').in('id', categoryIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length
        ? service.schema('icecream_erp').from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
        : Promise.resolve({ data: [], error: null }),
      itemIds.length
        ? service
            .schema('icecream_erp')
            .from('branch_stock_ledger')
            .select('item_id, transaction_date')
            .eq('branch_id', id)
            .in('item_id', itemIds)
            .order('transaction_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (categoriesResult.error && !isMissingTableError(categoriesResult.error, 'item_categories')) {
      throw categoriesResult.error;
    }
    if (unitsResult.error && !isMissingTableError(unitsResult.error, 'units_of_measure')) {
      throw unitsResult.error;
    }
    if (ledgerResult.error && !isMissingTableError(ledgerResult.error, 'branch_stock_ledger')) {
      throw ledgerResult.error;
    }

    const categoryById = new Map((categoriesResult.data ?? []).map((row) => [String(row.id), String(row.name ?? 'Uncategorized')]));
    const unitById = new Map(
      (unitsResult.data ?? []).map((row) => [
        String(row.id),
        {
          abbreviation: String(row.abbreviation ?? ''),
          name: String(row.name ?? 'Unit'),
        },
      ]),
    );
    const lastMovementByItemId = new Map<string, string>();
    for (const row of ledgerResult.data ?? []) {
      const itemId = String(row.item_id ?? '');
      const transactionDate = String(row.transaction_date ?? '');
      if (itemId && transactionDate && !lastMovementByItemId.has(itemId)) {
        lastMovementByItemId.set(itemId, transactionDate);
      }
    }

    return NextResponse.json({
      data: rows.map((row: Record<string, unknown>) => {
        const item = row.items as {
          category_id?: string | null;
          id: string;
          code: string;
          name: string;
          item_type?: string;
          type?: string;
          price?: number | null;
          selling_price: number | null;
          unit_id?: string | null;
          unit_of_measure_id?: string | null;
          unit_price?: number | null;
          standard_cost?: number | null;
          unit_cost: number;
        };
        const unitId = String(item?.unit_of_measure_id ?? item?.unit_id ?? '');
        const qtyOnHand = Number(row.quantity_on_hand ?? 0);
        const unitCost = Number(item?.unit_cost ?? item?.standard_cost ?? 0);
        const sellingPrice = Number(item?.selling_price ?? item?.unit_price ?? item?.price ?? unitCost);
        return {
          id: row.id,
          item: {
            category: categoryById.get(String(item?.category_id ?? '')) ?? 'Uncategorized',
            code: item?.code,
            id: item?.id,
            itemType: item?.item_type ?? item?.type,
            lastMovementDate: lastMovementByItemId.get(String(item?.id ?? '')) ?? null,
            name: item?.name,
            unit: unitById.get(unitId) ?? { abbreviation: '', name: 'Unit' },
          },
          quantityOnHand: qtyOnHand,
          quantityAvailable: Number(row.quantity_available ?? 0),
          sellingPrice,
          unitCost,
          totalValue: qtyOnHand * unitCost,
          warehouse: {
            code: String(warehouse.code ?? ''),
            id: String(warehouse.id),
            name: String(warehouse.name ?? 'Branch warehouse'),
          },
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
