import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingSalesColumn } from '@/lib/sales-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function mapLineTotals(items: Array<{ discountPercent?: number | null; quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscountTotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice * ((item.discountPercent ?? 0) / 100);
  }, 0);
  return { subtotal, lineDiscountTotal };
}

async function loadQuotationResponse(
  service: ReturnType<typeof createServiceRoleClient>,
  quotationId: string,
) {
  let quotationResult = await service
    .schema('icecream_erp')
    .from('quotations')
    .select('*')
    .eq('id', quotationId)
    .is('deleted_at', null)
    .single();

  if (quotationResult.error && isMissingSalesColumn(quotationResult.error, 'quotations', 'deleted_at')) {
    quotationResult = await service
      .schema('icecream_erp')
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .single();
  }

  if (quotationResult.error || !quotationResult.data) {
    return null;
  }

  const quotation = quotationResult.data as Record<string, unknown>;
  const customerId = String(quotation.customer_id ?? '');
  const quotationItemsResult = await service
    .schema('icecream_erp')
    .from('quotation_items')
    .select('*')
    .eq('quotation_id', quotationId);

  if (quotationItemsResult.error) throw quotationItemsResult.error;

  const quotationItems = (quotationItemsResult.data ?? []) as Array<Record<string, unknown>>;
  const itemIds = [...new Set(quotationItems.map((row) => String(row.item_id ?? '')).filter(Boolean))];

  const [customerResult, itemRowsResult] = await Promise.all([
    customerId
      ? service.schema('icecream_erp').from('customers').select('*').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    itemIds.length
      ? service.schema('icecream_erp').from('items').select('*').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (itemRowsResult.error) throw itemRowsResult.error;

  const itemRowsById = new Map(
    ((itemRowsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
  );

  return {
    ...quotation,
    customer: customerResult.data ?? null,
    customers: customerResult.data ?? null,
    quotation_items: quotationItems.map((row) => ({
      ...row,
      items: itemRowsById.get(String(row.item_id ?? '')) ?? null,
    })),
  };
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

  const data = await loadQuotationResponse(service, params.id);
  if (!data) return notFound('Quotation not found.');

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
  if (body.items && String(q.status ?? '').toUpperCase() !== 'DRAFT') {
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

  const result = await loadQuotationResponse(service, params.id);
  if (!result) return notFound('Quotation not found.');

  return NextResponse.json(result);
}
