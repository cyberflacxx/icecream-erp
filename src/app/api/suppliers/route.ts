import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const OPTIONAL_SUPPLIER_COLUMNS = ['current_balance', 'deleted_at', 'document_name', 'document_url', 'tax_number'] as const;

function stripMissingSupplierColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const entry = OPTIONAL_SUPPLIER_COLUMNS.find((column) => isMissingColumnError(error, 'suppliers', column));
  if (!entry) return null;

  const nextPayload = { ...payload };
  delete nextPayload[entry];
  return nextPayload;
}

function getForwardedIpAddress(headerValue: string | null) {
  return headerValue?.split(',')[0]?.trim() || null;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read', 'procurement.supplier.view', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const categoryId = searchParams.get('categoryId');

  try {
    const buildPrimaryQuery = () =>
      service
        .from('suppliers')
        .select(
          `id, code, name, contact_person, phone, email, address,
           category_id, tax_number, payment_terms, credit_limit, current_balance, credit_days, status, rating, notes,
           document_name, document_url`,
          { count: 'exact' },
        )
        .eq('organization_id', ctx.organizationId)
        .order('name');

    const buildFallbackQuery = () =>
      service
        .from('suppliers')
        .select(
          `id, code, name, contact_person, phone, email, address,
           category_id, payment_terms, credit_limit, credit_days, status, rating, notes,
           document_name, document_url`,
          { count: 'exact' },
        )
        .eq('organization_id', ctx.organizationId)
        .order('name');

    let query = buildPrimaryQuery();

    const applyFilters = <
      T extends {
        eq(column: string, value: unknown): T;
        or(filters: string): T;
      },
    >(input: T) => {
      let next = input;
      if (status) next = next.eq('status', status);
      if (categoryId) next = next.eq('category_id', categoryId);
      if (search) {
        next = next.or(
          `code.ilike.%${search}%,name.ilike.%${search}%,contact_person.ilike.%${search}%`,
        );
      }
      return next;
    };

    query = applyFilters(query);

    const from = (page - 1) * pageSize;
    const primary = await query.range(from, from + pageSize - 1);
    let rows = ((primary.data ?? []) as unknown) as Record<string, unknown>[];
    let total = primary.count ?? 0;
    let errorMessage = primary.error?.message ?? null;

    if (primary.error && OPTIONAL_SUPPLIER_COLUMNS.some((column) => isMissingColumnError(primary.error, 'suppliers', column))) {
      const fallback = await applyFilters(buildFallbackQuery()).range(from, from + pageSize - 1);
      rows = ((fallback.data ?? []) as unknown) as Record<string, unknown>[];
      total = fallback.count ?? 0;
      errorMessage = fallback.error?.message ?? null;
    }

    if (errorMessage) return serverError(errorMessage);
    const categoryIds = [...new Set(rows.map((row) => String(row.category_id ?? '')).filter(Boolean))];
    const categoriesResult = categoryIds.length
      ? await service.from('supplier_categories').select('id, name').in('id', categoryIds)
      : { data: [], error: null };
    if (categoriesResult.error) return serverError(categoriesResult.error.message);
    const categories = new Map((categoriesResult.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));

    const mapped = rows.map((r) => {
      const category = categories.get(String(r.category_id ?? '')) ?? null;
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        category: category
          ? {
              id: category.id,
              name: category.name,
            }
          : null,
        contactPerson: r.contact_person,
        phone: r.phone,
        email: r.email,
        address: r.address,
        taxNumber: r.tax_number ?? null,
        paymentTerms: r.payment_terms,
        creditLimit: Number(r.credit_limit ?? 0),
        currentBalance: Number(r.current_balance ?? 0),
        documentName: r.document_name ?? null,
        documentUrl: r.document_url ?? null,
        status: r.status,
      };
    });

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.write', 'procurement.supplier.write', 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    name: string;
    categoryId: string;
    code?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    paymentTerms?: string | null;
    creditLimit?: number | null;
    documentName?: string | null;
    documentUrl?: string | null;
    status: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const name = body.name?.trim();
  const codeInput = body.code?.trim();
  if (!name) {
    return badRequest('Supplier name is required.');
  }
  if (body.creditLimit !== undefined && Number(body.creditLimit) < 0) {
    return badRequest('Credit limit cannot be negative.');
  }
  if (!body.status) {
    return badRequest('Supplier status is required.');
  }

  try {
    let categoryId = body.categoryId;
    if (!categoryId) {
      const existing = await service
        .from('supplier_categories')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .ilike('name', 'General')
        .maybeSingle();
      if (existing.error) return serverError(existing.error.message);

      if (existing.data?.id) {
        categoryId = existing.data.id;
      } else {
        const created = await service
          .from('supplier_categories')
          .insert({ organization_id: ctx.organizationId, name: 'General' })
          .select('id')
          .single();
        if (created.error || !created.data) return serverError(created.error?.message ?? 'Failed to create default supplier category.');
        categoryId = created.data.id;
      }
    }

    // Validate category
    const { data: category, error: catErr } = await service
      .from('supplier_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (catErr || !category) return badRequest('Supplier category not found.');

    // Generate code
    const { count: supplierCount } = await service
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const code = codeInput || `SUP-${String((supplierCount ?? 0) + 1).padStart(5, '0')}`;

    // Check code uniqueness
    const { data: codeCheck } = await service
      .from('suppliers')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('code', code)
      .maybeSingle();

    if (codeCheck) return badRequest('Supplier code already exists.');

    const insertPayload = {
      name: body.name,
      tax_number: body.taxNumber ?? null,
      category_id: categoryId,
      code,
      contact_person: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
      payment_terms: body.paymentTerms ?? null,
      credit_limit: body.creditLimit ?? null,
      document_name: body.documentName ?? null,
      document_url: body.documentUrl ?? null,
      status: body.status,
      organization_id: ctx.organizationId,
    };

    let { data: supplier, error: supErr } = await service
      .from('suppliers')
      .insert(insertPayload)
      .select()
      .single();

    let retryPayload: Record<string, unknown> | null = insertPayload;
    while (supErr && retryPayload) {
      retryPayload = stripMissingSupplierColumn(retryPayload, supErr);
      if (!retryPayload) break;

      const fallback = await service.from('suppliers').insert(retryPayload).select().single();
      supplier = fallback.data;
      supErr = fallback.error;
    }

    if (supErr) {
      if (supErr.code === '23505') return badRequest('Supplier code already exists.');
      return serverError(supErr.message);
    }

    await recordAuditLog({
      action: 'SUPPLIER_CREATED',
      entityId: String((supplier as Record<string, unknown>).id),
      entityType: 'supplier',
      ipAddress: getForwardedIpAddress(request.headers.get('x-forwarded-for')),
      newValues: {
        code,
        creditLimit: body.creditLimit ?? null,
        documentName: body.documentName ?? null,
        documentUrl: body.documentUrl ?? null,
        name,
        paymentTerms: body.paymentTerms ?? null,
        status: body.status,
      },
      organizationId: ctx.organizationId,
      userAgent: request.headers.get('user-agent'),
      userProfileId: ctx.userAccountId ?? ctx.userId,
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
