import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status');
  const department = searchParams.get('department');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = service
      .from('purchase_requisitions')
      .select(
        `id, requisition_number, department, request_date, needed_by_date, status,
         users!purchase_requisitions_requested_by_fkey(id, full_name)`,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (department) query = query.eq('department', department);
    if (startDate) query = query.gte('request_date', startDate);
    if (endDate) query = query.lte('request_date', endDate);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);

    if (error) return serverError(error.message);

    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      requisitionNumber: r.requisition_number,
      department: r.department,
      requestDate: r.request_date,
      neededByDate: r.needed_by_date,
      status: r.status,
      requestedBy: r.users
        ? String((r.users as Record<string, unknown>).full_name ?? 'Unknown')
        : 'Unknown',
    }));

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    department: string;
    neededByDate?: string | null;
    remarks?: string | null;
    items: Array<{
      itemId: string;
      unitOfMeasureId: string;
      quantityRequested: number;
      estimatedUnitCost?: number | null;
      remarks?: string | null;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.department || !body.items?.length) {
    return badRequest('department and items are required');
  }

  try {
    // Validate items exist
    const itemIds = [...new Set(body.items.map((i) => i.itemId))];
    const unitIds = [...new Set(body.items.map((i) => i.unitOfMeasureId))];

    const [itemsCheck, unitsCheck] = await Promise.all([
      service
        .from('items')
        .select('id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .in('id', itemIds),
      service
        .from('units_of_measure')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .in('id', unitIds),
    ]);

    if ((itemsCheck.data?.length ?? 0) !== itemIds.length || (unitsCheck.data?.length ?? 0) !== unitIds.length) {
      return badRequest('One or more requisition items are invalid.');
    }

    // Generate requisition number
    const { count: reqCount } = await service
      .from('purchase_requisitions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const requisitionNumber = `REQ-${String((reqCount ?? 0) + 1).padStart(5, '0')}`;

    const { data: requisition, error: reqErr } = await service
      .from('purchase_requisitions')
      .insert({
        requisition_number: requisitionNumber,
        department: body.department,
        needed_by_date: body.neededByDate ?? null,
        remarks: body.remarks ?? null,
        request_date: new Date().toISOString(),
        requested_by: ctx.userId,
        organization_id: ctx.organizationId,
        status: 'draft',
        approval_status: 'draft',
      })
      .select()
      .single();

    if (reqErr) return serverError(reqErr.message);

    const { error: itemsErr } = await service.from('purchase_requisition_items').insert(
      body.items.map((item) => ({
        requisition_id: (requisition as Record<string, unknown>).id,
        item_id: item.itemId,
        unit_of_measure_id: item.unitOfMeasureId,
        quantity_requested: item.quantityRequested,
        quantity_approved: null,
        estimated_unit_cost: item.estimatedUnitCost ?? null,
        remarks: item.remarks ?? null,
      })),
    );

    if (itemsErr) return serverError(itemsErr.message);

    const { data: full } = await service
      .from('purchase_requisitions')
      .select('*, purchase_requisition_items(*)')
      .eq('id', (requisition as Record<string, unknown>).id)
      .single();

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
