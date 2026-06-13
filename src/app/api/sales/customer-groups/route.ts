import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateSalesReferenceNumber, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('sales_customer_groups').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as { code?: string; name?: string };
    if (!body.name?.trim()) return badRequest('name is required.');

    const service = salesService();
    const code = body.code?.trim().toUpperCase() || await generateSalesReferenceNumber('sales_customer_groups', 'CG');
    const { data, error } = await service
      .from('sales_customer_groups')
      .insert({ code, name: body.name.trim() })
      .select()
      .single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_CUSTOMER_GROUP_CREATED', String(data.id), ctx.userId, data, 'sales_customer_group');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
