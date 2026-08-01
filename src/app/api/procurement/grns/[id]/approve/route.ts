import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { isWarehouseAvailableToContext } from '@/lib/branch-access';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.approve', 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  let approvalNotes: string | null = null;

  try {
    const body = await request.json();
    approvalNotes = typeof body?.approvalNotes === 'string'
      ? body.approvalNotes.trim() || null
      : typeof body?.remarks === 'string'
        ? body.remarks.trim() || null
        : null;
  } catch {}

  try {
    const { data: existing, error: fetchErr } = await service
      .from('goods_received_notes')
      .select('id, status, quality_status, warehouse_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Goods received note not found.');

    const grn = existing as Record<string, unknown>;

    const { data: warehouse, error: warehouseError } = await service
      .from('warehouses')
      .select('id, organization_id, branch_id, is_active, name')
      .eq('id', String(grn.warehouse_id ?? ''))
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

    if (grn.status === 'DRAFT' || grn.quality_status === 'PENDING') {
      return badRequest('Goods Received Note must be submitted before approval.');
    }
    if (grn.status === 'REJECTED' || grn.quality_status === 'REJECTED') {
      return badRequest('Rejected Goods Received Notes cannot be posted.');
    }
    if (grn.status === 'POSTED') {
      return badRequest('Goods Received Note has already been posted.');
    }
    if (grn.quality_status !== 'PENDING_APPROVAL') {
      return badRequest('Goods Received Note must be submitted before approval.');
    }

    const { data: updatedApproval, error: updateErr } = await service
      .from('goods_received_notes')
      .update({
        approval_notes: approvalNotes,
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        quality_status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    await recordAuditLog({
      action: 'GRN_APPROVED',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: { approvalNotes, qualityStatus: 'APPROVED' },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(updatedApproval);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
