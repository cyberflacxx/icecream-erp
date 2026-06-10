import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: { amount: number; type: 'credit' | 'debit' };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (body.amount === undefined || !body.type) {
    return badRequest('amount and type are required');
  }
  if (!['credit', 'debit'].includes(body.type)) {
    return badRequest('type must be "credit" or "debit"');
  }

  try {
    const { data: supplier, error: fetchErr } = await service
      .from('suppliers')
      .select('id, current_balance')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !supplier) return notFound('Supplier not found.');

    const s = supplier as Record<string, unknown>;
    const currentBalance = Number(s.current_balance ?? 0);
    const nextBalance =
      body.type === 'credit'
        ? currentBalance + body.amount
        : currentBalance - body.amount;

    const { data: updated, error: updateErr } = await service
      .from('suppliers')
      .update({ current_balance: nextBalance })
      .eq('id', id)
      .select('id, current_balance')
      .single();

    if (updateErr) return serverError(updateErr.message);

    const u = updated as Record<string, unknown>;
    return NextResponse.json({
      supplierId: u.id,
      currentBalance: Number(u.current_balance ?? 0),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
