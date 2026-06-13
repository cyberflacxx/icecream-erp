import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateSalesReferenceNumber, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_journals')
      .select('*')
      .order('journal_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountName: string;
      creditAmount: number;
      customerId?: string;
      debitAmount: number;
      description?: string;
      invoiceId?: string;
      journalDate: string;
    };
    if (!body.accountName || !body.journalDate) return badRequest('accountName and journalDate are required.');

    const service = salesService();
    const journalNumber = await generateSalesReferenceNumber('sales_journals', 'SJ');
    const { data, error } = await service
      .from('sales_journals')
      .insert({
        account_name: body.accountName,
        credit_amount: body.creditAmount ?? 0,
        customer_id: body.customerId ?? null,
        debit_amount: body.debitAmount ?? 0,
        description: body.description ?? null,
        invoice_id: body.invoiceId ?? null,
        journal_date: body.journalDate,
        journal_number: journalNumber,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        status: 'POSTED',
      })
      .select()
      .single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_JOURNAL_CREATED', String(data.id), ctx.userId, { journalNumber }, 'sales_journal');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
