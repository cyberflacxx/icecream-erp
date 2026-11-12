import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateSalesReferenceNumber, isMissingSalesColumn, isMissingSalesTable, logSalesRouteError, salesErrorMessage, salesService, writeSalesAuditLog } from '@/lib/sales-server';

type SalesReturnListResult = {
  data: Record<string, unknown>[];
  error: unknown;
};

function normalizeSalesReturnListResult(result: { data?: unknown; error?: unknown }): SalesReturnListResult {
  return {
    data: (Array.isArray(result.data) ? result.data : []).filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row),
    ),
    error: result.error ?? null,
  };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    let returnsResult = normalizeSalesReturnListResult(await service
      .from('customer_returns')
      .select('id, return_number, customer_id, invoice_id, return_date, reason, total_value, status, qc_status, final_stock_action')
      .is('deleted_at', null)
      .order('return_date', { ascending: false }));

    if (returnsResult.error && isMissingSalesColumn(returnsResult.error, 'customer_returns', 'deleted_at')) {
      returnsResult = normalizeSalesReturnListResult(await service
        .from('customer_returns')
        .select('id, return_number, customer_id, invoice_id, return_date, reason, total_value, status, qc_status, final_stock_action')
        .order('return_date', { ascending: false }));
    }

    if (
      returnsResult.error &&
      (
        isMissingSalesColumn(returnsResult.error, 'customer_returns', 'final_stock_action') ||
        isMissingSalesColumn(returnsResult.error, 'customer_returns', 'qc_status')
      )
    ) {
      returnsResult = normalizeSalesReturnListResult(await service
        .from('customer_returns')
        .select('id, return_number, customer_id, invoice_id, return_date, reason, total_value, status')
        .order('return_date', { ascending: false }));
    }

    if (returnsResult.error) throw returnsResult.error;
    return NextResponse.json(
      returnsResult.data.map((row) => ({
        ...row,
        final_stock_action: row.final_stock_action ?? null,
        qc_status: row.qc_status ?? 'PENDING_QC',
      })),
    );
  } catch (err) {
    if (isMissingSalesTable(err)) return NextResponse.json([]);
    logSalesRouteError('returns', 'load customer returns', err);
    return serverError('Sales returns could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as {
      customerId: string;
      finalStockAction?: string;
      invoiceId?: string;
      qcNote?: string;
      reason: string;
      returnDate?: string;
      totalValue: number;
    };
    if (!body.customerId || !body.reason) return badRequest('customerId and reason are required.');

    const service = salesService();
    const returnNumber = await generateSalesReferenceNumber('customer_returns', 'RET');
    const { data, error } = await service
      .from('customer_returns')
      .insert({
        created_by: ctx.userId,
        customer_id: body.customerId,
        final_stock_action: body.finalStockAction ?? null,
        invoice_id: body.invoiceId ?? null,
        qc_note: body.qcNote ?? null,
        qc_status: 'PENDING_QC',
        reason: body.reason,
        return_date: body.returnDate ?? new Date().toISOString().slice(0, 10),
        return_number: returnNumber,
        status: 'DRAFT',
        total_value: body.totalValue ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    await writeSalesAuditLog('SALES_RETURN_CREATED', String(data.id), ctx.userId, { returnNumber }, 'customer_return');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
