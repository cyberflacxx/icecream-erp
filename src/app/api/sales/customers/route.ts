import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { toNumber } from '@/lib/inventory';
import {
  loadCustomerBalanceSnapshot,
  mapCustomerRow,
  normalizeCustomerStatus,
} from '@/lib/sales-customers';
import { validateCustomerCodeUniqueness } from '@/lib/sales';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
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

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.view', 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePagination(searchParams);
    const search = searchParams.get('search') ?? '';
    const status = searchParams.get('status') ?? '';

    let query = service
      .from('customers')
      .select('id, organization_id, code, name, customer_type, email, phone, address, payment_terms, credit_limit, current_balance, status, created_at, updated_at')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', normalizeCustomerStatus(status));
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = await Promise.all((data ?? []).map(async (row) => {
      const balance = await loadCustomerBalanceSnapshot(
        service,
        String(row.id),
        row.current_balance,
        row.credit_limit,
        row.payment_terms,
      );
      return mapCustomerRow(row, balance);
    }));

    return NextResponse.json(paginate(rows, page, pageSize));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load customers.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.create', 'sales.write')) return forbidden();

  try {
    const service = salesService();
    const body = (await request.json().catch(() => ({}))) as {
      address?: string;
      code?: string;
      creditLimit?: number;
      customerType?: string;
      email?: string;
      name?: string;
      paymentTerms?: string;
      phone?: string;
      status?: string;
    };

    const name = String(body.name ?? '').trim();
    if (!name) {
      return badRequest('Customer name is required.');
    }

    const creditLimit = toNumber(body.creditLimit);
    if (creditLimit < 0) {
      return badRequest('Credit limit must not be negative.');
    }

    let code = String(body.code ?? '').trim().toUpperCase();
    if (!code) {
      const { count, error: countError } = await service
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId);
      if (countError) throw countError;
      code = `CUS-${String((count ?? 0) + 1).padStart(5, '0')}`;
    }

    const { data: existingCodes, error: codesError } = await service
      .from('customers')
      .select('code')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null);
    if (codesError) throw codesError;

    if (!validateCustomerCodeUniqueness((existingCodes ?? []).map((row) => String(row.code ?? '')), code)) {
      return NextResponse.json({ error: 'Customer code already exists.' }, { status: 409 });
    }

    const { data, error } = await service
      .from('customers')
      .insert({
        address: body.address?.trim() || null,
        code,
        created_by: ctx.userId,
        credit_limit: creditLimit,
        current_balance: 0,
        customer_type: String(body.customerType ?? 'DIRECT_CUSTOMER').trim().toUpperCase(),
        email: body.email?.trim() || null,
        name,
        organization_id: ctx.organizationId,
        payment_terms: body.paymentTerms?.trim() || null,
        phone: body.phone?.trim() || null,
        status: normalizeCustomerStatus(body.status),
      })
      .select('id, organization_id, code, name, customer_type, email, phone, address, payment_terms, credit_limit, current_balance, status, created_at, updated_at')
      .single();
    if (error || !data) {
      throw error ?? new Error('Failed to create customer.');
    }

    const balance = await loadCustomerBalanceSnapshot(
      service,
      String(data.id),
      data.current_balance,
      data.credit_limit,
      data.payment_terms,
    );

    await writeSalesAuditLog(
      'SALES_CUSTOMER_CREATED',
      String(data.id),
      ctx.userId,
      { code, status: data.status },
      'customer',
    );

    return NextResponse.json(mapCustomerRow(data, balance), { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create customer.');
  }
}
