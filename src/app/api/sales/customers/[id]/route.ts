import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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
    name?: string;
    customerType?: string;
    status?: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentTerms?: string;
    creditLimit?: number;
  };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.customerType !== undefined) updates.customer_type = body.customerType;
  if (body.status !== undefined) updates.status = body.status;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.address !== undefined) updates.address = body.address;
  if (body.paymentTerms !== undefined) updates.payment_terms = body.paymentTerms;
  if (body.creditLimit !== undefined) updates.credit_limit = body.creditLimit;

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
