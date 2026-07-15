import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { isMissingSalesColumn, logSalesRouteError, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    let pricesResult = await service
      .from('sales_product_prices')
      .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active, created_at')
      .order('created_at', { ascending: false });

    if (pricesResult.error && isMissingSalesColumn(pricesResult.error, 'sales_product_prices', 'created_at')) {
      pricesResult = await service
        .from('sales_product_prices')
        .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active');
    }

    if (pricesResult.error) throw pricesResult.error;

    const rows = (pricesResult.data ?? []) as Array<Record<string, unknown>>;
    const itemIds = [...new Set(rows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
    const itemsResult = itemIds.length
      ? await service.from('items').select('id, code, name').in('id', itemIds)
      : { data: [], error: null };

    if (itemsResult.error) throw itemsResult.error;

    const itemsById = new Map(
      ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((item) => [
        String(item.id),
        {
          code: item.code ? String(item.code) : '',
          name: item.name ? String(item.name) : '',
        },
      ]),
    );

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        items: itemsById.get(String(row.item_id ?? '')) ?? null,
      })),
    );
  } catch (err) {
    logSalesRouteError('prices', 'load price list', err);
    return serverError('Sales prices could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      effectiveDate?: string;
      expiryDate?: string;
      itemId: string;
      priceListCode: string;
      sellingPrice: number;
    };
    if (!body.itemId || !body.priceListCode) return badRequest('itemId and priceListCode are required.');
    ensureNonNegative(body.sellingPrice, 'sellingPrice');

    const service = salesService();
    const { data, error } = await service
      .from('sales_product_prices')
      .insert({
        created_by: ctx.userId,
        effective_date: body.effectiveDate ?? null,
        expiry_date: body.expiryDate ?? null,
        is_active: true,
        item_id: body.itemId,
        price_list_code: body.priceListCode,
        selling_price: body.sellingPrice,
      })
      .select()
      .single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_PRICE_CREATED', String(data.id), ctx.userId, data, 'sales_product_price');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
