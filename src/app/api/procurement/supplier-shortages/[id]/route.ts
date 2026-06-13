import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    expectedResolutionDate?: string | null;
    procurementNote?: string | null;
    status?: string;
    supplierResponse?: string | null;
  };

  if (!body.status && !body.expectedResolutionDate && !body.procurementNote && !body.supplierResponse) {
    return badRequest('At least one field is required.');
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_shortages')
    .update({
      expected_resolution_date: body.expectedResolutionDate ?? undefined,
      procurement_note: body.procurementNote ?? undefined,
      status: body.status ?? undefined,
      supplier_response: body.supplierResponse ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json(data);
}
