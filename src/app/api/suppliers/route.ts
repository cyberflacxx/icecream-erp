import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const categoryId = searchParams.get('categoryId');

  try {
    let query = service
      .from('suppliers')
      .select(
        `id, code, name, contact_person, phone, email, address,
         tax_number, payment_terms, credit_limit, current_balance, status,
         supplier_categories(id, name)`,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('name');

    if (status) query = query.eq('status', status);
    if (categoryId) query = query.eq('category_id', categoryId);
    if (search) {
      query = query.or(
        `code.ilike.%${search}%,name.ilike.%${search}%,contact_person.ilike.%${search}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);

    if (error) return serverError(error.message);

    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.supplier_categories
        ? {
            id: (r.supplier_categories as Record<string, unknown>).id,
            name: (r.supplier_categories as Record<string, unknown>).name,
          }
        : null,
      contactPerson: r.contact_person,
      phone: r.phone,
      email: r.email,
      address: r.address,
      taxNumber: r.tax_number,
      paymentTerms: r.payment_terms,
      creditLimit: Number(r.credit_limit ?? 0),
      currentBalance: Number(r.current_balance ?? 0),
      status: r.status,
    }));

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.write')) return forbidden();

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
    status: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.name || !body.categoryId || !body.status) {
    return badRequest('name, categoryId, and status are required');
  }

  try {
    // Validate category
    const { data: category, error: catErr } = await service
      .from('supplier_categories')
      .select('id')
      .eq('id', body.categoryId)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (catErr || !category) return badRequest('Supplier category not found.');

    // Generate code
    const { count: supplierCount } = await service
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const code = body.code?.trim() || `SUP-${String((supplierCount ?? 0) + 1).padStart(5, '0')}`;

    // Check code uniqueness
    const { data: codeCheck } = await service
      .from('suppliers')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('code', code)
      .maybeSingle();

    if (codeCheck) return badRequest('Supplier code already exists.');

    const { data: supplier, error: supErr } = await service
      .from('suppliers')
      .insert({
        name: body.name,
        category_id: body.categoryId,
        code,
        contact_person: body.contactPerson ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        tax_number: body.taxNumber ?? null,
        payment_terms: body.paymentTerms ?? null,
        credit_limit: body.creditLimit ?? null,
        status: body.status,
        organization_id: ctx.organizationId,
        created_by: ctx.userId,
      })
      .select('*, supplier_categories(id, name)')
      .single();

    if (supErr) {
      if (supErr.code === '23505') return badRequest('Supplier code already exists.');
      return serverError(supErr.message);
    }

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
