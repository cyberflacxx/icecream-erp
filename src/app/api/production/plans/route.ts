import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateRequiredMaterials } from '@/lib/production';
import { fetchStockBalanceMap, generateReferenceNumber, isMissingProductionTable, productionErrorMessage, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('production_plans')
      .select(`
        id, plan_number, plan_date, shift, production_line, status, created_at,
        production_plan_items(id, recipe_id, planned_quantity, expected_output, notes, recipes(id, code, name, finished_item_id, items!finished_item_id(id, code, name)))
      `)
      .is('deleted_at', null)
      .order('plan_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingProductionTable(err)) return NextResponse.json([]);
    return serverError(productionErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      items: Array<{
        expectedOutput: number;
        plannedQuantity: number;
        recipeId: string;
      }>;
      planDate: string;
      productionCategory?: string;
      productionLine?: string;
      shift: 'DAY' | 'NIGHT';
    };

    if (!body.planDate) return badRequest('planDate is required.');
    if (!body.shift) return badRequest('shift is required.');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest('Production plan must contain at least one item.');
    }

    const service = productionService();
    const planNumber = await generateReferenceNumber('production_plans', 'PPL');

    const { data: plan, error: planError } = await service
      .from('production_plans')
      .insert({
        organization_id: ctx.organizationId,
        plan_date: body.planDate,
        plan_number: planNumber,
        production_category: body.productionCategory ?? 'ICE_CREAM_MAKING',
        production_line: body.productionLine ?? 'Main Line',
        shift: body.shift,
        status: 'DRAFT',
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (planError) throw planError;

    const items = body.items.map((item) => ({
      expected_output: item.expectedOutput,
      planned_quantity: item.plannedQuantity,
      production_plan_id: plan.id,
      recipe_id: item.recipeId,
    }));

    const { error: itemError } = await service.from('production_plan_items').insert(items);
    if (itemError) throw itemError;

    await writeProductionAuditLog('PRODUCTION_PLAN_CREATED', String(plan.id), ctx.userId, {
      itemCount: items.length,
      planNumber,
      shift: body.shift,
    }, 'production_plan');

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
