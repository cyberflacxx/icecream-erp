import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = productionService();
    const { data: recipe, error: recipeError } = await service
      .from('recipes')
      .select('id, finished_item_id, flavour_id, chocolate_type_id, version')
      .eq('id', id)
      .single();
    if (recipeError) throw recipeError;

    await service
      .from('recipes')
      .update({ status: 'INACTIVE' })
      .eq('finished_item_id', recipe.finished_item_id)
      .eq('flavour_id', recipe.flavour_id ?? null)
      .eq('chocolate_type_id', recipe.chocolate_type_id ?? null)
      .eq('status', 'ACTIVE')
      .neq('id', id);

    const { data, error } = await service
      .from('recipes')
      .update({ status: 'ACTIVE' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_RECIPE_ACTIVATED', id, ctx.userId, {
      version: recipe.version,
    }, 'recipe');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
