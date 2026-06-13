import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildDispatchReportRows } from '@/lib/sales';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_dispatch_notes')
      .select('dispatch_note_number, dispatch_date, status, invoice_number:invoices(invoice_number), customer_name:customers(name), sales_dispatch_note_items(quantity_dispatched)')
      .order('dispatch_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & {
        customer_name?: { name?: string } | Array<{ name?: string }> | null;
        invoice_number?: { invoice_number?: string } | Array<{ invoice_number?: string }> | null;
        sales_dispatch_note_items?: Array<{ quantity_dispatched?: number | string | null }> | null;
      };
      return {
        customerName: Array.isArray(row.customer_name) ? row.customer_name[0]?.name ?? 'Unknown customer' : row.customer_name?.name ?? 'Unknown customer',
        dispatchDate: row.dispatch_date,
        dispatchNoteNumber: row.dispatch_note_number,
        invoiceNumber: Array.isArray(row.invoice_number) ? row.invoice_number[0]?.invoice_number ?? '' : row.invoice_number?.invoice_number ?? '',
        quantityDispatched: (Array.isArray(row.sales_dispatch_note_items) ? row.sales_dispatch_note_items : []).reduce((sum, item) => sum + Number(item.quantity_dispatched ?? 0), 0),
        status: row.status,
      };
    });
    return NextResponse.json(buildDispatchReportRows(rows));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
