import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const { branchId, id } = await params;
  const service = createServiceRoleClient();

  try {
    if (ctx.isBranchScoped && ctx.branchId && ctx.branchId !== branchId) return forbidden();

    const { data: sale, error } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('*, branch_sale_items(id, item_id, quantity, unit_price, total_price, items(id, code, name))')
      .is('deleted_at', null)
      .eq('branch_id', branchId)
      .eq('id', id)
      .single();

    if (error || !sale) return notFound('Branch sale not found');

    return NextResponse.json({
      id: sale.id,
      saleNumber: sale.sale_number,
      saleDate: sale.sale_date,
      shift: sale.shift,
      paymentMethod: sale.payment_method,
      paymentReference: sale.payment_reference,
      totalAmount: Number(sale.total_amount ?? 0),
      servedBy: sale.served_by,
      items: (sale.branch_sale_items ?? []).map((item: Record<string, unknown>) => {
        const it = item.items as { id: string; code: string; name: string } | null;
        return {
          id: item.id,
          item: it ? { id: it.id, code: it.code, name: it.name } : null,
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unit_price ?? 0),
          totalPrice: Number(item.total_price ?? 0),
        };
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
