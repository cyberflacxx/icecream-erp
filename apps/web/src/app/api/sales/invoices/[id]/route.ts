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

function normalizeInvoiceStatus(amountPaid: number, total: number): string {
  if (amountPaid <= 0) return 'sent';
  if (amountPaid >= total) return 'paid';
  return 'partial_paid';
}

// ─── GET /api/sales/invoices/[id] ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();

  const { data, error } = await service
    .schema('icecream_erp')
    .from('invoices')
    .select(`*, customers(*), invoice_items(*, items(*))`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return notFound('Invoice not found.');

  const inv = data as Record<string, unknown>;

  // Branch scoping: check via linked sales order
  if (ctx.isBranchScoped && ctx.branchId && inv.sales_order_id) {
    const { data: order } = await service
      .schema('icecream_erp')
      .from('sales_orders')
      .select('branch_id')
      .eq('id', inv.sales_order_id as string)
      .single();

    const orderBranchId = (order as Record<string, unknown> | null)?.branch_id;
    if (orderBranchId && orderBranchId !== ctx.branchId) {
      return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
    }
  }

  return NextResponse.json(data);
}

// ─── PATCH /api/sales/invoices/[id] ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  const service = createServiceRoleClient();

  const { data: existing, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('invoices')
    .select(`*, invoice_items(*)`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return notFound('Invoice not found.');

  const inv = existing as Record<string, unknown>;

  if (inv.status === 'paid' || inv.status === 'cancelled') {
    return NextResponse.json({ error: 'Paid or cancelled invoices cannot be edited.' }, { status: 400 });
  }

  const currentItems = (inv.invoice_items as Array<Record<string, unknown>>) ?? [];

  const body = await request.json() as {
    status?: string;
    invoiceDate?: string;
    dueDate?: string | null;
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

  const nextItems = body.items
    ? body.items.map((i) => ({ discountPercent: i.discountPercent, quantity: i.quantity, unitPrice: i.unitPrice }))
    : currentItems.map((i) => ({
        discountPercent: i.discount_percent !== null ? Number(i.discount_percent) : undefined,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
      }));

  const discountAmount = body.discountAmount !== undefined ? body.discountAmount : Number(inv.discount_amount ?? 0);
  const taxAmount = body.taxAmount !== undefined ? body.taxAmount : Number(inv.tax_amount ?? 0);
  const { subtotal, lineDiscountTotal } = mapLineTotals(nextItems);
  const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;
  const amountPaid = Number(inv.amount_paid ?? 0);
  const balanceDue = Math.max(0, total - amountPaid);

  const updates: Record<string, unknown> = {
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total,
    balance_due: balanceDue,
    status: body.status ?? normalizeInvoiceStatus(amountPaid, total),
    updated_at: new Date().toISOString(),
  };
  if (body.invoiceDate !== undefined) updates.invoice_date = body.invoiceDate;
  if (body.dueDate !== undefined) updates.due_date = body.dueDate;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { error: updateErr } = await service
    .schema('icecream_erp')
    .from('invoices')
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
      return NextResponse.json({ error: 'One or more invoice items are invalid.' }, { status: 400 });
    }

    await service
      .schema('icecream_erp')
      .from('invoice_items')
      .delete()
      .eq('invoice_id', params.id);

    await service
      .schema('icecream_erp')
      .from('invoice_items')
      .insert(
        body.items.map((item) => ({
          invoice_id: params.id,
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
    .from('invoices')
    .select(`*, customers(*), invoice_items(*, items(*))`)
    .eq('id', params.id)
    .single();

  if (resultErr) return serverError(resultErr.message);

  return NextResponse.json(result);
}
