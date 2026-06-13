import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateBranchCustomerCodeUniqueness } from '@/lib/branches';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'branches.read')) return forbidden();

  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_customers')
      .select('id, customer_code, customer_name, phone_number, customer_type, credit_allowed, credit_limit, current_balance, is_active')
      .eq('branch_id', id)
      .order('customer_name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'branches.write')) return forbidden();

  const { id } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      creditAllowed?: boolean;
      creditLimit?: number;
      customerCode: string;
      customerName: string;
      customerType?: string;
      phoneNumber?: string;
    };
    if (!body.customerCode || !body.customerName) return badRequest('customerCode and customerName are required');

    const { data: existing, error: existingError } = await service.from('branch_customers').select('branch_id, customer_code');
    if (existingError) throw existingError;
    if (!validateBranchCustomerCodeUniqueness((existing ?? []).map((row) => ({ branchId: String(row.branch_id), customerCode: String(row.customer_code) })), id, body.customerCode)) {
      return badRequest('Duplicate customer code within branch');
    }

    const { data, error } = await service
      .from('branch_customers')
      .insert({
        branch_id: id,
        customer_code: body.customerCode,
        customer_name: body.customerName,
        phone_number: body.phoneNumber ?? null,
        customer_type: body.customerType ?? 'WALK_IN',
        credit_allowed: body.creditAllowed ?? false,
        credit_limit: body.creditLimit ?? 0,
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_CUSTOMER_CREATED', data.id, ctx.userId, { branchId: id, customerCode: body.customerCode }, 'branch_customer');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
