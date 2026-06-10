import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const [
      { count: userCount },
      { count: roleCount },
      { count: auditCount },
      { count: unreadCount },
      { count: lowStockCount },
      { data: stockBalances },
    ] = await Promise.all([
      service.schema('icecream_erp').from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      service.schema('icecream_erp').from('roles').select('*', { count: 'exact', head: true }),
      service.schema('icecream_erp').from('audit_logs').select('*', { count: 'exact', head: true }),
      service.schema('icecream_erp').from('notifications').select('*', { count: 'exact', head: true }).eq('user_profile_id', ctx.userId).eq('is_read', false),
      service.schema('icecream_erp').from('stock_balances').select('*', { count: 'exact', head: true }),
      service.schema('icecream_erp').from('stock_balances').select('quantity_on_hand, items(unit_cost)'),
    ]);

    const totalInventoryValue = (stockBalances ?? []).reduce((sum: number, row: { quantity_on_hand: number; items: { unit_cost: number } | null }) => {
      return sum + Number(row.quantity_on_hand ?? 0) * Number(row.items?.unit_cost ?? 0);
    }, 0);

    return NextResponse.json({
      userCount: userCount ?? 0,
      roleCount: roleCount ?? 0,
      auditCount: auditCount ?? 0,
      unreadCount: unreadCount ?? 0,
      lowStockCount: lowStockCount ?? 0,
      totalInventoryValue,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
