import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { toNumber } from '@/lib/inventory';
import {
  loadCustomerBalanceSnapshot,
  mapCustomerRow,
  normalizeCustomerStatus,
} from '@/lib/sales-customers';
import { validateCustomerCodeUniqueness } from '@/lib/sales';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

async function loadCustomer(service: ReturnType<typeof salesService>, organizationId: string, id: string) {
  const { data, error } = await service
    .from('customers')
    .select('id, organization_id, code, name, customer_type, email, phone, address, payment_terms, credit_limit, current_balance, status, created_at, updated_at')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadTransactionCounts(service: ReturnType<typeof salesService>, customerId: string) {
  const [quotationCount, orderCount, invoiceCount, paymentCount, returnCount] = await Promise.all([
    service.from('quotations').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    service.from('sales_orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    service.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    service.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    service.from('customer_returns').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
  ]);

  const results = [quotationCount, orderCount, invoiceCount, paymentCount, returnCount];
  const errored = results.find((result) => result.error);
  if (errored?.error) {
    throw errored.error;
  }

  const total =
    (quotationCount.count ?? 0) +
    (orderCount.count ?? 0) +
    (invoiceCount.count ?? 0) +
    (paymentCount.count ?? 0) +
    (returnCount.count ?? 0);

  return total;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.view', 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const customer = await loadCustomer(service, ctx.organizationId, params.id);
    if (!customer) return notFound('Customer not found.');

    const balance = await loadCustomerBalanceSnapshot(
      service,
      String(customer.id),
      customer.current_balance,
      customer.credit_limit,
      customer.payment_terms,
    );

    return NextResponse.json(mapCustomerRow(customer, balance));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load customer.');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.edit', 'sales.write')) return forbidden();

  try {
    const service = salesService();
    const existing = await loadCustomer(service, ctx.organizationId, params.id);
    if (!existing) return notFound('Customer not found.');

    const body = (await request.json().catch(() => ({}))) as {
      address?: string | null;
      code?: string;
      creditLimit?: number | null;
      customerType?: string;
      email?: string | null;
      name?: string;
      paymentTerms?: string | null;
      phone?: string | null;
      status?: string;
    };

    if (body.creditLimit !== undefined && toNumber(body.creditLimit) < 0) {
      return badRequest('Credit limit must not be negative.');
    }

    if (body.code !== undefined) {
      const nextCode = String(body.code ?? '').trim().toUpperCase();
      if (!nextCode) {
        return badRequest('Customer code is required.');
      }

      const { data: existingCodes, error: codesError } = await service
        .from('customers')
        .select('code')
        .eq('organization_id', ctx.organizationId)
        .neq('id', params.id)
        .is('deleted_at', null);
      if (codesError) throw codesError;

      if (!validateCustomerCodeUniqueness((existingCodes ?? []).map((row) => String(row.code ?? '')), nextCode)) {
        return NextResponse.json({ error: 'Customer code already exists.' }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.address !== undefined) updates.address = body.address?.trim() || null;
    if (body.code !== undefined) updates.code = String(body.code ?? '').trim().toUpperCase();
    if (body.creditLimit !== undefined) updates.credit_limit = toNumber(body.creditLimit);
    if (body.customerType !== undefined) updates.customer_type = String(body.customerType ?? '').trim().toUpperCase();
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.name !== undefined) updates.name = String(body.name ?? '').trim();
    if (body.paymentTerms !== undefined) updates.payment_terms = body.paymentTerms?.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.status !== undefined) updates.status = normalizeCustomerStatus(body.status);

    if (!Object.keys(updates).length) {
      return badRequest('Nothing to update.');
    }

    const { data, error } = await service
      .from('customers')
      .update(updates)
      .eq('organization_id', ctx.organizationId)
      .eq('id', params.id)
      .select('id, organization_id, code, name, customer_type, email, phone, address, payment_terms, credit_limit, current_balance, status, created_at, updated_at')
      .single();
    if (error || !data) throw error ?? new Error('Failed to update customer.');

    const balance = await loadCustomerBalanceSnapshot(
      service,
      String(data.id),
      data.current_balance,
      data.credit_limit,
      data.payment_terms,
    );

    await writeSalesAuditLog(
      'SALES_CUSTOMER_UPDATED',
      String(data.id),
      ctx.userId,
      updates,
      'customer',
    );

    return NextResponse.json(mapCustomerRow(data, balance));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update customer.');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.deactivate', 'sales.write')) return forbidden();

  try {
    const service = salesService();
    const existing = await loadCustomer(service, ctx.organizationId, params.id);
    if (!existing) return notFound('Customer not found.');

    const transactionCount = await loadTransactionCounts(service, params.id);
    if (transactionCount > 0) {
      return badRequest('Customer deletion is blocked because transactions exist. Use deactivate instead.');
    }

    return badRequest('Customer deletion is disabled. Use deactivate instead.');
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to delete customer.');
  }
}
