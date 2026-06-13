import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { validateCustomerCodeUniqueness } from '@/lib/sales';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── GET /api/sales/customers/[id] ───────────────────────────────────────────

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
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return notFound('Customer not found.');

  return NextResponse.json(data);
}

// ─── PATCH /api/sales/customers/[id] ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Verify exists
  const { data: existing, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return notFound('Customer not found.');

  const body = await request.json() as {
    address?: string | null;
    code?: string;
    creditAllowed?: boolean;
    creditLimit?: number | null;
    currentBalance?: number | null;
    customerGroupId?: string | null;
    customerType?: string;
    email?: string;
    name?: string;
    paymentTerms?: string;
    phone?: string;
    priceListCode?: string | null;
    status?: string;
    taxNumber?: string | null;
  };

  if (body.code !== undefined) {
    const { data: existingCodes, error: codesError } = await service
      .schema('icecream_erp')
      .from('customers')
      .select('id, code')
      .neq('id', params.id)
      .is('deleted_at', null);

    if (codesError) return serverError(codesError.message);
    if (!validateCustomerCodeUniqueness((existingCodes ?? []).map((row) => String(row.code ?? '')), body.code)) {
      return NextResponse.json({ error: 'Customer code already exists.' }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.code !== undefined) updates.code = body.code;
  if (body.name !== undefined) updates.name = body.name;
  if (body.customerType !== undefined) updates.customer_type = body.customerType;
  if (body.status !== undefined) updates.status = body.status;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.address !== undefined) updates.address = body.address;
  if (body.paymentTerms !== undefined) updates.payment_terms = body.paymentTerms;
  if (body.creditLimit !== undefined) updates.credit_limit = body.creditLimit;
  if (body.creditAllowed !== undefined) updates.credit_allowed = body.creditAllowed;
  if (body.customerGroupId !== undefined) updates.customer_group_id = body.customerGroupId;
  if (body.priceListCode !== undefined) updates.price_list_code = body.priceListCode;
  if (body.taxNumber !== undefined) updates.tax_number = body.taxNumber;
  if (body.currentBalance !== undefined) updates.current_balance = body.currentBalance;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await service
    .schema('icecream_erp')
    .from('customers')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}

// ─── DELETE /api/sales/customers/[id] ────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Verify exists
  const { data: existing, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !existing) return notFound('Customer not found.');

  const { data, error } = await service
    .schema('icecream_erp')
    .from('customers')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
