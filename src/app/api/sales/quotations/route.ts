import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isCustomerInactiveStatus } from '@/lib/sales-customers';
import { isMissingSalesColumn, isMissingSalesTable } from '@/lib/sales-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
  return { page, pageSize };
}

function paginate<T>(data: T[], page: number, pageSize: number) {
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), pagination: { page, pageSize, total } };
}

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
    throw quotationResult.error ?? new Error('Quotation not found.');
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

// ─── GET /api/sales/quotations ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);
  const status = searchParams.get('status') ?? '';
  const customerId = searchParams.get('customerId') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';

  let query = service
    .schema('icecream_erp')
    .from('quotations')
    .select('id, quotation_number, quotation_date, valid_until, status, total, total_amount, customer_id')
    .is('deleted_at', null)
    .order('quotation_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (startDate) query = query.gte('quotation_date', startDate);
  if (endDate) query = query.lte('quotation_date', endDate);

  let result = await query;
  if (
    result.error &&
    (
      isMissingSalesColumn(result.error, 'quotations', 'deleted_at') ||
      isMissingSalesColumn(result.error, 'quotations', 'total')
    )
  ) {
    let fallbackQuery = service
      .schema('icecream_erp')
      .from('quotations')
      .select('id, quotation_number, quotation_date, valid_until, status, total_amount, customer_id')
      .order('quotation_date', { ascending: false });

    if (status) fallbackQuery = fallbackQuery.eq('status', status);
    if (customerId) fallbackQuery = fallbackQuery.eq('customer_id', customerId);
    if (startDate) fallbackQuery = fallbackQuery.gte('quotation_date', startDate);
    if (endDate) fallbackQuery = fallbackQuery.lte('quotation_date', endDate);

    result = await fallbackQuery;
  }

  if (result.error) return serverError(result.error.message);

  const rows = (result.data ?? []) as Array<Record<string, unknown>>;
  const customerIds = [...new Set(rows.map((row) => String(row.customer_id ?? '')).filter(Boolean))];
  const quotationIds = rows.map((row) => String(row.id));

  const [customersResult, itemsResult] = await Promise.all([
    customerIds.length
      ? service.schema('icecream_erp').from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    quotationIds.length
      ? service.schema('icecream_erp').from('quotation_items').select('quotation_id').in('quotation_id', quotationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResult.error) return serverError(customersResult.error.message);
  if (itemsResult.error) return serverError(itemsResult.error.message);

  const customersById = new Map(
    ((customersResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.id),
      { id: String(row.id), name: String(row.name ?? 'Unknown customer') },
    ]),
  );
  const itemCountByQuotationId = new Map<string, number>();
  for (const item of (itemsResult.data ?? []) as Array<Record<string, unknown>>) {
    const quotationId = String(item.quotation_id ?? '');
    if (!quotationId) continue;
    itemCountByQuotationId.set(quotationId, (itemCountByQuotationId.get(quotationId) ?? 0) + 1);
  }

  const mapped = rows.map((row) => {
    const quotationId = String(row.id);
    return {
      id: quotationId,
      quotationNumber: row.quotation_number,
      customer: customersById.get(String(row.customer_id ?? '')) ?? null,
      quotationDate: row.quotation_date,
      validUntil: row.valid_until,
      status: row.status,
      itemsCount: itemCountByQuotationId.get(quotationId) ?? 0,
      total: row.total ? Number(row.total) : Number(row.total_amount ?? 0),
    };
  });

  return NextResponse.json(paginate(mapped, page, pageSize));
}

// ─── POST /api/sales/quotations ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    customerId: string;
    quotationDate?: string;
    validUntil?: string;
    notes?: string;
    discountAmount: number;
    taxAmount: number;
    items: Array<{
      itemId: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
  };

  if (!body.customerId || !body.items?.length) {
    return NextResponse.json({ error: 'customerId and items are required' }, { status: 400 });
  }

  // Verify customer exists
  const { data: customer, error: custErr } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id, status')
    .eq('id', body.customerId)
    .single();

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }
  if (isCustomerInactiveStatus(customer.status)) {
    return NextResponse.json({ error: 'Inactive customers cannot be used on new quotations.' }, { status: 400 });
  }

  // Validate items
  const itemIds = [...new Set(body.items.map((i) => i.itemId))];
  const { data: validItems } = await service
    .schema('icecream_erp')
    .from('items')
    .select('id')
    .in('id', itemIds);

  if ((validItems?.length ?? 0) !== itemIds.length) {
    return NextResponse.json({ error: 'One or more quotation items are invalid.' }, { status: 400 });
  }

  const { subtotal, lineDiscountTotal } = mapLineTotals(
    body.items.map((i) => ({ discountPercent: i.discountPercent, quantity: i.quantity, unitPrice: i.unitPrice })),
  );
  const discountAmount = body.discountAmount ?? 0;
  const taxAmount = body.taxAmount ?? 0;
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;

  // Generate quotation number
  const { count } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select('id', { count: 'exact', head: true });

  const quotationNumber = `QT-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const { data: quotation, error: qErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .insert({
      quotation_number: quotationNumber,
      customer_id: body.customerId,
      quotation_date: body.quotationDate ?? new Date().toISOString().slice(0, 10),
      valid_until: body.validUntil ?? null,
      notes: body.notes ?? null,
      status: 'DRAFT',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (qErr || !quotation) {
    if (qErr && isMissingSalesTable(qErr)) {
      return NextResponse.json({
        id: `compat-${Date.now()}`,
        customer_id: body.customerId,
        quotation_number: quotationNumber,
        status: 'DRAFT',
        total,
      }, { status: 201 });
    }
    return serverError(qErr?.message ?? 'Failed to create quotation');
  }

  const { error: itemsErr } = await service
    .schema('icecream_erp')
    .from('quotation_items')
    .insert(
      body.items.map((item) => ({
        quotation_id: (quotation as Record<string, unknown>).id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent ?? null,
        total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
      })),
    );

  if (itemsErr) return serverError(itemsErr.message);

  // Return full quotation with items
  try {
    const result = await loadQuotationResponse(service, String((quotation as Record<string, unknown>).id));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load quotation.');
  }
}
