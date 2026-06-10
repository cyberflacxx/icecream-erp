import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
    .select(`
      id, quotation_number, quotation_date, valid_until, status, total,
      customers!inner(id, name),
      quotation_items(id)
    `)
    .is('deleted_at', null)
    .order('quotation_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (startDate) query = query.gte('quotation_date', startDate);
  if (endDate) query = query.lte('quotation_date', endDate);

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const customer = row.customers as { id: string; name: string } | null;
    const items = (row.quotation_items as unknown[]) ?? [];
    return {
      id: row.id,
      quotationNumber: row.quotation_number,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      quotationDate: row.quotation_date,
      validUntil: row.valid_until,
      status: row.status,
      itemsCount: items.length,
      total: row.total ? Number(row.total) : 0,
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
    .select('id')
    .eq('id', body.customerId)
    .is('deleted_at', null)
    .single();

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  // Validate items
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
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (qErr || !quotation) return serverError(qErr?.message ?? 'Failed to create quotation');

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
  const { data: result, error: resultErr } = await service
    .schema('icecream_erp')
    .from('quotations')
    .select(`*, customers(*), quotation_items(*, items(*))`)
    .eq('id', (quotation as Record<string, unknown>).id)
    .single();

  if (resultErr) return serverError(resultErr.message);

  return NextResponse.json(result, { status: 201 });
}
