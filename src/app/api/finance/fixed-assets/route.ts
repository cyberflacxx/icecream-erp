import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateStraightLineDepreciation } from '@/lib/finance';
import {
  financeErrorMessage,
  financeService,
  isMissingFinanceColumn,
  isMissingFinanceTable,
  writeFinanceAuditLog,
} from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const service = financeService();
    const attempts = [
      'id, asset_code, asset_name, asset_category, purchase_date, purchase_cost, useful_life_years, residual_value, depreciation_method, net_book_value, accumulated_depreciation, status',
      'id, asset_code, asset_name, asset_category, purchase_date, purchase_cost, residual_value, depreciation_method, net_book_value, accumulated_depreciation, status',
      'id, asset_code, asset_name, asset_category, purchase_date, purchase_cost, net_book_value, accumulated_depreciation, status',
      'id, asset_code, asset_name, asset_category, purchase_date, purchase_cost, status',
      'id, asset_code, asset_name, purchase_date, purchase_cost',
    ];

    let resultData: Array<Record<string, unknown>> = [];
    for (const selectClause of attempts) {
      let attempt = await service
        .from('fixed_assets')
        .select(selectClause)
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null)
        .order('purchase_date', { ascending: false });
      if (attempt.error && isMissingFinanceColumn(attempt.error, 'fixed_assets', 'deleted_at')) {
        attempt = await service
          .from('fixed_assets')
          .select(selectClause)
          .eq('organization_id', ctx.organizationId)
          .order('purchase_date', { ascending: false }) as typeof attempt;
      }
      if (!attempt.error) {
        resultData = ((attempt.data ?? []) as unknown as Array<Record<string, unknown>>);
        break;
      }

      const compatibleFailure =
        isMissingFinanceColumn(attempt.error, 'fixed_assets', 'deleted_at') ||
        /column\s+fixed_assets\.[a-z_]+\s+does not exist/i.test(financeErrorMessage(attempt.error));
      if (!compatibleFailure) {
        throw attempt.error;
      }
    }
    return NextResponse.json(resultData.map((row) => ({
      ...row,
      accumulated_dep: row.accumulated_depreciation ?? 0,
      category: row.asset_category ?? null,
      current_value: row.net_book_value ?? row.purchase_cost ?? 0,
      is_active: String(row.status ?? 'ACTIVE').toUpperCase() !== 'RETIRED',
      name: row.asset_name ?? '',
    })));
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return NextResponse.json([]);
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

    let { data, error } = await service
      .from('fixed_assets')
      .insert({
        organization_id: ctx.organizationId,
        asset_code: body.assetCode,
        asset_name: body.name,
        asset_category: body.category,
        purchase_date: body.purchaseDate,
        purchase_cost: body.purchaseCost,
        useful_life_years: body.usefulLifeYears,
        residual_value: body.residualValue ?? 0,
        depreciation_method: body.depreciationMethod,
        net_book_value: body.purchaseCost,
        accumulated_depreciation: 0,
        status: 'ACTIVE',
      })
      .select()
      .single();
    if (error && isMissingFinanceColumn(error, 'fixed_assets', 'useful_life_years')) {
      ({ data, error } = await service
        .from('fixed_assets')
        .insert({
          organization_id: ctx.organizationId,
          asset_code: body.assetCode,
          asset_name: body.name,
          asset_category: body.category,
          purchase_date: body.purchaseDate,
          purchase_cost: body.purchaseCost,
          residual_value: body.residualValue ?? 0,
          depreciation_method: body.depreciationMethod,
          net_book_value: body.purchaseCost,
          accumulated_depreciation: 0,
          status: 'ACTIVE',
        })
        .select()
        .single());
    }
    if (error) throw error;

    await writeFinanceAuditLog('FIXED_ASSET_CREATED', data.id, ctx.userId, { assetCode: body.assetCode, annualDepreciation: depreciation.annualDepreciation }, 'fixed_asset');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
