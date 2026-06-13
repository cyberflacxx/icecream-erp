import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    if (body.name !== undefined && !String(body.name).trim()) {
      return badRequest('Product name is required.');
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.defaultWarehouseId !== undefined) updates.default_warehouse_id = body.defaultWarehouseId || null;
    if (body.unitCost !== undefined) updates.unit_cost = Number(body.unitCost ?? 0);
    if (body.sellingPrice !== undefined) updates.selling_price = Number(body.sellingPrice ?? 0);
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);

    const service = productionService();
    const { data, error } = await service
      .from('items')
      .update(updates)
      .eq('id', id)
      .eq('item_type', 'FINISHED_GOOD')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound('Product not found.');

    await writeProductionAuditLog('PRODUCTION_PRODUCT_UPDATED', id, ctx.userId, updates, 'item');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
