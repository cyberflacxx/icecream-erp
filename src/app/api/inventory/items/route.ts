import { NextRequest, NextResponse } from 'next/server';

import {
  apiServerError,
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { resolveRequestedBranchId } from '@/lib/branch-access';
import { buildItemSelectorOptions } from '@/lib/item-selector';
import { loadResolvedSalesItemPricing, loadSalesCustomerPricingContext } from '@/lib/sales-pricing';
import { createServiceRoleClient } from '@/lib/supabase/server';

function normalizeItem(
  row: Record<string, unknown>,
  categories = new Map<string, Record<string, unknown>>(),
  units = new Map<string, Record<string, unknown>>(),
) {
  const categoryId = String(row.category_id ?? '');
  const unitId = String(row.unit_of_measure_id ?? row.unit_id ?? '');
  const category = categoryId ? categories.get(categoryId) ?? null : null;
  const unit = unitId ? units.get(unitId) ?? null : null;
  const itemType = String(row.item_type ?? row.type ?? 'RAW_MATERIAL');
  const reorderLevel = Number(row.reorder_level ?? 0);
  const reorderQuantity = Number(row.reorder_quantity ?? row.reorder_qty ?? 0);
  const sellingPrice = Number(row.selling_price ?? 0);
  const unitCost = Number(row.unit_cost ?? row.standard_cost ?? 0);

  return {
    code: String(row.code ?? ''),
    category: {
      id: categoryId,
      name: String(category?.name ?? 'Uncategorized'),
    },
    description: row.description ? String(row.description) : null,
    id: String(row.id ?? ''),
    isActive: row.is_active !== false,
    itemType,
    name: String(row.name ?? row.code ?? 'Unnamed item'),
    reorderLevel: Number.isFinite(reorderLevel) ? reorderLevel : 0,
    reorderQuantity: Number.isFinite(reorderQuantity) ? reorderQuantity : 0,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
    stock: Number(row.stock ?? row.quantity_on_hand ?? 0) || 0,
    trackExpiry: Boolean(row.track_expiry ?? row.shelf_life_days),
    unitCost: Number.isFinite(unitCost) ? unitCost : 0,
    unitOfMeasure: {
      abbreviation: String(unit?.abbreviation ?? '--'),
      id: unitId,
      name: String(unit?.name ?? 'Unit'),
    },
  };
}

function matchesRequestedItemTypes(row: Record<string, unknown>, requestedTypes: string[]) {
  if (requestedTypes.length === 0) return true;
  const resolvedType = String(row.item_type ?? row.type ?? '').trim().toUpperCase();
  return requestedTypes.includes(resolvedType);
}

function buildSelectorRequestId(request: NextRequest) {
  return request.headers.get('x-request-id')?.trim() || `item-selector-${crypto.randomUUID()}`;
}

function jsonWithRequestId(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json(body, {
    headers: { 'x-request-id': requestId },
    status,
  });
}

function buildSelectorFailureResponse(input: {
  code: string;
  message: string;
  requestId: string;
  status: number;
}) {
  return jsonWithRequestId(
    {
      success: false,
      error: {
        code: input.code,
        message: input.message,
        requestId: input.requestId,
      },
    },
    input.requestId,
    input.status,
  );
}

function toSupabaseCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '') || null;
  }

  return null;
}

function toSupabaseMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '') || null;
  }

  return null;
}

function logSelectorRequest(
  requestId: string,
  details: {
    branchId?: string | null;
    httpStatus: number;
    itemTypes: string[];
    organizationId?: string | null;
    page: number;
    pageSize: number;
    returnedRows?: number | null;
    role?: string | null;
    search?: string | null;
    supabaseCode?: string | null;
    supabaseMessage?: string | null;
    userId?: string | null;
    warehouseId?: string | null;
  },
) {
  console.info('inventory.item-selector', {
    branchId: details.branchId ?? null,
    httpStatus: details.httpStatus,
    itemTypes: details.itemTypes,
    organizationId: details.organizationId ?? null,
    page: details.page,
    pageSize: details.pageSize,
    requestId,
    returnedRows: details.returnedRows ?? null,
    role: details.role ?? null,
    search: details.search ?? null,
    supabaseCode: details.supabaseCode ?? null,
    supabaseMessage: details.supabaseMessage ?? null,
    userId: details.userId ?? null,
    warehouseId: details.warehouseId ?? null,
  });
}

