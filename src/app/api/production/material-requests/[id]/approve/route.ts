import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      items?: Array<{ id: string; quantityApproved: number }>;
    };
    const service = productionService();

    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        await service
          .from('production_material_request_items')
          .update({ quantity_approved: item.quantityApproved })
          .eq('id', item.id);
      }
    }

    const { data, error } = await service
      .from('production_material_requests')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeProductionAuditLog('PRODUCTION_MATERIAL_REQUEST_APPROVED', id, ctx.userId, {
      status: 'APPROVED',
    }, 'production_material_request');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
