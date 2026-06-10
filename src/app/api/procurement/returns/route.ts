import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    supplierId: string;
    grnId?: string | null;
    reason: string;
    returnDate?: string | null;
    totalValue: number;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.supplierId || !body.reason || body.totalValue === undefined) {
    return badRequest('supplierId, reason, and totalValue are required');
  }

  try {
    // Validate supplier
    const { data: supplier, error: supErr } = await service
      .from('suppliers')
      .select('id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', body.supplierId)
      .single();

    if (supErr || !supplier) return badRequest('Supplier not found.');

    // Validate GRN if provided
    if (body.grnId) {
      const { data: grn, error: grnErr } = await service
        .from('goods_received_notes')
        .select('id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', body.grnId)
        .single();

      if (grnErr || !grn) return badRequest('Goods received note not found.');
    }

    // Generate return number
    const { count: returnCount } = await service
      .from('supplier_returns')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const returnNumber = `SRN-${String((returnCount ?? 0) + 1).padStart(5, '0')}`;

    const { data: supplierReturn, error: retErr } = await service
      .from('supplier_returns')
      .insert({
        return_number: returnNumber,
        supplier_id: body.supplierId,
        grn_id: body.grnId ?? null,
        organization_id: ctx.organizationId,
        created_by: ctx.userId,
        reason: body.reason,
        return_date: body.returnDate ?? new Date().toISOString(),
        total_value: body.totalValue,
        status: 'draft',
      })
      .select()
      .single();

    if (retErr) return serverError(retErr.message);

    return NextResponse.json(supplierReturn, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
