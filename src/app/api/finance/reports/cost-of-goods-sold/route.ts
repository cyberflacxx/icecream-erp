import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const service = financeService();
    let invoiceItemKey: 'item_id' | 'product_id' = 'item_id';
    let invoiceItemsResult = await service
      .from('invoice_items')
      .select('id, invoice_id, item_id, quantity, total_price, unit_price')
      .limit(500);
    if (invoiceItemsResult.error) {
      invoiceItemKey = 'product_id';
      invoiceItemsResult = await service
        .from('invoice_items')
        .select('id, invoice_id, product_id, quantity, total_price, unit_price')
        .limit(500) as typeof invoiceItemsResult;
    }
    if (invoiceItemsResult.error) throw invoiceItemsResult.error;

    const invoiceIds = [...new Set((invoiceItemsResult.data ?? []).map((row) => String(row.invoice_id ?? '')).filter(Boolean))];
    const itemIds = [...new Set((invoiceItemsResult.data ?? []).map((row) => String((row as Record<string, unknown>)[invoiceItemKey] ?? '')).filter(Boolean))];

    const [invoiceResult, itemResult] = await Promise.all([
      invoiceIds.length > 0
        ? service
            .from('invoices')
            .select('id, invoice_number, invoice_date, organization_id')
            .eq('organization_id', ctx.organizationId)
            .in('id', invoiceIds)
        : Promise.resolve({ data: [], error: null }),
      itemIds.length > 0
        ? service
            .from('items')
            .select('id, name, unit_cost, standard_cost')
            .in('id', itemIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    if (itemResult.error) throw itemResult.error;

    const invoiceById = new Map((invoiceResult.data ?? []).map((row) => [String(row.id), row]));
    const itemById = new Map((itemResult.data ?? []).map((row) => [String(row.id), row]));

    return NextResponse.json(
      (invoiceItemsResult.data ?? [])
        .map((row) => {
          const invoice = invoiceById.get(String(row.invoice_id ?? ''));
          if (!invoice || String(invoice.organization_id ?? '') !== ctx.organizationId) {
            return null;
          }

          const item = itemById.get(String((row as Record<string, unknown>)[invoiceItemKey] ?? ''));
          const quantity = Number(row.quantity ?? 0);
          const unitCost = Number(item?.unit_cost ?? item?.standard_cost ?? 0);

          return {
            costOfGoodsSold: quantity * unitCost,
            invoiceDate: invoice.invoice_date ?? null,
            invoiceNumber: invoice.invoice_number ?? null,
            item: item?.name ?? 'Unknown item',
            quantity,
            unitCost,
          };
        })
        .filter(Boolean),
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
