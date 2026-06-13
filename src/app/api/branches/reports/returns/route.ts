import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService } from '@/lib/branches-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'sales.read', 'quality.read')) return forbidden();
  try {
    const service = branchService();
    const { data, error } = await service.from('branch_returns').select('branch_id, return_number, quantity_returned, return_reason, qc_status, final_action, status, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
