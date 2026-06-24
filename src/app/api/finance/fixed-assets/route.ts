import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateStraightLineDepreciation } from '@/lib/finance';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('fixed_assets')
      .select('id, asset_code, name, category, purchase_date, purchase_cost, useful_life_years, residual_value, depreciation_method, current_value, accumulated_dep, is_active')
      .is('deleted_at', null)
      .order('purchase_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const service = financeService();
    const body = await request.json() as {
      assetCode: string;
      category: string;
      depreciationMethod: string;
      name: string;
      purchaseCost: number;
      purchaseDate: string;
      residualValue?: number;
      usefulLifeYears: number;
    };
    if (!body.assetCode || !body.name || !body.category || !body.purchaseDate) {
      return badRequest('assetCode, name, category, and purchaseDate are required');
    }

    const depreciation = calculateStraightLineDepreciation(
      body.purchaseCost,
      body.residualValue ?? 0,
      body.usefulLifeYears,
    );

    const { data, error } = await service
      .from('fixed_assets')
      .insert({
        asset_code: body.assetCode,
        name: body.name,
        category: body.category,
        purchase_date: body.purchaseDate,
        purchase_cost: body.purchaseCost,
        useful_life_years: body.usefulLifeYears,
        residual_value: body.residualValue ?? 0,
        depreciation_method: body.depreciationMethod,
        current_value: body.purchaseCost,
        accumulated_dep: 0,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('FIXED_ASSET_CREATED', data.id, ctx.userId, { assetCode: body.assetCode, annualDepreciation: depreciation.annualDepreciation }, 'fixed_asset');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
