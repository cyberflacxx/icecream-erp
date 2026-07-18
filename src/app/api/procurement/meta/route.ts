import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { getErrorMessage, isMissingColumnError } from '@/lib/postgrest-compat';
import { getSafeSupplierErrorDetails, listSupplierOptionRecords } from '@/lib/procurement-suppliers';
import { createServiceRoleClient } from '@/lib/supabase/server';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function mapItemType(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.toUpperCase() : null;
}

function mapUnitLabel(unit: Record<string, unknown>) {
  return String(unit.name ?? unit.abbreviation ?? unit.code ?? 'Unit');
}

function mapPurchaseOrderStatus(value: unknown) {
  const normalized = normalizeStatus(value);
  if (normalized === 'SENT_TO_SUPPLIER' || normalized === 'SENT') return 'SENT_TO_SUPPLIER';
  if (normalized === 'APPROVED' || normalized === 'LEVEL1_APPROVED' || normalized === 'LEVEL2_APPROVED') return 'APPROVED';
  if (normalized === 'PARTIAL_RECEIVED' || normalized === 'PARTIALLY_RECEIVED') return 'PARTIAL_RECEIVED';
  if (normalized === 'FULLY_RECEIVED' || normalized === 'RECEIVED') return 'FULLY_RECEIVED';
  return normalized;
}

function isReceivablePurchaseOrderStatus(value: unknown) {
  return new Set(['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED']).has(mapPurchaseOrderStatus(value));
}

