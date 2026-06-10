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
  return {
    data: data.slice(start, start + pageSize),
    pagination: { page, pageSize, total },
  };
}

// ─── GET /api/sales/customers ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';

  let query = service
    .schema('icecream_erp')
    .from('customers')
    .select('id, code, name, customer_type, email, phone, address, payment_terms, credit_limit, current_balance, status')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(
      `code.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) return serverError(error.message);

  const mapped = (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    customerType: c.customer_type,
    email: c.email,
    phone: c.phone,
    address: c.address,
    paymentTerms: c.payment_terms,
    creditLimit: c.credit_limit ? Number(c.credit_limit) : 0,
    currentBalance: c.current_balance ? Number(c.current_balance) : 0,
    status: c.status,
  }));

  return NextResponse.json(paginate(mapped, page, pageSize));
}

// ─── POST /api/sales/customers ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = await request.json() as {
    name: string;
    customerType: string;
    status: string;
    code?: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentTerms?: string;
    creditLimit?: number;
  };

  if (!body.name || !body.customerType || !body.status) {
    return NextResponse.json({ error: 'name, customerType, and status are required' }, { status: 400 });
  }

  // Generate code if not provided
  let code = body.code?.trim() ?? '';
  if (!code) {
    const { count } = await service
      .schema('icecream_erp')
      .from('customers')
      .select('id', { count: 'exact', head: true });
    code = `CUS-${String((count ?? 0) + 1).padStart(5, '0')}`;
  }

  const { data, error } = await service
    .schema('icecream_erp')
    .from('customers')
    .insert({
      code,
      name: body.name,
      customer_type: body.customerType,
      status: body.status,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      payment_terms: body.paymentTerms ?? null,
      credit_limit: body.creditLimit ?? null,
      current_balance: 0,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
