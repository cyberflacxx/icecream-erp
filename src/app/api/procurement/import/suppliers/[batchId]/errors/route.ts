import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.import', 'procurement.supplier.view', 'procurement.read')) return forbidden();

  const { batchId } = await params;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('audit_logs')
    .select('entity_id, new_values, created_at')
    .eq('organization_id', ctx.organizationId)
    .eq('entity_type', 'procurement_supplier_import')
    .eq('entity_id', batchId)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Import batch not found.');

  const meta = (data.new_values ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    batchId: data.entity_id,
    createdAt: data.created_at,
    errors: Array.isArray(meta.errors) ? meta.errors : [],
  });
}
