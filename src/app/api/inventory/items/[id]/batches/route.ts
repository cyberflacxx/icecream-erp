import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingRelationError(error: unknown, relationName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  return (
    message.includes(`relation "${relationName}" does not exist`) ||
    message.includes(`Could not find the table 'icecream_erp.${relationName}'`)
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'inventory.report.view')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('inventory_batches')
    .select('id, warehouse_id, batch_number, expiry_date, quantity_remaining, status, warehouses!warehouse_id(id, code, name)')
    .eq('item_id', id)
    .order('expiry_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error, 'inventory_batches')) {
      return NextResponse.json({ data: [] });
    }
    return serverError(error.message);
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
      return {
        id: row.id,
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date,
        quantityRemaining: Number(row.quantity_remaining ?? 0),
        status: row.status,
        warehouse: warehouse
          ? { id: warehouse.id, code: warehouse.code, name: warehouse.name }
          : null,
      };
    }),
  });
}
