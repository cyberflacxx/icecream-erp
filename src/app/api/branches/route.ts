import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { filterAuthorizedBranches } from '@/lib/branch-access';
import { isMissingColumnError } from '@/lib/postgrest-compat';
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
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const selector = searchParams.get('selector') === 'true';

  try {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
      let query = service
        .schema('icecream_erp')
        .from('branches')
        .select('id, organization_id, code, name, phone, status, address, manager_id', { count: selector ? undefined : 'exact' })
        .eq('organization_id', ctx.organizationId)
        .order('name', { ascending: true });

      if (includeDeletedAtFilter) {
        query = query.is('deleted_at', null);
      }

      if (status) {
        query = query.eq('status', status);
      } else if (!includeInactive) {
        query = query.eq('status', 'ACTIVE');
      }
      if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

      return query;
    };

    let query = buildQuery(true);
    const from = (page - 1) * pageSize;
    let result = selector ? await query.limit(pageSize) : await query.range(from, from + pageSize - 1);

    if (result.error && isMissingColumnError(result.error, 'branches', 'deleted_at')) {
      query = buildQuery(false);
      result = selector ? await query.limit(pageSize) : await query.range(from, from + pageSize - 1);
    }

    const { data: branches, count, error } = result;
    if (error) throw error;

    const authorizedBranches = filterAuthorizedBranches(
      {
        branchAssignments: ctx.branchAssignments,
        branchId: ctx.branchId,
        isBranchScoped: ctx.isBranchScoped,
        organizationId: ctx.organizationId,
        permissions: ctx.permissions,
      },
      (branches ?? []).map((branch) => ({
        code: branch.code ? String(branch.code) : null,
        id: String(branch.id),
        name: branch.name ? String(branch.name) : null,
        organizationId: String(branch.organization_id ?? ''),
        status: branch.status ? String(branch.status) : null,
      })),
      { includeInactive },
    );

    const branchIds = authorizedBranches.map((branch) => branch.id);
    const warehouseResult = branchIds.length
      ? await service
          .schema('icecream_erp')
          .from('warehouses')
          .select('id, branch_id, code, name, type, warehouse_type, is_active')
          .eq('organization_id', ctx.organizationId)
          .in('branch_id', branchIds)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : { data: [], error: null };
    if (warehouseResult.error) throw warehouseResult.error;

    const defaultWarehouseByBranchId = new Map<string, { id: string; code: string; name: string }>();
    for (const warehouse of warehouseResult.data ?? []) {
      const branchId = String(warehouse.branch_id ?? '');
      if (!branchId || defaultWarehouseByBranchId.has(branchId)) continue;
      defaultWarehouseByBranchId.set(branchId, {
        code: String(warehouse.code ?? ''),
        id: String(warehouse.id),
        name: String(warehouse.name ?? ''),
      });
    }

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
      data: authorizedBranches.map((branch) => {
        const defaultWarehouse = defaultWarehouseByBranchId.get(branch.id) ?? null;
        return {
          id: branch.id,
          code: branch.code ?? '',
          name: branch.name ?? '',
          organizationId: ctx.organizationId,
          phone: (branches ?? []).find((candidate) => String(candidate.id) === branch.id)?.phone ?? null,
          status: branch.status ?? 'ACTIVE',
          address: (branches ?? []).find((candidate) => String(candidate.id) === branch.id)?.address ?? null,
          manager: null,
          defaultWarehouseId: defaultWarehouse?.id ?? null,
          defaultWarehouse,
          todaySales: salesMap.get(branch.id) ?? 0,
          stockStatus: branch.status === 'ACTIVE' ? 'Operational' : 'Check Branch',
        };
      }),
      pagination: selector ? undefined : { page, pageSize, total: count ?? authorizedBranches.length },
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
