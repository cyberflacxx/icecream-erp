import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingColumnError } from '@/lib/postgrest-compat';
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
      .select('id, code, name, type, warehouse_type, branch_id')
      .eq('is_active', true)
      .eq('organization_id', ctx.organizationId)
      .is('branch_id', null);

    const [suppliersPrimary, itemsPrimary, unitsRes, warehousesRes, purchaseOrdersRes, approversPrimary] = await Promise.all([
      service
        .from('suppliers')
        .select('id, code, name, email, phone, status, category_id')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'ACTIVE')
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
      warehouseQuery,
      service
        .from('purchase_orders')
        .select('id, po_number, status, supplier_id, suppliers(id, name)')
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .in('status', poStatusFilter)
        .order('created_at', { ascending: false }),
      service
        .from('users')
        .select('id, full_name, role')
        .eq('status', 'active')
        .order('full_name'),
    ]);

    const suppliersRes =
      suppliersPrimary.error && isMissingColumnError(suppliersPrimary.error, 'suppliers', 'deleted_at')
        ? await service
            .from('suppliers')
            .select('id, code, name, email, phone, status, category_id')
            .eq('organization_id', ctx.organizationId)
            .eq('status', 'ACTIVE')
            .order('name')
        : suppliersPrimary;

    const itemsRes =
      itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
        ? await service
            .from('items')
            .select('id, code, name, unit_of_measure_id')
            .eq('is_active', true)
            .eq('organization_id', ctx.organizationId)
            .order('name')
        : itemsPrimary;

    if (suppliersRes.error) return serverError(suppliersRes.error.message);
    if (itemsRes.error) return serverError(itemsRes.error.message);
    if (unitsRes.error) return serverError(unitsRes.error.message);
    if (warehousesRes.error) return serverError(warehousesRes.error.message);
    if (purchaseOrdersRes.error) return serverError(purchaseOrdersRes.error.message);

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
      approvers: ((approversPrimary.error ? [] : approversPrimary.data) ?? [])
        .filter((user) =>
          ['super_admin', 'branch_manager', 'manager', 'procurement_lead', 'procurement_manager'].includes(
            String(user.role ?? ''),
          ),
        )
        .map((user) => ({
          id: String(user.id),
          fullName: String(user.full_name ?? 'Unknown'),
          role: user.role ? String(user.role) : null,
        })),
      suppliers: suppliersRes.data ?? [],
      items: itemsRes.data ?? [],
      units: unitsRes.data ?? [],
      warehouses: (warehousesRes.data ?? []).map((warehouse) => ({
        branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
        code: String(warehouse.code ?? ''),
        id: String(warehouse.id),
        name: String(warehouse.name ?? ''),
        type: warehouse.type ? String(warehouse.type) : null,
        warehouseType: warehouse.warehouse_type ? String(warehouse.warehouse_type) : null,
      })),
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
