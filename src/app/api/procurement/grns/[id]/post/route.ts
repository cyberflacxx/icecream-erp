import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
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
