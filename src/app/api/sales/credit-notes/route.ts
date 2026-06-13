import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateSalesReferenceNumber, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_credit_notes')
      .select('id, credit_note_number, customer_id, invoice_id, customer_return_id, amount, reason, status')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'sales.write')) return forbidden();

  try {
    const body = await request.json() as {
      amount: number;
      customerId: string;
      customerReturnId?: string;
      invoiceId?: string;
      reason: string;
    };
    if (!body.customerId || !body.reason) return badRequest('customerId and reason are required.');

    const service = salesService();
    const creditNoteNumber = await generateSalesReferenceNumber('sales_credit_notes', 'CN');
    const { data, error } = await service
      .from('sales_credit_notes')
      .insert({
        amount: body.amount ?? 0,
        created_by: ctx.userId,
        credit_note_number: creditNoteNumber,
        customer_id: body.customerId,
        customer_return_id: body.customerReturnId ?? null,
        invoice_id: body.invoiceId ?? null,
        reason: body.reason,
        status: 'DRAFT',
      })
      .select()
      .single();
    if (error) throw error;
    await writeSalesAuditLog('SALES_CREDIT_NOTE_CREATED', String(data.id), ctx.userId, { creditNoteNumber }, 'sales_credit_note');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
