import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as { rows?: Array<Record<string, unknown>> };
  if (!body.rows?.length) return badRequest('rows are required.');

  const errors: Array<{ message: string; row: number }> = [];
  const accepted: Array<Record<string, unknown>> = [];

  body.rows.forEach((row, index) => {
    const supplierId = String(row.supplierId ?? '').trim();
    const itemId = String(row.itemId ?? '').trim();
    const unitCost = Number(row.unitCost ?? 0);

    if (!supplierId || !itemId) {
      errors.push({ message: 'supplierId and itemId are required', row: index + 1 });
      return;
    }
    if (unitCost < 0) {
      errors.push({ message: 'negative prices are not allowed', row: index + 1 });
      return;
    }

    accepted.push({
      item_id: itemId,
      last_price: unitCost,
      organization_id: ctx.organizationId,
      supplier_id: supplierId,
      updated_by: ctx.userId,
    });
  });

  const service = createServiceRoleClient();
  if (accepted.length) {
    const { error } = await service.from('supplier_items').upsert(accepted, { onConflict: 'supplier_id,item_id' });
    if (error) return serverError(error.message);
  }

  return NextResponse.json({ updated: accepted.length, errors });
}
