import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildSupplierImportTemplateCsv, validateSupplierImportRows } from '@/lib/procurement';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.import', 'procurement.supplier.view', 'procurement.read')) return forbidden();

  return new NextResponse(buildSupplierImportTemplateCsv(), {
    status: 200,
    headers: {
      'Content-Disposition': 'attachment; filename="supplier-import-template.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.import', 'procurement.supplier.write', 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string;
    rows?: Array<Record<string, unknown>>;
  };
  if (!body.rows?.length) return badRequest('rows are required.');

  const service = createServiceRoleClient();
  const { data: existingSuppliers, error } = await service
    .from('suppliers')
    .select('code')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);
  if (error) return serverError(error.message);

  const batchId = randomUUID();
  const validation = validateSupplierImportRows(
    body.rows,
    (existingSuppliers ?? []).map((row) => String(row.code ?? '')),
  );

  if (validation.errors.length > 0) {
    await recordAuditLog({
      action: 'PROCUREMENT_SUPPLIER_IMPORT_REJECTED',
      entityId: batchId,
      entityType: 'procurement_supplier_import',
      ipAddress: request.headers.get('x-forwarded-for'),
      newValues: {
        errors: validation.errors,
        fileName: body.fileName ?? 'supplier-import-template.csv',
        rejectedRows: validation.errors.length,
        totalRows: body.rows.length,
      },
      organizationId: ctx.organizationId,
      userAgent: request.headers.get('user-agent'),
      userProfileId: ctx.userId,
    });

    return NextResponse.json(
      { batchId, created: 0, errors: validation.errors },
      { status: 400 },
    );
  }

  const payload = validation.rows.map((row) => ({
    address: row.address,
    code: row.code,
    contact_person: row.contactPerson,
    created_by: ctx.userId,
    credit_limit: row.creditLimit,
    current_balance: 0,
    email: row.email,
    name: row.name,
    organization_id: ctx.organizationId,
    payment_terms: row.paymentTerms,
    phone: row.phone,
    status: row.status,
    tax_number: row.taxNumber,
  }));

  const insertResult = await service.from('suppliers').insert(payload);
  if (insertResult.error) return serverError(insertResult.error.message);

  await recordAuditLog({
    action: 'PROCUREMENT_SUPPLIER_IMPORT_COMPLETED',
    entityId: batchId,
    entityType: 'procurement_supplier_import',
    ipAddress: request.headers.get('x-forwarded-for'),
    newValues: {
      created: payload.length,
      errors: [],
      fileName: body.fileName ?? 'supplier-import-template.csv',
      totalRows: body.rows.length,
    },
    organizationId: ctx.organizationId,
    userAgent: request.headers.get('user-agent'),
    userProfileId: ctx.userId,
  });

  return NextResponse.json({ batchId, created: payload.length, errors: [] }, { status: 201 });
}
