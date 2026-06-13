import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.approve', 'quality.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_returns')
    .update({
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json(data);
}
