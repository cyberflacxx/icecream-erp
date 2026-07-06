import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateSalesReferenceNumber, isMissingSalesTable, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_dispatch_notes')
      .select('id, dispatch_note_number, invoice_id, customer_id, warehouse_id, dispatch_date, status, vehicle_reference')
      .order('dispatch_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as {
      dispatchDate?: string;
      invoiceId: string;
      items: Array<{ invoiceItemId: string; itemId: string; quantityDispatched: number; quantityInvoiced: number }>;
      vehicleReference?: string;
      warehouseId: string;
    };
    if (!body.invoiceId || !body.warehouseId) return badRequest('invoiceId and warehouseId are required.');
    if (!Array.isArray(body.items) || body.items.length === 0) return badRequest('Dispatch items are required.');

    const service = salesService();
    const { data: invoice, error: invoiceError } = await service
      .from('invoices')
      .select('id, customer_id, status')
      .eq('id', body.invoiceId)
      .single();
    if (invoiceError) throw invoiceError;
    if (!['APPROVED', 'SENT', 'PARTIAL_PAID', 'PAID'].includes(String(invoice.status).toUpperCase())) {
      return badRequest('Dispatch requires an approved invoice.');
    }

    let dispatchNoteNumber: string;
    try {
      dispatchNoteNumber = await generateSalesReferenceNumber('sales_dispatch_notes', 'DSP');
    } catch (error) {
      if (!isMissingSalesTable(error)) throw error;
      dispatchNoteNumber = `DSP-${Date.now()}`;
    }

    const dispatchDate = body.dispatchDate ?? new Date().toISOString().slice(0, 10);
    const compatDispatchId = crypto.randomUUID();
    const compatPayload = {
      customerId: String(invoice.customer_id ?? ''),
      dispatchDate,
      dispatchNoteNumber,
      invoiceId: body.invoiceId,
      itemCount: body.items.length,
      items: body.items.map((item) => ({
        invoiceItemId: item.invoiceItemId ?? null,
        itemId: item.itemId,
        quantityDispatched: item.quantityDispatched,
        quantityInvoiced: item.quantityInvoiced,
      })),
      status: 'PENDING',
      vehicleReference: body.vehicleReference ?? null,
      warehouseId: body.warehouseId,
    };

    const createCompatDispatch = async () => {
      await writeSalesAuditLog('SALES_DISPATCH_CREATED', compatDispatchId, ctx.userId, compatPayload, 'sales_dispatch_note');
      return NextResponse.json({
        id: compatDispatchId,
        customer_id: invoice.customer_id,
        dispatch_date: dispatchDate,
        dispatch_note_number: dispatchNoteNumber,
        invoice_id: body.invoiceId,
        status: 'PENDING',
        vehicle_reference: body.vehicleReference ?? null,
        warehouse_id: body.warehouseId,
      }, { status: 201 });
    };

    const dispatchInsert = await service
      .from('sales_dispatch_notes')
      .insert({
        customer_id: invoice.customer_id,
        dispatch_date: dispatchDate,
        dispatch_note_number: dispatchNoteNumber,
        dispatched_by: ctx.userId,
        invoice_id: body.invoiceId,
        status: 'PENDING',
        vehicle_reference: body.vehicleReference ?? null,
        warehouse_id: body.warehouseId,
      })
      .select()
      .single();
    if (dispatchInsert.error) {
      if (isMissingSalesTable(dispatchInsert.error)) {
        return await createCompatDispatch();
      }
      throw dispatchInsert.error;
    }

    const dispatch = dispatchInsert.data;
    const itemRows = body.items.map((item) => ({
      dispatch_note_id: dispatch.id,
      invoice_item_id: item.invoiceItemId ?? null,
      item_id: item.itemId,
      quantity_dispatched: item.quantityDispatched,
      quantity_invoiced: item.quantityInvoiced,
    }));
    const itemsInsert = await service.from('sales_dispatch_note_items').insert(itemRows);
    if (itemsInsert.error) {
      if (isMissingSalesTable(itemsInsert.error)) {
        return await createCompatDispatch();
      }
      throw itemsInsert.error;
    }

    await writeSalesAuditLog('SALES_DISPATCH_CREATED', String(dispatch.id), ctx.userId, compatPayload, 'sales_dispatch_note');
    return NextResponse.json(dispatch, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
