import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: supplier, error } = await service
      .from('suppliers')
      .select(
        `id, code, name, contact_person, phone, email, address,
         tax_number, payment_terms, credit_limit, current_balance, status, created_at,
         supplier_categories(id, name)`,
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (error || !supplier) return notFound('Supplier not found.');

    const s = supplier as Record<string, unknown>;

    return NextResponse.json({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.supplier_categories
        ? {
            id: (s.supplier_categories as Record<string, unknown>).id,
            name: (s.supplier_categories as Record<string, unknown>).name,
          }
        : null,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address,
      taxNumber: s.tax_number,
      paymentTerms: s.payment_terms,
      creditLimit: Number(s.credit_limit ?? 0),
      currentBalance: Number(s.current_balance ?? 0),
      status: s.status,
      createdAt: s.created_at,
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: {
    name?: string;
    categoryId?: string;
    code?: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    paymentTerms?: string | null;
    creditLimit?: number | null;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    // Ensure supplier exists
    const { data: existing, error: fetchErr } = await service
      .from('suppliers')
      .select('id, code, name, status')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Supplier not found.');

    const existingS = existing as Record<string, unknown>;

    // Validate category if provided
    if (body.categoryId) {
      const { data: cat } = await service
        .from('supplier_categories')
        .select('id')
        .eq('id', body.categoryId)
        .eq('organization_id', ctx.organizationId)
        .single();
      if (!cat) return badRequest('Supplier category not found.');
    }

    // Check code uniqueness if changed
    if (body.code && body.code !== (existingS.code as string)) {
      const { data: codeCheck } = await service
        .from('suppliers')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('code', body.code)
        .neq('id', id)
        .maybeSingle();
      if (codeCheck) return badRequest('Supplier code already exists.');
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.categoryId !== undefined) updatePayload.category_id = body.categoryId;
    if (body.code !== undefined) updatePayload.code = body.code;
    if (body.contactPerson !== undefined) updatePayload.contact_person = body.contactPerson;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.taxNumber !== undefined) updatePayload.tax_number = body.taxNumber;
    if (body.paymentTerms !== undefined) updatePayload.payment_terms = body.paymentTerms;
    if (body.creditLimit !== undefined) updatePayload.credit_limit = body.creditLimit;
    if (body.status !== undefined) updatePayload.status = body.status;

    const { data: updated, error: updateErr } = await service
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select('*, supplier_categories(id, name)')
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.delete')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .from('suppliers')
      .select('id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Supplier not found.');

    const { data: deleted, error: deleteErr } = await service
      .from('suppliers')
      .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
      .eq('id', id)
      .select()
      .single();

    if (deleteErr) return serverError(deleteErr.message);

    return NextResponse.json(deleted);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
