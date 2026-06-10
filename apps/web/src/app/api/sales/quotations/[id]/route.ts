import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function mapLineTotals(items: Array<{ discountPercent?: number | null; quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscountTotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice * ((item.discountPercent ?? 0) / 100);
  }, 0);
  return { subtotal, lineDiscountTotal };
}

// ─── GET /api/sales/quotations/[id] ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();

  const { data, error } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select(`*, customers(*), quotation_items(*, items(*))`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return notFound('Quotation not found.');

  return NextResponse.json(data);
}

// ─── PATCH /api/sales/quotations/[id] ────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Fetch current quotation
  const { data: existing, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select(`*, quotation_items(*)`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return notFound('Quotation not found.');

  const q = existing as Record<string, unknown>;
  const currentItems = (q.quotation_items as Array<Record<string, unknown>>) ?? [];

  const body = await request.json() as {
    status?: string;
    quotationDate?: string;
    validUntil?: string | null;
    notes?: string;
    discountAmount?: number;
    taxAmount?: number;
    items?: Array<{
      itemId: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
  };

  // Guard: line items can only change on draft
  if (body.items && q.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft quotations can modify line items.' }, { status: 400 });
  }

  const nextItems = body.items
    ? body.items.map((i) => ({ discountPercent: i.discountPercent, quantity: i.quantity, unitPrice: i.unitPrice }))
    : currentItems.map((i) => ({
        discountPercent: i.discount_percent ? Number(i.discount_percent) : 0,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
      }));

  const discountAmount = body.discountAmount !== undefined ? body.discountAmount : Number(q.discount_amount ?? 0);
  const taxAmount = body.taxAmount !== undefined ? body.taxAmount : Number(q.tax_amount ?? 0);
  const { subtotal, lineDiscountTotal } = mapLineTotals(nextItems);
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;

  const updates: Record<string, unknown> = {
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total,
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) updates.status = body.status;
  if (body.quotationDate !== undefined) updates.quotation_date = body.quotationDate;
  if (body.validUntil !== undefined) updates.valid_until = body.validUntil;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { error: updateErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .update(updates)
    .eq('id', params.id);

  if (updateErr) return serverError(updateErr.message);

  // Replace items if provided
  if (body.items) {
    const itemIds = [...new Set(body.items.map((i) => i.itemId))];
    const { data: validItems } = await service
      .schema('icecream_erp')
      .from('items')
      .select('id')
      .in('id', itemIds)
      .is('deleted_at', null);

    if ((validItems?.length ?? 0) !== itemIds.length) {
      return NextResponse.json({ error: 'One or more quotation items are invalid.' }, { status: 400 });
    }

    await service
      .schema('icecream_erp')
      .from('quotation_items')
      .delete()
      .eq('quotation_id', params.id);

    await service
      .schema('icecream_erp')
      .from('quotation_items')
      .insert(
        body.items.map((item) => ({
          quotation_id: params.id,
          item_id: item.itemId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent ?? null,
          total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
        })),
      );
  }

  const { data: result, error: resultErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select(`*, customers(*), quotation_items(*, items(*))`)
    .eq('id', params.id)
    .single();

  if (resultErr) return serverError(resultErr.message);

  return NextResponse.json(result);
}
