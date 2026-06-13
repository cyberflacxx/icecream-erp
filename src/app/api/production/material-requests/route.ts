import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateReferenceNumber, productionService, writeProductionAuditLog } from '@/lib/production-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  try {
    const service = productionService();
    const { data, error } = await service
      .from('production_material_requests')
      .select(`
        id, request_number, production_batch_id, request_date, status, notes, approved_by, approved_at,
        production_material_request_items(id, item_id, quantity_requested, quantity_approved, quantity_issued, unit_of_measure_id, notes),
        production_batches(batch_number, warehouse_id)
      `)
      .is('deleted_at', null)
      .order('request_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      items: Array<{
        itemId: string;
        quantityRequested: number;
        unitOfMeasureId: string;
      }>;
      notes?: string;
      productionBatchId: string;
      requestDate?: string;
    };

    if (!body.productionBatchId) return badRequest('productionBatchId is required.');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest('At least one material request item is required.');
    }

    const service = productionService();
    const requestNumber = await generateReferenceNumber('production_material_requests', 'PMR');
    const { data: requestRow, error: requestError } = await service
      .from('production_material_requests')
      .insert({
        notes: body.notes ?? null,
        production_batch_id: body.productionBatchId,
        request_date: body.requestDate ?? new Date().toISOString().slice(0, 10),
        request_number: requestNumber,
        requested_by: ctx.userId,
        status: 'PENDING',
      })
      .select()
      .single();
    if (requestError) throw requestError;

    const itemRows = body.items.map((item) => ({
      item_id: item.itemId,
      production_material_request_id: requestRow.id,
      quantity_requested: item.quantityRequested,
      unit_of_measure_id: item.unitOfMeasureId,
    }));
    const { error: itemsError } = await service.from('production_material_request_items').insert(itemRows);
    if (itemsError) throw itemsError;

    await service
      .from('production_batches')
      .update({ status: 'MATERIALS_REQUESTED' })
      .eq('id', body.productionBatchId);

    await writeProductionAuditLog('PRODUCTION_MATERIAL_REQUEST_CREATED', String(requestRow.id), ctx.userId, {
      itemCount: itemRows.length,
      requestNumber,
    }, 'production_material_request');
    return NextResponse.json(requestRow, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
