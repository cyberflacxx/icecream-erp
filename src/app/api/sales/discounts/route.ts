import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { isMissingSalesColumn, logSalesRouteError, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    let discountsResult = await service
      .from('sales_discount_rules')
      .select('id, name, discount_type, discount_value, maximum_allowed_discount, approval_required, approval_status, is_active, customer_group_id, item_id, created_at')
      .order('created_at', { ascending: false });

    if (discountsResult.error && isMissingSalesColumn(discountsResult.error, 'sales_discount_rules', 'created_at')) {
      discountsResult = await service
        .from('sales_discount_rules')
        .select('id, name, discount_type, discount_value, maximum_allowed_discount, approval_required, approval_status, is_active, customer_group_id, item_id');
    }

    if (
      discountsResult.error &&
      (
        isMissingSalesColumn(discountsResult.error, 'sales_discount_rules', 'maximum_allowed_discount') ||
        isMissingSalesColumn(discountsResult.error, 'sales_discount_rules', 'approval_status') ||
        isMissingSalesColumn(discountsResult.error, 'sales_discount_rules', 'approval_required')
      )
    ) {
      discountsResult = await service
        .from('sales_discount_rules')
        .select('id, name, discount_type, discount_value, is_active, customer_group_id, item_id');
    }

    if (discountsResult.error) throw discountsResult.error;

    const rows = (discountsResult.data ?? []) as Array<Record<string, unknown>>;
    const itemIds = [...new Set(rows.map((row) => String(row.item_id ?? '')).filter(Boolean))];
    const groupIds = [...new Set(rows.map((row) => String(row.customer_group_id ?? '')).filter(Boolean))];

    const [itemsResult, groupsResult] = await Promise.all([
      itemIds.length ? service.from('items').select('id, code, name').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
      groupIds.length ? service.from('sales_customer_groups').select('id, code, name').in('id', groupIds) : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (groupsResult.error) throw groupsResult.error;

    const itemsById = new Map(
      ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((item) => [
        String(item.id),
        { code: item.code ? String(item.code) : '', name: item.name ? String(item.name) : '' },
      ]),
    );
    const groupsById = new Map(
      ((groupsResult.data ?? []) as Array<Record<string, unknown>>).map((group) => [
        String(group.id),
        { code: group.code ? String(group.code) : '', name: group.name ? String(group.name) : '' },
      ]),
    );

    return NextResponse.json(
      rows.map((row) => ({
        approval_required: row.approval_required ?? false,
        approval_status: row.approval_status ?? 'APPROVED',
        customer_group: groupsById.get(String(row.customer_group_id ?? '')) ?? null,
        discount_type: row.discount_type ?? 'PERCENTAGE',
        discount_value: Number(row.discount_value ?? 0),
        id: row.id,
        is_active: row.is_active ?? true,
        item: itemsById.get(String(row.item_id ?? '')) ?? null,
        maximum_allowed_discount: row.maximum_allowed_discount ?? null,
        name: row.name ?? 'Unnamed rule',
      })),
    );
  } catch (err) {
    logSalesRouteError('discounts', 'load discount rules', err);
    return serverError('Sales discounts could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as {
      approvalRequired?: boolean;
      customerGroupId?: string;
      discountType?: string;
      discountValue: number;
      itemId?: string;
      maximumAllowedDiscount?: number;
      minimumQuantity?: number;
      name?: string;
    };
    if (!body.name?.trim()) return badRequest('name is required.');
    ensureNonNegative(body.discountValue, 'discountValue');

    const service = salesService();
    const { data, error } = await service
      .from('sales_discount_rules')
      .insert({
        approval_required: Boolean(body.approvalRequired),
        approval_status: body.approvalRequired ? 'PENDING' : 'APPROVED',
        customer_group_id: body.customerGroupId ?? null,
        discount_type: body.discountType ?? 'PERCENTAGE',
        discount_value: body.discountValue,
        is_active: true,
        item_id: body.itemId ?? null,
        maximum_allowed_discount: body.maximumAllowedDiscount ?? null,
        minimum_quantity: body.minimumQuantity ?? 0,
        name: body.name.trim(),
      })
      .select()
      .single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_DISCOUNT_CREATED', String(data.id), ctx.userId, data, 'sales_discount_rule');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
