import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write', 'finance.write')) return forbidden();

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    dueDate?: string | null;
    status?: string;
  };

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_invoices')
    .update({
      due_date: body.dueDate ?? undefined,
      status: body.status ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json(data);
}
