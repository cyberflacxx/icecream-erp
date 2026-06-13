import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { generateQualityReferenceNumber, qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'sales.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('goods_return_vouchers').select('*, goods_return_voucher_items(*)').eq('organization_id', ctx.organizationId).order('return_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write', 'sales.write')) return forbidden();
  try {
    const body = await request.json() as {
      branchId?: string;
      customerId?: string;
      dispatchId?: string;
      invoiceId?: string;
      items: Array<{ itemId: string; quantityReturned: number; returnReason: string; totalValue?: number; unitCost?: number }>;
      receivedBy?: string;
      returnDate?: string;
      returnSource: string;
      returnWarehouseId?: string;
      supplierId?: string;
    };
    if (!body.returnSource || !body.items?.length) return badRequest('returnSource and items are required');
    const invalidItem = body.items.find((item) => !item.itemId || !item.returnReason || Number(item.quantityReturned) <= 0);
    if (invalidItem) return badRequest('Each return item requires itemId, quantityReturned, and returnReason');
    const returnNumber = await generateQualityReferenceNumber('goods_return_vouchers', 'GRV');
    const service = qualityService();
    const { data, error } = await service.from('goods_return_vouchers').insert({
      organization_id: ctx.organizationId,
      return_number: returnNumber,
      return_source: body.returnSource,
      customer_id: body.customerId ?? null,
      branch_id: body.branchId ?? null,
      supplier_id: body.supplierId ?? null,
      invoice_id: body.invoiceId ?? null,
      dispatch_id: body.dispatchId ?? null,
      received_by: body.receivedBy ?? ctx.userId,
      return_warehouse_id: body.returnWarehouseId ?? null,
      return_date: body.returnDate ?? new Date().toISOString().slice(0, 10),
      status: 'PENDING_QC',
      qc_status: 'PENDING_QC',
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await service.from('goods_return_voucher_items').insert(
      body.items.map((item) => ({
        voucher_id: data.id,
        item_id: item.itemId,
        quantity_returned: item.quantityReturned,
        return_reason: item.returnReason,
        unit_cost: item.unitCost ?? 0,
        total_value: item.totalValue ?? (Number(item.unitCost ?? 0) * Number(item.quantityReturned ?? 0)),
      })),
    );
    await writeQualityAuditLog('GOODS_RETURN_VOUCHER_CREATED', data.id, ctx.userId, { returnNumber }, 'goods_return_voucher');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
