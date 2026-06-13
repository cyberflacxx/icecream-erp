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
    const service = productionService();

    const { data: existing, error: existingError } = await service
      .from('production_plans')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return notFound('Production plan not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(existing.status))) {
      return badRequest('Completed or cancelled plans cannot be edited.');
    }

    const updates: Record<string, unknown> = {};
    if (body.planDate !== undefined) updates.plan_date = body.planDate;
    if (body.shift !== undefined) updates.shift = body.shift;
    if (body.productionLine !== undefined) updates.production_line = body.productionLine;

    const { data, error } = await service
      .from('production_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (Array.isArray(body.items)) {
      await service.from('production_plan_items').delete().eq('production_plan_id', id);
      const rows = (body.items as Array<Record<string, unknown>>).map((item) => ({
        expected_output: Number(item.expectedOutput ?? 0),
        planned_quantity: Number(item.plannedQuantity ?? 0),
        production_plan_id: id,
        recipe_id: item.recipeId,
      }));
      const { error: itemError } = await service.from('production_plan_items').insert(rows);
      if (itemError) throw itemError;
    }

    await writeProductionAuditLog('PRODUCTION_PLAN_UPDATED', id, ctx.userId, updates, 'production_plan');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
