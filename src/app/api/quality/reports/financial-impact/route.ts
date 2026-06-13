import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService } from '@/lib/quality-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'finance.read')) return forbidden();
  try {
    const [damaged, expired, waste] = await Promise.all([
      qualityService().from('damaged_goods_records').select('item_id, total_value, damage_reason, created_at').eq('organization_id', ctx.organizationId),
      qualityService().from('expired_goods_records').select('item_id, total_value, remarks, created_at').eq('organization_id', ctx.organizationId),
      qualityService().from('waste_disposal_records').select('item_id, quantity_disposed, created_at').eq('organization_id', ctx.organizationId),
    ]);
    if (damaged.error) throw damaged.error;
    if (expired.error) throw expired.error;
    if (waste.error) throw waste.error;
    return NextResponse.json({
      damagedGoodsValue: (damaged.data ?? []).reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
      expiredGoodsValue: (expired.data ?? []).reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
      wasteRecords: waste.data ?? [],
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
