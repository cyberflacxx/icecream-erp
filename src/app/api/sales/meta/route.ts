import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateAvailableCredit, deriveCustomerCreditAllowed } from '@/lib/sales-customers';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Row = Record<string, unknown>;

function salesMetaErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function isOptionalTableError(error: unknown) {
  const message = salesMetaErrorMessage(error);
  return (
    message.includes("Could not find the table 'icecream_erp.") ||
    message.includes('Could not find a relationship between') ||
    message.includes('does not exist')
  );
}

async function fetchRows(service: ReturnType<typeof createServiceRoleClient>, table: string) {
  const { data, error } = await service.from(table).select('*');
  if (error) {
    if (isOptionalTableError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as Row[];
}

function belongsToOrganization(row: Row, organizationId: string) {
  const rowOrganizationId = row.organization_id;
  return !rowOrganizationId || String(rowOrganizationId) === organizationId;
}

function isNotDeleted(row: Row) {
  return !row.deleted_at;
}

function isActive(row: Row) {
  return row.is_active !== false && String(row.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE';
}

function sortByName<T extends { name?: string | null; code?: string | null }>(rows: T[]) {
  return rows.sort((a, b) => String(a.name ?? a.code ?? '').localeCompare(String(b.name ?? b.code ?? '')));
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const [
      customerRows,
      itemRows,
      warehouseRows,
      branchRows,
      priceRows,
      customerGroupRows,
      salesOrderRows,
      invoiceRows,
      invoiceItemRows,
      stockBalanceRows,
    ] = await Promise.all([
      fetchRows(service, 'customers'),
      fetchRows(service, 'items'),
      fetchRows(service, 'warehouses'),
      fetchRows(service, 'branches'),
      fetchRows(service, 'sales_product_prices'),
      fetchRows(service, 'sales_customer_groups'),
      fetchRows(service, 'sales_orders'),
      fetchRows(service, 'invoices'),
      fetchRows(service, 'invoice_items'),
      fetchRows(service, 'stock_balances'),
    ]);

    const branches = sortByName(
      branchRows
        .filter((row) => belongsToOrganization(row, ctx.organizationId) && isNotDeleted(row))
        .map((row) => ({
          code: String(row.code ?? ''),
          id: String(row.id),
          name: String(row.name ?? row.code ?? 'Unnamed branch'),
        })),
    );

    const warehouses = sortByName(
      warehouseRows
        .filter((row) => belongsToOrganization(row, ctx.organizationId) && isActive(row))
        .filter((row) => !ctx.isBranchScoped || !ctx.branchId || !row.branch_id || String(row.branch_id) === ctx.branchId)
        .map((row) => ({
          branchId: row.branch_id ? String(row.branch_id) : null,
          code: String(row.code ?? ''),
          id: String(row.id),
          name: String(row.name ?? row.code ?? 'Unnamed warehouse'),
        })),
    );
    const warehouseIdSet = new Set(warehouses.map((warehouse) => warehouse.id));

    const prices = priceRows
      .filter((row) => isActive(row))
      .map((row) => ({
        effectiveDate: row.effective_date ? String(row.effective_date) : null,
        expiryDate: row.expiry_date ? String(row.expiry_date) : null,
        id: String(row.id),
        isActive: row.is_active !== false,
        itemId: String(row.item_id ?? ''),
        priceListCode: String(row.price_list_code ?? 'STANDARD'),
        sellingPrice: toNumber(row.selling_price),
      }));

    const standardPriceByItemId = new Map<string, number>();
    for (const price of prices) {
      if (!price.itemId || standardPriceByItemId.has(price.itemId)) continue;
      standardPriceByItemId.set(price.itemId, price.sellingPrice);
    }

    const availableByItemId = new Map<string, number>();
    for (const balance of stockBalanceRows.filter((row) => !row.warehouse_id || warehouseIdSet.has(String(row.warehouse_id)))) {
      const itemId = String(balance.item_id ?? '');
      if (!itemId) continue;
      availableByItemId.set(itemId, (availableByItemId.get(itemId) ?? 0) + toNumber(balance.quantity_available ?? balance.quantity_on_hand));
    }

    const items = sortByName(
      itemRows
        .filter((row) => belongsToOrganization(row, ctx.organizationId) && isNotDeleted(row) && isActive(row))
        .map((row) => {
          const id = String(row.id);
          return {
            availableQuantity: availableByItemId.get(id) ?? 0,
            code: String(row.code ?? ''),
            defaultPrice: standardPriceByItemId.get(id) ?? toNumber(row.selling_price ?? row.unit_price ?? row.standard_price),
            id,
            name: String(row.name ?? row.code ?? 'Unnamed item'),
            type: String(row.type ?? row.item_type ?? ''),
          };
        }),
    );

    const customers = sortByName(
      customerRows
        .filter((row) => belongsToOrganization(row, ctx.organizationId) && isNotDeleted(row) && isActive(row))
        .map((row) => ({
          availableCredit: calculateAvailableCredit(row.credit_limit, row.current_balance ?? row.outstanding_balance),
          code: String(row.code ?? ''),
          creditAllowed: deriveCustomerCreditAllowed(row.payment_terms, row.credit_limit),
          creditLimit: toNumber(row.credit_limit),
          currentBalance: toNumber(row.current_balance ?? row.outstanding_balance),
          email: row.email ? String(row.email) : null,
          id: String(row.id),
          name: String(row.name ?? row.code ?? 'Unnamed customer'),
          paymentTerms: row.payment_terms ? String(row.payment_terms) : null,
          phone: row.phone ? String(row.phone) : null,
          priceListCode: row.price_list_code ? String(row.price_list_code) : null,
          status: String(row.status ?? 'ACTIVE'),
        })),
    );

    const customerGroups = sortByName(
      customerGroupRows.map((row) => ({
        code: String(row.code ?? ''),
        id: String(row.id),
        name: String(row.name ?? row.code ?? 'Unnamed group'),
      })),
    );

    const salesOrders = salesOrderRows
      .filter((row) => belongsToOrganization(row, ctx.organizationId) && isNotDeleted(row))
      .filter((row) => !ctx.isBranchScoped || !ctx.branchId || !row.branch_id || String(row.branch_id) === ctx.branchId)
      .map((row) => ({
        branchId: row.branch_id ? String(row.branch_id) : null,
        customerId: String(row.customer_id ?? ''),
        id: String(row.id),
        orderDate: row.order_date ? String(row.order_date) : null,
        orderNumber: String(row.order_number ?? row.id ?? ''),
        requiredDate: row.delivery_date ? String(row.delivery_date) : row.required_date ? String(row.required_date) : null,
        status: String(row.status ?? ''),
        total: toNumber(row.total_amount ?? row.total),
        warehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
      }))
      .sort((a, b) => String(b.orderDate ?? '').localeCompare(String(a.orderDate ?? '')));

    const orderWarehouseById = new Map(salesOrders.map((order) => [order.id, order.warehouseId]));
    const invoiceItemsByInvoiceId = new Map<string, Array<{
      id: string;
      itemId: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
    }>>();
    const itemNameById = new Map(items.map((item) => [item.id, item.name]));

    for (const row of invoiceItemRows) {
      const invoiceId = String(row.invoice_id ?? '');
      if (!invoiceId) continue;
      const itemId = String(row.item_id ?? '');
      const lines = invoiceItemsByInvoiceId.get(invoiceId) ?? [];
      lines.push({
        id: String(row.id),
        itemId,
        itemName: itemNameById.get(itemId) ?? itemId,
        quantity: toNumber(row.quantity ?? row.quantity_invoiced),
        unitPrice: toNumber(row.unit_price),
      });
      invoiceItemsByInvoiceId.set(invoiceId, lines);
    }

    const invoices = invoiceRows
      .filter((row) => belongsToOrganization(row, ctx.organizationId) && isNotDeleted(row))
      .map((row) => {
        const id = String(row.id);
        const salesOrderId = row.sales_order_id ? String(row.sales_order_id) : row.order_id ? String(row.order_id) : null;
        return {
          amountPaid: toNumber(row.amount_paid ?? row.paid_amount),
          balanceDue: toNumber(row.balance_due),
          customerId: String(row.customer_id ?? ''),
          dueDate: row.due_date ? String(row.due_date) : null,
          id,
          invoiceDate: row.invoice_date ? String(row.invoice_date) : null,
          invoiceItems: invoiceItemsByInvoiceId.get(id) ?? [],
          invoiceNumber: String(row.invoice_number ?? row.id ?? ''),
          salesOrderId,
          status: String(row.status ?? ''),
          total: toNumber(row.total ?? row.total_amount),
          warehouseId: row.warehouse_id ? String(row.warehouse_id) : salesOrderId ? orderWarehouseById.get(salesOrderId) ?? null : null,
        };
      })
      .filter((invoice) => !ctx.isBranchScoped || !ctx.branchId || !invoice.warehouseId || warehouseIdSet.has(invoice.warehouseId))
      .sort((a, b) => String(b.invoiceDate ?? '').localeCompare(String(a.invoiceDate ?? '')));

    return NextResponse.json({
      branches,
      customerGroups,
      customers,
      invoices,
      items,
      prices,
      salesOrders,
      warehouses,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load sales metadata.');
  }
}
