import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function resolveLink(referenceType: string | null, referenceId: string | null): string {
  const normalized = (referenceType ?? '').toUpperCase();
  if (normalized === 'LOW_STOCK') return '/inventory/stock-balances';
  if (normalized === 'EXPIRY_ALERT') return '/inventory/expiring';
  if (normalized === 'SHIFT_CLOSE_SUBMITTED') return referenceId ? `/branches/${referenceId}` : '/branches';
  if (normalized === 'PRODUCTION_BATCH_READY') return referenceId ? `/production/batches/${referenceId}` : '/dashboard';
  if (normalized === 'PURCHASE_ORDER_APPROVED') return referenceId ? `/procurement/purchase-orders/${referenceId}` : '/procurement/purchase-orders';
  if (normalized === 'PAYMENT_RECEIVED') return referenceId ? `/sales/invoices/${referenceId}` : '/sales/invoices';
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const isRead = searchParams.get('isRead');
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('notifications')
      .select('id, title, message, type, is_read, reference_id, reference_type, created_at', { count: 'exact' })
      .eq('user_profile_id', ctx.userId)
      .order('created_at', { ascending: false });

    if (typeof isRead === 'string' && isRead !== '') {
      query = query.eq('is_read', isRead === 'true');
    } else if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (limit) query = query.limit(limit);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        isRead: row.is_read,
        referenceId: row.reference_id,
        referenceType: row.reference_type,
        createdAt: row.created_at,
        link: resolveLink(row.reference_type as string | null, row.reference_id as string | null),
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
