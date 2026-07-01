import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.import', 'procurement.supplier.view', 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('audit_logs')
    .select('entity_id, action, created_at, new_values')
    .eq('organization_id', ctx.organizationId)
    .eq('entity_type', 'procurement_supplier_import')
    .order('created_at', { ascending: false });

  if (error) return serverError(error.message);

  return NextResponse.json(
    (data ?? []).map((row) => {
      const meta = (row.new_values ?? {}) as Record<string, unknown>;
      const errors = Array.isArray(meta.errors) ? meta.errors : [];

      return {
        batchId: row.entity_id,
        createdAt: row.created_at,
        createdCount: Number(meta.created ?? 0),
        errorCount: errors.length,
        fileName: String(meta.fileName ?? 'supplier-import-template.csv'),
        status: row.action === 'PROCUREMENT_SUPPLIER_IMPORT_COMPLETED' ? 'COMPLETED' : 'REJECTED',
        totalRows: Number(meta.totalRows ?? 0),
      };
    }),
  );
}
