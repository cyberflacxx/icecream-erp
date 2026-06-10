import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/customer-returns ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    customerId: string;
    invoiceId?: string;
    reason: string;
    returnDate?: string;
    totalValue: number;
  };

  if (!body.customerId || !body.reason || body.totalValue === undefined) {
    return NextResponse.json(
      { error: 'customerId, reason, and totalValue are required' },
      { status: 400 },
    );
  }

  // Verify customer exists
  const { data: customer } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id')
    .eq('id', body.customerId)
    .is('deleted_at', null)
    .single();

  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });

  // Verify invoice if provided
  if (body.invoiceId) {
    const { data: inv } = await service
      .schema('icecream_erp')
      .from('invoices')
      .select('id')
      .eq('id', body.invoiceId)
      .is('deleted_at', null)
      .single();

    if (!inv) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  // Generate return number
  const { count } = await service
    .schema('icecream_erp')
    .from('customer_returns')
    .select('id', { count: 'exact', head: true });

  const returnNumber = `CRN-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const { data, error } = await service
    .schema('icecream_erp')
    .from('customer_returns')
    .insert({
      return_number: returnNumber,
      customer_id: body.customerId,
      invoice_id: body.invoiceId ?? null,
      reason: body.reason,
      return_date: body.returnDate ?? new Date().toISOString().slice(0, 10),
      total_value: body.totalValue,
      status: 'draft',
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
