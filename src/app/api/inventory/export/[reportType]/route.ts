import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildOpeningClosingRows, deriveSupplierShortages, toCsv, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

const REPORT_TYPES = new Set([
  'stock-movement',
  'valuation',
  'opening-closing',
  'supplier-shortages',
  'branch-stock',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read', 'finance.read')) return forbidden();

  const { reportType } = await params;
  if (!REPORT_TYPES.has(reportType)) {
    return badRequest('Unsupported inventory report export.');
  }

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  try {
    let rows: Array<Record<string, string | number | null>> = [];

    if (reportType === 'stock-movement') {
      const { data, error } = await service
        .from('stock_movements')
        .select(
          `movement_type, quantity, unit_cost, total_cost, created_at,
           items!item_id(code, name),
           warehouses!warehouse_id(code, name)`,
        )
        .order('created_at', { ascending: false });
      if (error) return serverError(error.message);

      rows = (data ?? []).map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
        return {
          createdAt: String(row.created_at),
          itemCode: String(item?.code ?? ''),
          itemName: String(item?.name ?? ''),
          movementType: String(row.movement_type ?? ''),
          quantity: toNumber(row.quantity),
          unitCost: toNumber(row.unit_cost),
          totalCost: toNumber(row.total_cost),
          warehouseCode: String(warehouse?.code ?? ''),
          warehouseName: String(warehouse?.name ?? ''),
        };
      });
    } else if (reportType === 'valuation' || reportType === 'branch-stock') {
      const { data, error } = await service
        .from('stock_balances')
        .select(
          `quantity_on_hand, quantity_available,
           items!item_id(code, name, item_type, unit_cost),
           warehouses!warehouse_id(code, name, branches!branch_id(code, name))`,
        );
      if (error) return serverError(error.message);

      rows = (data ?? []).map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
        const branch = Array.isArray(warehouse?.branches) ? warehouse.branches[0] : warehouse?.branches;
        const quantityOnHand = toNumber(row.quantity_on_hand);
        const unitCost = toNumber(item?.unit_cost);
        return {
          branchCode: String(branch?.code ?? ''),
          branchName: String(branch?.name ?? ''),
          itemCode: String(item?.code ?? ''),
          itemName: String(item?.name ?? ''),
          itemType: String(item?.item_type ?? ''),
          quantityAvailable: toNumber(row.quantity_available),
          quantityOnHand,
          stockValue: quantityOnHand * unitCost,
          unitCost,
          warehouseCode: String(warehouse?.code ?? ''),
          warehouseName: String(warehouse?.name ?? ''),
        };
      });
    } else if (reportType === 'opening-closing') {
      const { data, error } = await service
        .from('stock_movements')
        .select(
          `item_id, warehouse_id, movement_type, quantity, unit_cost, created_at,
           items!item_id(code, name, item_type, unit_cost),
           warehouses!warehouse_id(name)`,
        )
        .order('created_at', { ascending: true });
      if (error) return serverError(error.message);
      rows = buildOpeningClosingRows(
        (data ?? []) as Array<Record<string, unknown>>,
        startDate,
        endDate,
      ) as Array<Record<string, string | number | null>>;
    } else if (reportType === 'supplier-shortages') {
      const { data, error } = await service
        .from('purchase_orders')
        .select(
          `id, po_number, expected_delivery_date, suppliers(id, name),
           purchase_order_items(item_id, quantity_ordered, quantity_received, items(id, code, name))`,
        );
      if (error) return serverError(error.message);
      rows = deriveSupplierShortages((data ?? []) as Array<Record<string, unknown>>);
    }

    const csv = toCsv(rows);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="inventory-${reportType}-${dateStamp}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to export inventory report');
  }
}
