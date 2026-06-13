import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_product_prices')
      .select('id, item_id, price_list_code, selling_price, effective_date, expiry_date, is_active, items(code, name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
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
