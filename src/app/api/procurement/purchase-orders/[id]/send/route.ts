import { NextRequest, NextResponse } from 'next/server';

import { toAbsoluteAppUrl } from '@/lib/app-url';
import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { sendTransactionalEmail } from '@/lib/email';
import {
  derivePurchaseOrderStatus,
  formatPurchaseOrderDbStatus,
} from '@/lib/procurement-purchase-orders';
import { getCompanyProfile } from '@/lib/settings-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, po_number, total, notes, status, approved_by, approved_at, sent_at, rejected_at, suppliers(name, email)')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');

    const order = existing as Record<string, unknown>;
    const workflowStatus = derivePurchaseOrderStatus({
      rejectedAt: order.rejected_at,
      sentAt: order.sent_at,
      status: order.status,
    });
    if (workflowStatus !== 'APPROVED') {
      return badRequest('Only approved purchase orders can be sent.');
    }
    if (!order.approved_by && !order.approved_at) {
      return badRequest('Purchase order must be approved before sending.');
    }

    const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;
    const supplierEmail = String((supplier as Record<string, unknown> | null)?.email ?? '').trim();
    const supplierName = String((supplier as Record<string, unknown> | null)?.name ?? 'Supplier').trim();

    if (!supplierEmail) {
      return badRequest('Supplier email is required before sending this purchase order.');
    }

    const documentUrl = toAbsoluteAppUrl(`/api/procurement/purchase-orders/${id}/pdf`, request);
    const company = await getCompanyProfile().catch(() => null);
    const companyName = company?.name?.trim() || 'Absolute Ice Cream';

    await sendTransactionalEmail({
      to: supplierEmail,
      subject: `${companyName} Purchase Order ${String(order.po_number ?? id)}`,
      text: `Please review purchase order ${String(order.po_number ?? id)} from ${companyName}. Open: ${documentUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <h2 style="margin-bottom:8px;">Purchase Order ${String(order.po_number ?? id)}</h2>
          <p>Hello ${supplierName},</p>
          <p>Please find our purchase order attached via the secure document link below.</p>
          <p><strong>Total:</strong> USD ${Number(order.total ?? 0).toFixed(2)}</p>
          ${order.notes ? `<p><strong>Notes:</strong> ${String(order.notes)}</p>` : ''}
          <p>
            <a href="${documentUrl}" style="display:inline-block;padding:12px 18px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:999px;">
              Open Purchase Order
            </a>
          </p>
          <p>Regards,<br />${companyName}</p>
        </div>
      `,
    });

    const { data: updated, error: updateErr } = await service
      .from('purchase_orders')
      .update({
        sent_at: new Date().toISOString(),
        status: formatPurchaseOrderDbStatus('sent_to_supplier', order.status),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