async function loadItems(service: ReturnType<typeof createServiceRoleClient>, organizationId: string) {
  const baseColumns = [
    'id',
    'code',
    'name',
    'description',
    'item_type',
    'type',
    'unit_of_measure_id',
    'unit_id',
    'unit_cost',
    'standard_cost',
    'selling_price',
    'reorder_level',
    'is_active',
    'deleted_at',
  ];

  let columns = [...baseColumns];
  let lastError: unknown = null;

  while (columns.length >= 4) {
    const result = await service
      .from('items')
      .select(columns.join(', '))
      .eq('organization_id', organizationId)
      .order('name');

    if (!result.error) {
      return (result.data ?? []) as Array<Record<string, unknown>>;
    }

    lastError = result.error;
    const removable = ['deleted_at', 'item_type', 'unit_of_measure_id', 'unit_cost', 'reorder_level', 'selling_price']
      .find((column) => isMissingColumnError(result.error, 'items', column));

    if (!removable) {
      throw result.error;
    }

    columns = columns.filter((column) => column !== removable);
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load items.');
}

async function loadUnits(service: ReturnType<typeof createServiceRoleClient>, organizationId: string) {
  const candidates = [
    'id, name, abbreviation, code, symbol, is_active, deleted_at',
    'id, name, abbreviation, code, is_active, deleted_at',
    'id, name, abbreviation, code, is_active',
    'id, name, abbreviation, code',
    'id, name, abbreviation',
  ];

  for (const selectClause of candidates) {
    const result = await service
      .from('units_of_measure')
      .select(selectClause)
      .eq('organization_id', organizationId)
      .order('name');

    if (!result.error) {
      return (result.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  throw new Error('Unable to load units of measure.');
}

async function loadApprovers(service: ReturnType<typeof createServiceRoleClient>, organizationId: string) {
  const usersResult = await service
    .from('users')
    .select('id, full_name, role, status')
    .eq('organization_id', organizationId)
    .order('full_name');

  if (usersResult.error) {
    throw usersResult.error;
  }

  const rolesResult = await service
    .from('user_roles')
    .select('user_profile_id, roles(name, code)')
    .eq('organization_id', organizationId);

  const roleMap = new Map<string, string[]>();
  if (!rolesResult.error) {
    for (const row of (rolesResult.data ?? []) as Array<Record<string, unknown>>) {
      const userId = String(row.user_profile_id ?? '');
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      if (!userId || !role || typeof role !== 'object') continue;
      const roleRecord = role as Record<string, unknown>;
      const label = String(roleRecord.name ?? roleRecord.code ?? '').trim();
      if (!label) continue;
      roleMap.set(userId, [...(roleMap.get(userId) ?? []), label]);
    }
  }

  const approvalKeywords = ['APPROVER', 'MANAGER', 'ADMIN', 'SUPERVISOR', 'PROCUREMENT', 'AUDITOR'];

  const rows = ((usersResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((user) => normalizeStatus(user.status || 'ACTIVE') === 'ACTIVE')
    .map((user) => {
      const id = String(user.id ?? '');
      const legacyRole = String(user.role ?? '').trim();
      const roleNames = roleMap.get(id) ?? (legacyRole ? [legacyRole] : []);
      const roleSummary = roleNames.join(', ');
      return {
        fullName: String(user.full_name ?? 'Unknown user'),
        id,
        role: roleSummary || null,
      };
    });

  const filtered = rows.filter((user) =>
    (user.role ?? '')
      .toUpperCase()
      .split(/[,\s]+/)
      .some((token) => approvalKeywords.some((keyword) => token.includes(keyword))),
  );

  return filtered.length > 0 ? filtered : rows;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    let warehouseQuery = service
      .from('warehouses')
      .select('id, code, name, type, warehouse_type, branch_id, is_active')
      .eq('organization_id', ctx.organizationId);

    if (ctx.isBranchScoped && ctx.branchId) {
      warehouseQuery = warehouseQuery.or(`branch_id.eq.${ctx.branchId},branch_id.is.null`);
    }

    const [
      suppliersResult,
      itemsResult,
      unitsResult,
      warehousesResult,
      purchaseOrdersResult,
      purchaseOrderItemsResult,
      stockBalancesResult,
      goodsReceivedNotesResult,
      grnItemsResult,
      approversResult,
      departmentsResult,
    ] = await Promise.allSettled([
      listSupplierOptionRecords(service, ctx.organizationId),
      loadItems(service, ctx.organizationId),
      loadUnits(service, ctx.organizationId),
      warehouseQuery.order('name'),
      service
        .from('purchase_orders')
        .select('id, po_number, status, supplier_id, suppliers(id, name)')
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false }),
      service
        .from('purchase_order_items')
        .select('po_id, purchase_order_id, item_id, quantity, quantity_ordered, received_qty, quantity_received'),
      service
        .from('stock_balances')
        .select('item_id, warehouse_id, quantity_on_hand, quantity_available, quantity'),
      service
        .from('goods_received_notes')
        .select('id, received_date, status')
        .eq('organization_id', ctx.organizationId)
        .order('received_date', { ascending: false }),
      service
        .from('goods_received_note_items')
        .select('grn_id, goods_received_note_id, item_id, quantity_received, accepted_quantity'),
      loadApprovers(service, ctx.organizationId),
      service
        .from('purchase_requisitions')
        .select('department')
        .eq('organization_id', ctx.organizationId)
        .order('department'),
    ]);

    const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
    const itemsData = itemsResult.status === 'fulfilled' ? itemsResult.value : [];
    const unitsData = unitsResult.status === 'fulfilled' ? unitsResult.value : [];
    const warehouseRows =
      warehousesResult.status === 'fulfilled' && !warehousesResult.value.error
        ? ((warehousesResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const purchaseOrdersRows =
      purchaseOrdersResult.status === 'fulfilled' && !purchaseOrdersResult.value.error
        ? ((purchaseOrdersResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const purchaseOrderItemsRows =
      purchaseOrderItemsResult.status === 'fulfilled' && !purchaseOrderItemsResult.value.error
        ? ((purchaseOrderItemsResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const stockBalancesRows =
      stockBalancesResult.status === 'fulfilled' && !stockBalancesResult.value.error
        ? ((stockBalancesResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const goodsReceivedNotesRows =
      goodsReceivedNotesResult.status === 'fulfilled' && !goodsReceivedNotesResult.value.error
        ? ((goodsReceivedNotesResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const grnItemsRows =
      grnItemsResult.status === 'fulfilled' && !grnItemsResult.value.error
        ? ((grnItemsResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];
    const approvers = approversResult.status === 'fulfilled' ? approversResult.value : [];
    const departments =
      departmentsResult.status === 'fulfilled' && !departmentsResult.value.error
        ? ((departmentsResult.value.data ?? []) as Array<Record<string, unknown>>)
        : [];

    const safeErrors = [
      suppliersResult.status === 'rejected' ? getSafeSupplierErrorDetails(suppliersResult.reason, 'procurement_meta_suppliers') : null,
      itemsResult.status === 'rejected' ? { message: getErrorMessage(itemsResult.reason), step: 'procurement_meta_items', table: 'items' } : null,
      unitsResult.status === 'rejected' ? { message: getErrorMessage(unitsResult.reason), step: 'procurement_meta_units', table: 'units_of_measure' } : null,
      approversResult.status === 'rejected' ? { message: getErrorMessage(approversResult.reason), step: 'procurement_meta_approvers', table: 'users' } : null,
    ].filter(Boolean);

    for (const entry of safeErrors) {
      console.error('Procurement meta section failed.', entry);
    }

    const activeWarehouses = warehouseRows
      .filter((warehouse) => warehouse.is_active !== false)
      .map((warehouse) => ({
        branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
        code: String(warehouse.code ?? ''),
        id: String(warehouse.id),
        label: warehouse.code ? `${String(warehouse.code)} - ${String(warehouse.name ?? '')}` : String(warehouse.name ?? ''),
        name: String(warehouse.name ?? ''),
        type: warehouse.type ? String(warehouse.type) : null,
        warehouseType: warehouse.warehouse_type ? String(warehouse.warehouse_type) : null,
      }));

    const warehouseById = new Map(activeWarehouses.map((warehouse) => [warehouse.id, warehouse]));
    const unitById = new Map(
      unitsData
        .filter((unit) => unit.is_active !== false && unit.deleted_at == null)
        .map((unit) => [String(unit.id), unit]),
    );
    const receivablePurchaseOrders = purchaseOrdersRows.filter((row) => isReceivablePurchaseOrderStatus(row.status));
    const receivablePurchaseOrderIds = new Set(receivablePurchaseOrders.map((row) => String(row.id ?? '')));
    const itemInventory = new Map<
      string,
      {
        currentStock: number;
        lastReceivedDate: string | null;
        quantityOnOrder: number;
        quantityReceivedToday: number;
        warehouses: Array<{ id: string; code: string; name: string; quantity: number }>;
      }
    >();
    const receivedNoteById = new Map(
      goodsReceivedNotesRows.map((row) => [
        String(row.id ?? ''),
        {
          receivedDate: row.received_date ? String(row.received_date) : null,
          status: row.status ? String(row.status) : null,
        },
      ]),
    );
    const todayKey = new Date().toISOString().slice(0, 10);

    for (const row of stockBalancesRows) {
      const itemId = String(row.item_id ?? '');
      const warehouseId = String(row.warehouse_id ?? '');
      const warehouse = warehouseById.get(warehouseId);
      if (!itemId || !warehouse) continue;

      const quantity = toNumber(row.quantity_available ?? row.quantity_on_hand ?? row.quantity);
      const summary = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };

      summary.currentStock += quantity;
      summary.warehouses.push({
        code: warehouse.code,
        id: warehouse.id,
        name: warehouse.name,
        quantity,
      });
      itemInventory.set(itemId, summary);
    }

    for (const row of purchaseOrderItemsRows) {
      const poId = String(row.po_id ?? row.purchase_order_id ?? '');
      const itemId = String(row.item_id ?? '');
      if (!poId || !itemId || !receivablePurchaseOrderIds.has(poId)) continue;

      const ordered = toNumber(row.quantity_ordered ?? row.quantity);
      const received = toNumber(row.quantity_received ?? row.received_qty);
      const outstanding = Math.max(0, ordered - received);
      if (outstanding <= 0) continue;

      const summary = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };
      summary.quantityOnOrder += outstanding;
      itemInventory.set(itemId, summary);
    }

    for (const row of grnItemsRows) {
      const grnId = String(row.grn_id ?? row.goods_received_note_id ?? '');
      const itemId = String(row.item_id ?? '');
      if (!grnId || !itemId) continue;

      const note = receivedNoteById.get(grnId);
      const receivedDate = note?.receivedDate?.slice(0, 10) ?? null;
      const quantity = toNumber(row.accepted_quantity ?? row.quantity_received);
      const summary = itemInventory.get(itemId) ?? {
        currentStock: 0,
        lastReceivedDate: null,
        quantityOnOrder: 0,
        quantityReceivedToday: 0,
        warehouses: [],
      };

      if (receivedDate && (!summary.lastReceivedDate || receivedDate > summary.lastReceivedDate)) {
        summary.lastReceivedDate = receivedDate;
      }
      if (receivedDate === todayKey) {
        summary.quantityReceivedToday += quantity;
      }
      itemInventory.set(itemId, summary);
    }

    const response = {
      approvers,
      departments: [...new Set(departments.map((row) => String(row.department ?? '').trim()).filter(Boolean))],
      items: itemsData
        .filter((item) => item.is_active !== false && item.deleted_at == null)
        .map((item) => {
          const id = String(item.id ?? '');
          const unitId = String(item.unit_of_measure_id ?? item.unit_id ?? '') || null;
          const unit = unitId ? unitById.get(unitId) ?? null : null;
          const inventory = itemInventory.get(id);
          const unitCost = toNumber(item.unit_cost ?? item.standard_cost);

          return {
            code: String(item.code ?? ''),
            cost_price: unitCost,
            default_purchase_price: unitCost,
            description: item.description ? String(item.description) : null,
            id,
            inventory: {
              currentStock: inventory?.currentStock ?? 0,
              isLowStock: toNumber(item.reorder_level) > 0 && (inventory?.currentStock ?? 0) <= toNumber(item.reorder_level),
              lastReceivedDate: inventory?.lastReceivedDate ?? null,
              primaryWarehouseName: inventory?.warehouses[0]?.name ?? null,
              quantityOnOrder: inventory?.quantityOnOrder ?? 0,
              quantityReceivedToday: inventory?.quantityReceivedToday ?? 0,
              reorderLevel: toNumber(item.reorder_level),
              warehouses: (inventory?.warehouses ?? []).sort((left, right) => right.quantity - left.quantity).slice(0, 3),
            },
            itemType: mapItemType(item.item_type ?? item.type),
            label: item.code ? `${String(item.code)} - ${String(item.name ?? item.code)}` : String(item.name ?? 'Unnamed item'),
            name: String(item.name ?? item.code ?? 'Unnamed item'),
            purchase_price: unitCost,
            uomName: unit ? mapUnitLabel(unit) : null,
            unit_of_measure_id: unitId,
            unit_of_measure_name: unit ? mapUnitLabel(unit) : null,
            unitOfMeasureId: unitId,
            unitOfMeasureName: unit ? mapUnitLabel(unit) : null,
            unit_cost: unitCost,
          };
        }),
      purchaseOrders: receivablePurchaseOrders.map((row) => {
        const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
        const supplierRecord = supplier && typeof supplier === 'object' ? (supplier as Record<string, unknown>) : null;
        const poNumber = String(row.po_number ?? 'Purchase order');
        const supplierName = String(supplierRecord?.name ?? 'Unknown supplier');
        const supplierId = supplierRecord?.id ? String(supplierRecord.id) : row.supplier_id ? String(row.supplier_id) : null;
        return {
          id: String(row.id),
          label: `${poNumber} - ${supplierName}`,
          poNumber,
          purchase_order_id: String(row.id),
          status: mapPurchaseOrderStatus(row.status),
          supplier: supplierId ? { id: supplierId, name: supplierName } : null,
          supplierId,
          supplierName,
          supplier_id: supplierId,
          supplier_name: supplierName,
        };
      }),
      suppliers,
      units: unitsData
        .filter((unit) => unit.is_active !== false && unit.deleted_at == null)
        .map((unit) => ({
          abbreviation: String(unit.abbreviation ?? unit.code ?? unit.name ?? ''),
          code: unit.code ? String(unit.code) : unit.abbreviation ? String(unit.abbreviation) : null,
          id: String(unit.id),
          label: mapUnitLabel(unit),
          name: String(unit.name ?? unit.abbreviation ?? 'Unit'),
          symbol: unit.symbol ? String(unit.symbol) : unit.abbreviation ? String(unit.abbreviation) : null,
        })),
      warehouses: activeWarehouses,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Procurement meta request failed.', getSafeSupplierErrorDetails(error, 'procurement_meta'));
    return serverError('Unable to load procurement form options right now.');
  }
}
