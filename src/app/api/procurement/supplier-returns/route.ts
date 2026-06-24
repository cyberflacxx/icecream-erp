import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_returns')
    .select('id, return_number, reason, return_date, total_value, status, suppliers(name), supplier_return_items(quantity_returned, qc_status, items(name))')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('return_date', { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table 'icecream_erp.supplier_returns'")) {
      return NextResponse.json([]);
    }
    return serverError(error.message);
  }

  return NextResponse.json((data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const items = Array.isArray(row.supplier_return_items) ? row.supplier_return_items : [];
    const firstItem = items[0] as Record<string, unknown> | undefined;
    const item = Array.isArray(firstItem?.items) ? firstItem?.items[0] : firstItem?.items;
    return {
      id: row.id,
      qcStatus: firstItem?.qc_status ?? null,
      quantityReturned: Number(firstItem?.quantity_returned ?? 0),
      reason: row.reason,
      returnDate: row.return_date,
      returnNumber: row.return_number,
      status: row.status,
      supplierName: supplier?.name ?? 'Unknown supplier',
      itemName: (item as Record<string, unknown> | undefined)?.name ?? 'Multiple items',
    };
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write', 'quality.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    grnId?: string | null;
    items?: Array<{ itemId: string; qcNote?: string | null; qcStatus: string; quantityReturned: number; reason: string }>;
    reason?: string;
    supplierId?: string;
  };

  if (!body.supplierId || !body.reason || !body.items?.length) {
    return badRequest('supplierId, reason, and items are required.');
  }

  const service = createServiceRoleClient();
  const tableCheck = await service.from('supplier_returns').select('id', { count: 'exact', head: true });
  if (tableCheck.error?.message.includes("Could not find the table 'icecream_erp.supplier_returns'")) {
    return serverError('Supplier returns table is not deployed in Supabase yet.');
  }
  const { count } = await service.from('supplier_returns').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId);
  const returnNumber = `SRN-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const totalValue = body.items.reduce((sum, item) => sum + Number(item.quantityReturned ?? 0), 0);
  const { data: supplierReturn, error } = await service
    .from('supplier_returns')
    .insert({
      created_by: ctx.userId,
      grn_id: body.grnId ?? null,
      organization_id: ctx.organizationId,
      reason: body.reason,
      return_date: new Date().toISOString(),
      return_number: returnNumber,
      status: 'pending_qc',
      supplier_id: body.supplierId,
      total_value: totalValue,
    })
    .select()
    .single();

  if (error || !supplierReturn) return serverError(error?.message ?? 'Failed to create supplier return.');

  const { error: itemsError } = await service.from('supplier_return_items').insert(
    body.items.map((item) => ({
      item_id: item.itemId,
      qc_note: item.qcNote ?? null,
      qc_status: item.qcStatus,
      quantity_returned: item.quantityReturned,
      reason: item.reason,
      supplier_return_id: supplierReturn.id,
    })),
  );

  if (itemsError) return serverError(itemsError.message);
  return NextResponse.json(supplierReturn, { status: 201 });
}
