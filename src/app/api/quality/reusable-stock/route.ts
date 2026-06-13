import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'inventory.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('reusable_stock_approvals').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
