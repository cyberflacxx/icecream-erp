import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read', 'procurement.supplier.view', 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const primary = await service
      .from('suppliers')
      .select(
        `id, code, name, contact_person, phone, email, address,
         tax_number, payment_terms, credit_limit, current_balance, status, created_at, document_name, document_url,
         supplier_categories(id, name)`,
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    let supplier = (primary.data as Record<string, unknown> | null) ?? null;
    let errorMessage = primary.error?.message ?? null;

    if (
      primary.error &&
      (
        isMissingColumnError(primary.error, 'suppliers', 'tax_number') ||
        isMissingColumnError(primary.error, 'suppliers', 'current_balance') ||
        isMissingColumnError(primary.error, 'suppliers', 'deleted_at')
      )
    ) {
      const fallback = await service
        .from('suppliers')
        .select(
          `id, code, name, contact_person, phone, email, address,
           payment_terms, credit_limit, status, created_at, document_name, document_url,
           supplier_categories(id, name)`,
        )
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .single();
      supplier = (fallback.data as Record<string, unknown> | null) ?? null;
      errorMessage = fallback.error?.message ?? null;
    }

    if (errorMessage) return serverError(errorMessage);
    if (!supplier) return notFound('Supplier not found.');

    return NextResponse.json({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      category: supplier.supplier_categories
        ? {
            id: (supplier.supplier_categories as Record<string, unknown>).id,
            name: (supplier.supplier_categories as Record<string, unknown>).name,
          }
        : null,
      contactPerson: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      taxNumber: supplier.tax_number ?? null,
      paymentTerms: supplier.payment_terms,
      creditLimit: Number(supplier.credit_limit ?? 0),
      currentBalance: Number(supplier.current_balance ?? 0),
      documentName: supplier.document_name ?? null,
      documentUrl: supplier.document_url ?? null,
      status: supplier.status,
      createdAt: supplier.created_at,
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
  if (!can(ctx, 'suppliers.write', 'procurement.supplier.write', 'procurement.write')) return forbidden();

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
    documentName?: string | null;
    documentUrl?: string | null;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    // Ensure supplier exists
    let { data: existing, error: fetchErr } = await service
      .from('suppliers')
      .select('id, code, name, status')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr && isMissingColumnError(fetchErr, 'suppliers', 'deleted_at')) {
      const fallback = await service
        .from('suppliers')
        .select('id, code, name, status')
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .single();
      existing = fallback.data;
      fetchErr = fallback.error;
    }

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
    if (body.name !== undefined) {
      if (!body.name.trim()) return badRequest('Supplier name is required.');
      updatePayload.name = body.name.trim();
    }
    if (body.categoryId !== undefined) updatePayload.category_id = body.categoryId;
    if (body.code !== undefined) {
      if (!body.code.trim()) return badRequest('Supplier code is required.');
      updatePayload.code = body.code.trim();
    }
    if (body.contactPerson !== undefined) updatePayload.contact_person = body.contactPerson;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.taxNumber !== undefined) updatePayload.tax_number = body.taxNumber;
    if (body.paymentTerms !== undefined) updatePayload.payment_terms = body.paymentTerms;
    if (body.documentName !== undefined) updatePayload.document_name = body.documentName;
    if (body.documentUrl !== undefined) updatePayload.document_url = body.documentUrl;
    if (body.creditLimit !== undefined) {
      if (Number(body.creditLimit) < 0) return badRequest('Credit limit cannot be negative.');
      updatePayload.credit_limit = body.creditLimit;
    }
    if (body.status !== undefined) updatePayload.status = body.status;

    let { data: updated, error: updateErr } = await service
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select('*, supplier_categories(id, name)')
      .single();

    if (updateErr && isMissingColumnError(updateErr, 'suppliers', 'tax_number')) {
      const { tax_number, ...fallbackPayload } = updatePayload;
      const fallback = await service
        .from('suppliers')
        .update(fallbackPayload)
        .eq('id', id)
        .select('*, supplier_categories(id, name)')
        .single();
      updated = fallback.data;
      updateErr = fallback.error;
    }

    if (updateErr) return serverError(updateErr.message);

    await recordAuditLog({
      action: 'SUPPLIER_UPDATED',
      entityId: id,
      entityType: 'supplier',
      ipAddress: request.headers.get('x-forwarded-for'),
      newValues: updatePayload,
      oldValues: existingS,
      organizationId: ctx.organizationId,
      userAgent: request.headers.get('user-agent'),
      userProfileId: ctx.userId,
    });

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
  if (!can(ctx, 'suppliers.delete', 'procurement.supplier.write')) return forbidden();

  await params;
  return badRequest('Supplier deletion is disabled. Use the deactivate action instead.');
}