export async function GET(request: NextRequest) {
  const requestId = buildSelectorRequestId(request);
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const selector = searchParams.get('selector') === 'true';
  const branchIdParam = searchParams.get('branch_id') ?? searchParams.get('branchId');
  const customerIdParam = searchParams.get('customer_id') ?? searchParams.get('customerId');
  const warehouseId = searchParams.get('warehouse_id') ?? searchParams.get('warehouseId');
  const includeStock = searchParams.get('include_stock') === 'true' || searchParams.get('includeStock') === 'true';
  const includeCost = searchParams.get('include_cost') === 'true' || searchParams.get('includeCost') === 'true';
  const includePrice = searchParams.get('include_price') === 'true' || searchParams.get('includePrice') === 'true';
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const selectorPageSize = Math.min(
    500,
    Math.max(25, parseInt(searchParams.get('limit') ?? searchParams.get('pageSize') ?? '200', 10)),
  );
  const typeFilters = (searchParams.get('item_type') ?? searchParams.get('itemType') ?? type)
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const ctx = await getAuthContext(request);
  if (!ctx) {
    if (selector) {
      logSelectorRequest(requestId, {
        httpStatus: 401,
        itemTypes: typeFilters,
        page: 1,
        pageSize: selectorPageSize,
        search,
        userId: null,
        warehouseId,
      });
      return buildSelectorFailureResponse({
        code: 'ITEM_AUTH_REQUIRED',
        message: 'Authentication is required to load selector items.',
        requestId,
        status: 401,
      });
    }

    return unauthorized();
  }

  if (!ctx.organizationId) {
    if (selector) {
      logSelectorRequest(requestId, {
        branchId: ctx.branchId,
        httpStatus: 422,
        itemTypes: typeFilters,
        organizationId: null,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        userId: ctx.userId,
        warehouseId,
      });
      return buildSelectorFailureResponse({
        code: 'ITEM_ORGANIZATION_REQUIRED',
        message: 'Organization context is missing for the item selector.',
        requestId,
        status: 422,
      });
    }

    return serverError('Organization context is missing.', 'ORGANIZATION_CONTEXT_MISSING');
  }

  if (!can(ctx, 'inventory.read')) {
    if (selector) {
      logSelectorRequest(requestId, {
        branchId: ctx.branchId,
        httpStatus: 403,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        userId: ctx.userId,
        warehouseId,
      });
      return buildSelectorFailureResponse({
        code: 'ITEM_ACCESS_DENIED',
        message: 'You do not have permission to load selector items.',
        requestId,
        status: 403,
      });
    }

    return forbidden();
  }

  let service;
  try {
    service = createServiceRoleClient();
  } catch (error) {
    if (selector) {
      logSelectorRequest(requestId, {
        branchId: ctx.branchId,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
        supabaseMessage: toSupabaseMessage(error),
        userId: ctx.userId,
        warehouseId,
      });
      return buildSelectorFailureResponse({
        code: 'ITEM_ENV_MISCONFIGURED',
        message: 'The inventory selector is not configured correctly in this deployment.',
        requestId,
        status: 500,
      });
    }

    return apiServerError({
      ctx,
      error,
      message: 'Inventory service configuration is missing.',
      module: 'inventory.items',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }

  if (selector) {
    let branchLookup = service
      .from('branches')
      .select('id, organization_id, status')
      .eq('organization_id', ctx.organizationId)
      .order('name', { ascending: true });

    if (branchIdParam) {
      branchLookup = branchLookup.eq('id', branchIdParam);
    }

    const branchResult = await branchLookup;
    if (branchResult.error) {
      logSelectorRequest(requestId, {
        branchId: branchIdParam,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: toSupabaseCode(branchResult.error),
        supabaseMessage: toSupabaseMessage(branchResult.error),
        userId: ctx.userId,
        warehouseId,
      });
      return apiServerError({
        ctx,
        error: branchResult.error,
        message: 'Branches could not be loaded for the item selector.',
        module: 'inventory.item-selector',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    const branchAuthorization = resolveRequestedBranchId(
      {
        branchAssignments: ctx.branchAssignments,
        branchId: ctx.branchId,
        isBranchScoped: ctx.isBranchScoped,
        organizationId: ctx.organizationId,
        permissions: ctx.permissions,
      },
      branchIdParam,
      (branchResult.data ?? []).map((branch) => ({
        id: String(branch.id),
        organizationId: String(branch.organization_id ?? ''),
        status: branch.status ? String(branch.status) : null,
      })),
      { includeInactive: true },
    );
    if (!branchAuthorization.ok) {
      logSelectorRequest(requestId, {
        branchId: branchIdParam,
        httpStatus: branchAuthorization.status,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        userId: ctx.userId,
        warehouseId,
      });
      return buildSelectorFailureResponse({
        code: branchAuthorization.status === 403 ? 'ITEM_ACCESS_DENIED' : 'ITEM_BRANCH_INVALID',
        message: branchAuthorization.message,
        requestId,
        status: branchAuthorization.status,
      });
    }

    const effectiveBranchId = branchAuthorization.branchId;
    const authorizedWarehouseId = warehouseId ? String(warehouseId) : null;

    let warehouseQuery = service
      .from('warehouses')
      .select('id, branch_id')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true);

    if (authorizedWarehouseId) {
      warehouseQuery = warehouseQuery.eq('id', authorizedWarehouseId);
    } else if (effectiveBranchId) {
      warehouseQuery = warehouseQuery.eq('branch_id', effectiveBranchId);
    } else if (ctx.isBranchScoped && ctx.branchAssignments.length > 0) {
      warehouseQuery = warehouseQuery.in('branch_id', ctx.branchAssignments);
    }

    const warehouseResult = await warehouseQuery;
    if (warehouseResult.error) {
      logSelectorRequest(requestId, {
        branchId: effectiveBranchId,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: toSupabaseCode(warehouseResult.error),
        supabaseMessage: toSupabaseMessage(warehouseResult.error),
        userId: ctx.userId,
        warehouseId: authorizedWarehouseId,
      });
      return apiServerError({
        branchId: effectiveBranchId,
        ctx,
        error: warehouseResult.error,
        message: 'Warehouses could not be loaded for the item selector.',
        module: 'inventory.item-selector',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    if (authorizedWarehouseId) {
      const warehouseBranchId = warehouseResult.data?.[0]?.branch_id
        ? String(warehouseResult.data[0].branch_id)
        : null;
      const warehouseAllowed =
        warehouseResult.data?.length === 1 &&
        (
          !ctx.isBranchScoped ||
          !warehouseBranchId ||
          warehouseBranchId === effectiveBranchId ||
          ctx.warehouseAssignments.includes(authorizedWarehouseId)
        );
      if (!warehouseAllowed) {
        logSelectorRequest(requestId, {
          branchId: effectiveBranchId,
          httpStatus: 400,
          itemTypes: typeFilters,
          organizationId: ctx.organizationId,
          page: 1,
          pageSize: selectorPageSize,
          role: ctx.role,
          search,
          userId: ctx.userId,
          warehouseId: authorizedWarehouseId,
        });
        return buildSelectorFailureResponse({
          code: 'ITEM_WAREHOUSE_INVALID',
          message: 'Warehouse not found or out of scope.',
          requestId,
          status: 400,
        });
      }
    }

    const selectorRows: Array<Record<string, unknown>> = [];
    const selectorFetchSize = Math.min(200, selectorPageSize);
    let selectorOffset = 0;

    while (selectorRows.length < selectorPageSize) {
      let selectorQuery = service
        .from('items')
        .select(
          'id, organization_id, code, name, description, type, item_type, category_id, unit_id, unit_of_measure_id, standard_cost, unit_cost, cost_price, purchase_price, selling_price, is_active',
        )
        .eq('organization_id', ctx.organizationId)
        .range(selectorOffset, selectorOffset + selectorFetchSize - 1)
        .order('name', { ascending: true });

      if (search) {
        selectorQuery = selectorQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category) selectorQuery = selectorQuery.eq('category_id', category);
      if (!includeInactive) selectorQuery = selectorQuery.eq('is_active', true);

      const selectorResult = await selectorQuery;
      if (selectorResult.error) {
        logSelectorRequest(requestId, {
          branchId: effectiveBranchId,
          httpStatus: 500,
          itemTypes: typeFilters,
          organizationId: ctx.organizationId,
          page: 1,
          pageSize: selectorPageSize,
          role: ctx.role,
          search,
          supabaseCode: toSupabaseCode(selectorResult.error),
          supabaseMessage: toSupabaseMessage(selectorResult.error),
          userId: ctx.userId,
          warehouseId: authorizedWarehouseId,
        });
        return apiServerError({
          branchId: effectiveBranchId,
          ctx,
          error: selectorResult.error,
          message: 'Items could not be loaded for the selector.',
          module: 'inventory.item-selector',
          path: request.nextUrl.pathname,
          status: 500,
        });
      }

      const batchRows = (selectorResult.data ?? []).filter((row) => matchesRequestedItemTypes(row, typeFilters));
      selectorRows.push(...batchRows);

      if ((selectorResult.data?.length ?? 0) < selectorFetchSize) {
        break;
      }

      selectorOffset += selectorFetchSize;
    }

    const limitedSelectorRows = selectorRows.slice(0, selectorPageSize);
    const categoryIds = [...new Set(limitedSelectorRows.map((row) => String(row.category_id ?? '')).filter(Boolean))];
    const unitIds = [...new Set(limitedSelectorRows.map((row) => String(row.unit_id ?? row.unit_of_measure_id ?? '')).filter(Boolean))];

    const [categoriesResult, unitsResult, stockResult] = await Promise.all([
      categoryIds.length
        ? service.from('item_categories').select('id, name').in('id', categoryIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length
        ? service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
        : Promise.resolve({ data: [], error: null }),
      includeStock || includeCost
        ? service
            .from('stock_balances')
            .select('item_id, warehouse_id, quantity_on_hand, quantity_available, average_cost, avg_cost')
            .in('item_id', limitedSelectorRows.map((row) => String(row.id)))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (categoriesResult.error) {
      logSelectorRequest(requestId, {
        branchId: effectiveBranchId,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: toSupabaseCode(categoriesResult.error),
        supabaseMessage: toSupabaseMessage(categoriesResult.error),
        userId: ctx.userId,
        warehouseId: authorizedWarehouseId,
      });
      return apiServerError({
        branchId: effectiveBranchId,
        ctx,
        error: categoriesResult.error,
        message: 'Item categories could not be loaded for the selector.',
        module: 'inventory.item-selector',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    if (unitsResult.error) {
      logSelectorRequest(requestId, {
        branchId: effectiveBranchId,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: toSupabaseCode(unitsResult.error),
        supabaseMessage: toSupabaseMessage(unitsResult.error),
        userId: ctx.userId,
        warehouseId: authorizedWarehouseId,
      });
      return apiServerError({
        branchId: effectiveBranchId,
        ctx,
        error: unitsResult.error,
        message: 'Units of measure could not be loaded for the selector.',
        module: 'inventory.item-selector',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    if (stockResult.error) {
      logSelectorRequest(requestId, {
        branchId: effectiveBranchId,
        httpStatus: 500,
        itemTypes: typeFilters,
        organizationId: ctx.organizationId,
        page: 1,
        pageSize: selectorPageSize,
        role: ctx.role,
        search,
        supabaseCode: toSupabaseCode(stockResult.error),
        supabaseMessage: toSupabaseMessage(stockResult.error),
        userId: ctx.userId,
        warehouseId: authorizedWarehouseId,
      });
      return apiServerError({
        branchId: effectiveBranchId,
        ctx,
        error: stockResult.error,
        message: 'Stock balances could not be loaded for the selector.',
        module: 'inventory.item-selector',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    const categoryById = new Map(
      (categoriesResult.data ?? []).map((row) => [String(row.id), String(row.name ?? '')]),
    );
    const unitById = new Map(
      (unitsResult.data ?? []).map((row) => [
        String(row.id),
        {
          abbreviation: row.abbreviation ? String(row.abbreviation) : null,
          name: row.name ? String(row.name) : null,
        },
      ]),
    );
    const warehousesById = new Map(
      (warehouseResult.data ?? []).map((row) => [
        String(row.id),
        {
          branchId: row.branch_id ? String(row.branch_id) : null,
          id: String(row.id),
        },
      ]),
    );

    const customerPricing = customerIdParam
      ? await loadSalesCustomerPricingContext(service, ctx.organizationId, customerIdParam)
      : null;
    const resolvedPricing = await loadResolvedSalesItemPricing({
      branchId: effectiveBranchId,
      customer: customerPricing,
      documentDate: new Date().toISOString().slice(0, 10),
      itemIds: limitedSelectorRows.map((row) => String(row.id)),
      organizationId: ctx.organizationId,
      service,
      warehouseId: authorizedWarehouseId,
    });

    const options = buildItemSelectorOptions({
      branchId: effectiveBranchId,
      items: limitedSelectorRows.map((row) => {
        const categoryName = categoryById.get(String(row.category_id ?? '')) ?? null;
        const unit = unitById.get(String(row.unit_id ?? row.unit_of_measure_id ?? '')) ?? null;
        const resolved = resolvedPricing.get(String(row.id));
        const rawCost = includeCost
          ? resolved?.currentInventoryCost ?? Number(row.unit_cost ?? row.standard_cost ?? row.cost_price ?? row.purchase_price)
          : null;
        const rawPrice = includePrice ? resolved?.sellingPrice ?? Number(row.selling_price) : null;

        return {
          categoryId: row.category_id ? String(row.category_id) : null,
          categoryName,
          code: String(row.code ?? ''),
          currentInventoryCost: rawCost !== null && Number.isFinite(rawCost) ? rawCost : null,
          id: String(row.id),
          isActive: row.is_active !== false,
          itemType: String(row.item_type ?? row.type ?? ''),
          name: String(row.name ?? row.code ?? ''),
          sellingPrice: rawPrice !== null && Number.isFinite(rawPrice) ? rawPrice : null,
          taxStatus: resolved?.taxCode ?? null,
          unitAbbreviation: unit?.abbreviation ?? null,
          unitId: row.unit_id
            ? String(row.unit_id)
            : row.unit_of_measure_id
              ? String(row.unit_of_measure_id)
              : null,
          unitName: unit?.name ?? null,
        };
      }),
      stockRows: (stockResult.data ?? [])
        .filter((row) => warehousesById.has(String(row.warehouse_id ?? '')))
        .map((row) => ({
          averageCost: Number.isFinite(Number(row.average_cost ?? row.avg_cost))
            ? Number(row.average_cost ?? row.avg_cost)
            : null,
          itemId: String(row.item_id ?? ''),
          quantityAvailable: Number.isFinite(Number(row.quantity_available))
            ? Number(row.quantity_available)
            : null,
          quantityOnHand: Number.isFinite(Number(row.quantity_on_hand))
            ? Number(row.quantity_on_hand)
            : null,
          warehouseId: String(row.warehouse_id ?? ''),
        })),
      warehouseId: authorizedWarehouseId,
      warehousesById,
    });

    logSelectorRequest(requestId, {
      branchId: effectiveBranchId,
      httpStatus: 200,
      itemTypes: typeFilters,
      organizationId: ctx.organizationId,
      page: 1,
      pageSize: selectorPageSize,
      returnedRows: options.length,
      role: ctx.role,
      search,
      userId: ctx.userId,
      warehouseId: authorizedWarehouseId,
    });

    return jsonWithRequestId(
      {
        success: true,
        data: options,
        items: options,
        pagination: {
          page: 1,
          pageSize: selectorPageSize,
          total: limitedSelectorRows.length,
        },
        requestId,
      },
      requestId,
    );
  }

  let query = service
    .from('items')
    .select(
      `id, organization_id, code, name, description, type, category_id, unit_id, standard_cost,
       selling_price, reorder_level, reorder_qty, shelf_life_days, is_active, created_at`,
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq('category_id', category);
  }
  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }
  if (type) query = query.eq('type', type);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    return apiServerError({
      ctx,
      error,
      message: 'Inventory items could not be loaded.',
      module: 'inventory.items',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }

  const categoryIds = [...new Set((data ?? []).map((row) => String(row.category_id ?? '')).filter(Boolean))];
  const unitIds = [...new Set((data ?? []).map((row) => String(row.unit_id ?? '')).filter(Boolean))];
  const [categoriesResult, unitsResult] = await Promise.all([
    categoryIds.length
      ? service.from('item_categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? service.from('units_of_measure').select('id, name, abbreviation').in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (categoriesResult.error) {
    return apiServerError({
      ctx,
      error: categoriesResult.error,
      message: 'Inventory item categories could not be loaded.',
      module: 'inventory.items',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }

  if (unitsResult.error) {
    return apiServerError({
      ctx,
      error: unitsResult.error,
      message: 'Inventory units of measure could not be loaded.',
      module: 'inventory.items',
      path: request.nextUrl.pathname,
      status: 500,
    });
  }

  const categories = new Map(
    (categoriesResult.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
  );
  const units = new Map((unitsResult.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]));

  return NextResponse.json({
    data: (data ?? []).map((row) => normalizeItem(row as Record<string, unknown>, categories, units)),
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json()) as {
    categoryId?: string;
    code?: string;
    description?: string | null;
    isActive?: boolean;
    itemType?: string;
    name?: string;
    reorderLevel?: number | null;
    reorderQuantity?: number | null;
    sellingPrice?: number | null;
    trackExpiry?: boolean;
    unitCost?: number | null;
    unitOfMeasureId?: string;
  };

  const { code, name, unitOfMeasureId, itemType } = body;
  let { categoryId } = body;

  if (!code || !name || !unitOfMeasureId || !itemType) {
    return badRequest('code, name, unitOfMeasureId, and itemType are required.');
  }

  let categoryRecord: Record<string, unknown> | null = null;
  let unitRecord: Record<string, unknown> | null = null;

  if (!categoryId) {
    const existing = await service
      .from('item_categories')
      .select('id, name')
      .eq('organization_id', ctx.organizationId)
      .ilike('name', 'Uncategorized')
      .maybeSingle();
    if (existing.error) {
      return apiServerError({
        ctx,
        error: existing.error,
        message: 'The default inventory category could not be loaded.',
        module: 'inventory.items',
        path: request.nextUrl.pathname,
        status: 500,
      });
    }

    if (existing.data?.id) {
      categoryId = existing.data.id;
      categoryRecord = existing.data as Record<string, unknown>;
    } else {
      const created = await service
        .from('item_categories')
        .insert({
          description: 'Default category for uncategorized inventory items.',
          name: 'Uncategorized',
          organization_id: ctx.organizationId,
        })
        .select('id, name')
        .single();
      if (created.error || !created.data) {
        return apiServerError({
          ctx,
          error: created.error ?? new Error('Failed to create default item category.'),
          message: 'The default inventory category could not be created.',
          module: 'inventory.items',
          path: request.nextUrl.pathname,
          status: 500,
        });
      }

      categoryId = created.data.id;
      categoryRecord = created.data as Record<string, unknown>;
    }
  } else {
    const { data: categoryRecordRow, error: categoryError } = await service
      .from('item_categories')
      .select('id, name')
      .eq('id', categoryId)
      .eq('organization_id', ctx.organizationId)
      .single();
    if (categoryError) return serverError(categoryError.message);
    if (!categoryRecordRow) return badRequest('Item category not found.');
    categoryRecord = categoryRecordRow as Record<string, unknown>;
  }

  const { data: unit, error: unitError } = await service
    .from('units_of_measure')
    .select('id, name, abbreviation')
    .eq('id', unitOfMeasureId)
    .single();
  if (unitError) return serverError(unitError.message);
  if (!unit) return badRequest('Unit of measure not found.');
  unitRecord = unit as Record<string, unknown>;

  const { data, error } = await service
    .from('items')
    .insert({
      category_id: categoryId,
      code,
      description: body.description ?? null,
      is_active: body.isActive ?? true,
      name,
      organization_id: ctx.organizationId,
      reorder_level: body.reorderLevel ?? null,
      reorder_qty: body.reorderQuantity ?? null,
      selling_price: body.sellingPrice ?? null,
      shelf_life_days: body.trackExpiry ? 30 : null,
      standard_cost: body.unitCost ?? null,
      type: itemType,
      unit_id: unitOfMeasureId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  const categories = new Map<string, Record<string, unknown>>();
  const units = new Map<string, Record<string, unknown>>();
  if (categoryId && categoryRecord) categories.set(categoryId, categoryRecord);
  if (unitOfMeasureId && unitRecord) units.set(unitOfMeasureId, unitRecord);

  return NextResponse.json(normalizeItem(data as Record<string, unknown>, categories, units), { status: 201 });
}
