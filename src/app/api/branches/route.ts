import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { syncUserBranchAssignment } from '@/lib/registration';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('branches')
      .select('id, code, name, phone, status, address, manager_id', { count: 'exact' })
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

    // Branch scoped: only show own branch
    if (ctx.isBranchScoped && ctx.branchId) {
      query = query.eq('id', ctx.branchId);
    }

    const from = (page - 1) * pageSize;
    const { data: branches, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const branchIds = (branches ?? []).map((b: { id: string }) => b.id);

    // Today's sales
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const { data: salesToday } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('branch_id, total_amount')
      .in('branch_id', branchIds)
      .gte('sale_date', today.toISOString())
      .lte('sale_date', todayEnd.toISOString());

    const salesMap = new Map<string, number>();
    for (const s of salesToday ?? []) {
      salesMap.set(s.branch_id, (salesMap.get(s.branch_id) ?? 0) + Number(s.total_amount ?? 0));
    }

    return NextResponse.json({
      data: (branches ?? []).map((b: Record<string, unknown>) => {
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          phone: b.phone,
          status: b.status,
          address: b.address,
          manager: null,
          todaySales: salesMap.get(b.id as string) ?? 0,
          stockStatus: b.status === 'ACTIVE' ? 'Operational' : 'Check Branch',
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: unknown }).message ?? '') : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const body = await request.json() as {
      code: string;
      name: string;
      phone?: string;
      address?: string;
      managerId?: string;
      status?: string;
    };

    if (!body.code || !body.name) return badRequest('code and name are required');

    if (body.managerId) {
      const { data: manager } = await service
        .schema('icecream_erp')
        .from('users')
        .select('id')
        .eq('id', body.managerId)
        .single();
      if (!manager) return badRequest('Branch manager not found');
    }

    const { data: branch, error } = await service
      .schema('icecream_erp')
      .from('branches')
      .insert({
        organization_id: ctx.organizationId,
        code: body.code,
        name: body.name,
        phone: body.phone ?? null,
        address: body.address ?? null,
        manager_id: body.managerId ?? null,
        status: body.status ?? 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw error;

    if (body.managerId) {
      await service
        .schema('icecream_erp')
        .from('users')
        .update({ branch_id: branch.id })
        .eq('id', body.managerId);

      await syncUserBranchAssignment({
        assignedBy: ctx.userId,
        branchId: String(branch.id),
        roleName: 'Branch Manager',
        service: service.schema('icecream_erp'),
        userProfileId: body.managerId,
      });
    }

    return NextResponse.json(branch, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
