import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { postFinanceDocument } from '@/lib/finance-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.invoice.post', 'finance.write', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data: invoice, error } = await service
    .from('supplier_invoices')
    .select('id, invoice_number, invoice_date, invoice_total, status, supplier_id, purchase_order_id, goods_received_note_id')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!invoice) return notFound('Supplier invoice not found.');
  if (String(invoice.status ?? '').toUpperCase() === 'POSTED') {
    return badRequest('Supplier invoice is already posted.');
  }

  const amount = Number(invoice.invoice_total ?? 0);
  if (amount <= 0) {
    return badRequest('Supplier invoice total must be greater than zero.');
  }

  try {
    const journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: `Supplier invoice ${String(invoice.invoice_number ?? invoice.id)}`,
      journalDate: String(invoice.invoice_date ?? new Date().toISOString().slice(0, 10)),
      lines: [
        {
          accountCode: invoice.purchase_order_id || invoice.goods_received_note_id ? '1200' : '6100',
          creditAmount: 0,
          debitAmount: amount,
          description: invoice.purchase_order_id || invoice.goods_received_note_id ? 'Inventory or receipt accrual clearing' : 'Supplier expense recognition',
        },
        {
          accountCode: '2000',
          creditAmount: amount,
          debitAmount: 0,
          description: `Accounts payable for supplier invoice ${String(invoice.invoice_number ?? invoice.id)}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(invoice.id),
      sourceDocumentType: 'supplier_invoice',
      sourceModule: 'procurement',
    });

    const { data: updated, error: updateError } = await service
      .from('supplier_invoices')
      .update({
        status: 'POSTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      return serverError(updateError?.message ?? 'Failed to update supplier invoice status.');
    }

    return NextResponse.json({ ...updated, journal });
  } catch (postingError) {
    return serverError(postingError instanceof Error ? postingError.message : 'Failed to post supplier invoice.');
  }
}
