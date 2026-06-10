import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const poStatusFilter = ['sent_to_supplier', 'partial_received'];
    const warehouseQuery = service
      .from('warehouses')
      .select('*')
      .eq('is_active', true)
      .eq('organization_id', ctx.organizationId);

    const [suppliersRes, itemsRes, unitsRes, warehousesRes, purchaseOrdersRes] = await Promise.all([
      service
        .from('suppliers')
        .select('id, code, name, email, phone, status, category_id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .order('name'),
      service
        .from('items')
        .select('id, code, name, unit_of_measure_id')
        .is('deleted_at', null)
        .eq('is_active', true)
        .eq('organization_id', ctx.organizationId)
        .order('name'),
      service
        .from('units_of_measure')
        .select('id, name, abbreviation')
        .eq('organization_id', ctx.organizationId)
        .order('name'),
      ctx.isBranchScoped && ctx.branchId
        ? warehouseQuery.eq('branch_id', ctx.branchId)
        : warehouseQuery,
      service
        .from('purchase_orders')
        .select('id, po_number, status, supplier_id, suppliers(id, name)')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .in('status', poStatusFilter)
        .order('created_at', { ascending: false }),
    ]);

    const departmentsRes = await service
      .from('purchase_requisitions')
      .select('department')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('department');

    const uniqueDepartments = [
      ...new Set((departmentsRes.data ?? []).map((r: { department: string }) => r.department).filter(Boolean)),
    ];

    return NextResponse.json({
      suppliers: suppliersRes.data ?? [],
      items: itemsRes.data ?? [],
      units: unitsRes.data ?? [],
      warehouses: warehousesRes.data ?? [],
      purchaseOrders: (purchaseOrdersRes.data ?? []).map((o: Record<string, unknown>) => ({
        id: o.id,
        poNumber: o.po_number,
        status: o.status,
        supplier: o.suppliers
          ? { id: (o.suppliers as Record<string, unknown>).id, name: (o.suppliers as Record<string, unknown>).name }
          : null,
      })),
      departments: uniqueDepartments,
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
