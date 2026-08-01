import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { isWarehouseAvailableToContext } from '@/lib/branch-access';
import { isGrnStockPostingError, postGoodsReceivedNoteToInventory } from '@/lib/procurement-goods-received';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.post', 'procurement.grn.post', 'inventory.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: existingError } = await service
      .from('goods_received_notes')
      .select('id, status, quality_status, stock_posted, warehouse_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (existingError) return serverError(existingError.message);
    if (!existing) {
      return badRequest('Goods received note not found.');
    }

    const { data: warehouse, error: warehouseError } = await service
      .from('warehouses')
      .select('id, organization_id, branch_id, is_active, name')
      .eq('id', String(existing.warehouse_id ?? ''))
      .maybeSingle();
    if (warehouseError) return serverError(warehouseError.message);
    if (
      !isWarehouseAvailableToContext(ctx, warehouse
        ? {
            branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
            id: String(warehouse.id),
            isActive: warehouse.is_active !== false,
            name: warehouse.name ? String(warehouse.name) : null,
            organizationId: String(warehouse.organization_id ?? ''),
          }
        : null)
    ) {
      return forbidden();
    }

    if (existing.stock_posted === true || String(existing.status ?? '').trim().toUpperCase() === 'POSTED') {
      return badRequest('Goods Received Note has already been posted.');
    }
    if (String(existing.status ?? '').trim().toUpperCase() === 'REJECTED' || String(existing.quality_status ?? '').trim().toUpperCase() === 'REJECTED') {
      return badRequest('Rejected Goods Received Notes cannot be posted.');
    }
    if (String(existing.quality_status ?? '').trim().toUpperCase() !== 'APPROVED') {
      return badRequest('Goods Received Note must be approved before posting.');
    }

    const updated = await postGoodsReceivedNoteToInventory(service, {
      grnId: id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    await recordAuditLog({
      action: 'GRN_POSTED_TO_STOCK',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        status: 'POSTED',
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post GRN.';
    const details = isGrnStockPostingError(error) ? error.details : undefined;
    if (message === 'Please select a receiving warehouse before posting GRN.') {
      return NextResponse.json({
        success: false,
        message,
        code: 'GRN_STOCK_POST_FAILED',
        details,
      }, { status: 400 });
    }
    console.error('GRN post failed.', {
      details,
      grnId: id,
      message,
    });
    return NextResponse.json({
      success: false,
      message: 'Goods received note could not update inventory. Please check warehouse and item details.',
      code: 'GRN_STOCK_POST_FAILED',
      details,
    }, { status: 500 });
  }
}
