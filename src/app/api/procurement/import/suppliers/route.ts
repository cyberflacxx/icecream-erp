import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateSupplierCodeUniqueness } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as { rows?: Array<Record<string, unknown>> };
  if (!body.rows?.length) return badRequest('rows are required.');

  const service = createServiceRoleClient();
  const { data: existingSuppliers, error } = await service.from('suppliers').select('code, name').eq('organization_id', ctx.organizationId).is('deleted_at', null);
  if (error) return serverError(error.message);

  const existingCodes = (existingSuppliers ?? []).map((row) => String(row.code ?? ''));
  const existingNames = new Set((existingSuppliers ?? []).map((row) => String(row.name ?? '').trim().toUpperCase()));
  const errors: Array<{ message: string; row: number }> = [];
  const accepted: Array<Record<string, unknown>> = [];

  body.rows.forEach((row, index) => {
    const code = String(row.code ?? '').trim();
    const name = String(row.name ?? '').trim();
    const paymentTerms = String(row.paymentTerms ?? '').trim();

    if (!code || !name) {
      errors.push({ message: 'code and name are required', row: index + 1 });
      return;
    }
    if (!validateSupplierCodeUniqueness(existingCodes, code)) {
      errors.push({ message: 'duplicate supplier code', row: index + 1 });
      return;
    }
    if (existingNames.has(name.toUpperCase())) {
      errors.push({ message: 'duplicate supplier name', row: index + 1 });
      return;
    }
    if (Number(row.creditLimit ?? 0) < 0) {
      errors.push({ message: 'negative credit limit not allowed', row: index + 1 });
      return;
    }
    if (paymentTerms && !['7 DAYS', '14 DAYS', '30 DAYS', 'COD', 'IMMEDIATE'].includes(paymentTerms.toUpperCase())) {
      errors.push({ message: 'invalid payment terms', row: index + 1 });
      return;
    }

    accepted.push({
      address: row.address ?? null,
      code,
      contact_person: row.contactPerson ?? null,
      created_by: ctx.userId,
      credit_limit: Number(row.creditLimit ?? 0),
      email: row.email ?? null,
      name,
      organization_id: ctx.organizationId,
      payment_terms: paymentTerms || null,
      phone: row.phone ?? null,
      status: row.status ?? 'ACTIVE',
      tax_number: row.taxNumber ?? null,
    });
    existingCodes.push(code);
    existingNames.add(name.toUpperCase());
  });

  if (accepted.length) {
    const insertResult = await service.from('suppliers').insert(accepted);
    if (insertResult.error) return serverError(insertResult.error.message);
  }

  return NextResponse.json({ created: accepted.length, errors });
}
