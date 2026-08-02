import { NextRequest, NextResponse } from 'next/server';

import { apiServerError, badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { isMissingSalesColumn, logSalesRouteError, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const itemsResult = await service
      .from('items')
      .select('id, code, name, is_active')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true);
    if (itemsResult.error) throw itemsResult.error;

    const itemRows = (itemsResult.data ?? []) as Array<Record<string, unknown>>;
    const itemIds = itemRows.map((row) => String(row.id)).filter(Boolean);
    if (!itemIds.length) {
      return NextResponse.json([]);
    }

    let pricesResult = await service
      .from('sales_product_prices')
      .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active, created_at')
      .in('item_id', itemIds)
      .order('created_at', { ascending: false });

    if (pricesResult.error && isMissingSalesColumn(pricesResult.error, 'sales_product_prices', 'created_at')) {
      pricesResult = await service
        .from('sales_product_prices')
        .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active')
        .in('item_id', itemIds);
    }

    if (pricesResult.error) throw pricesResult.error;

    const rows = (pricesResult.data ?? []) as Array<Record<string, unknown>>;
    const itemsById = new Map(
      itemRows.map((item) => [
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
    return apiServerError({
      ctx,
      error: err,
      message: 'Sales prices could not be loaded for the selected organization.',
      module: 'sales.prices',
      path: '/api/sales/prices',
      status: 500,
    });
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
    if (body.sellingPrice <= 0) {
      return badRequest('Selling price must be greater than zero.');
    }

    const service = salesService();
    const itemResult = await service
      .from('items')
      .select('id, organization_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.itemId)
      .eq('is_active', true)
      .maybeSingle();
    if (itemResult.error) throw itemResult.error;
    if (!itemResult.data) {
      return badRequest('The selected item is inactive or outside this organization.');
    }

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
    return apiServerError({
      ctx,
      error: err,
      message: 'The sales price could not be saved.',
      module: 'sales.prices',
      path: '/api/sales/prices',
      status: 500,
      transactionReference: 'sales-price-create',
    });
  }
}
