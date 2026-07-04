import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isMissingSalesTable, salesErrorMessage, salesService } from '@/lib/sales-server';

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return salesErrorMessage(error).includes(`column ${table}.${columnName} does not exist`);
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const today = new Date().toISOString().slice(0, 10);

    let scopedOrderIds: string[] | null = null;
    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: scopedOrders, error: ordersError } = await service
        .from('sales_orders')
        .select('id')
        .eq('branch_id', ctx.branchId)
        ;
      if (ordersError) throw ordersError;
      scopedOrderIds = (scopedOrders ?? []).map((row) => String(row.id));
    }

    let dispatchQuery = service
      .from('sales_dispatch_notes')
      .select('id, status')
      ;

    if (ctx.isBranchScoped && ctx.branchId) {
      const { data: warehouseIds, error: warehouseError } = await service
        .from('warehouses')
        .select('id')
        .eq('branch_id', ctx.branchId)
        .eq('is_active', true);
      if (warehouseError) throw warehouseError;
      const ids = (warehouseIds ?? []).map((row) => String(row.id));
      dispatchQuery = ids.length
        ? dispatchQuery.in('warehouse_id', ids)
        : dispatchQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
    }

    const [dispatchResult, customerResult, finishedGoodsResult] = await Promise.all([
      dispatchQuery,
      service.from('customers').select('credit_limit, current_balance').eq('organization_id', ctx.organizationId),
      service.from('items').select('id').eq('organization_id', ctx.organizationId).eq('item_type', 'FINISHED_GOOD'),
    ]);

    if (dispatchResult.error && !dispatchResult.error.message.includes("Could not find the table 'icecream_erp.sales_dispatch_notes'")) throw dispatchResult.error;
    if (customerResult.error) throw customerResult.error;
    let finishedGoodsData = finishedGoodsResult.data ?? [];
    if (finishedGoodsResult.error) {
      if (isMissingColumnError(finishedGoodsResult.error, 'items', 'item_type')) {
        const fallbackFinishedGoods = await service
          .from('items')
          .select('id')
          .eq('organization_id', ctx.organizationId)
          .eq('type', 'FINISHED_GOOD');
        if (fallbackFinishedGoods.error) throw fallbackFinishedGoods.error;
        finishedGoodsData = fallbackFinishedGoods.data ?? [];
      } else {
        throw finishedGoodsResult.error;
      }
    }

    let invoiceResult = await service
      .from('invoices')
      .select('invoice_date, due_date, total, balance_due, sales_order_id, status')
      .eq('organization_id', ctx.organizationId);

    if (scopedOrderIds) {
      invoiceResult = scopedOrderIds.length === 0
        ? await service
            .from('invoices')
            .select('invoice_date, due_date, total, balance_due, sales_order_id, status')
            .eq('organization_id', ctx.organizationId)
            .in('sales_order_id', ['00000000-0000-0000-0000-000000000000'])
        : await service
            .from('invoices')
            .select('invoice_date, due_date, total, balance_due, sales_order_id, status')
            .eq('organization_id', ctx.organizationId)
            .in('sales_order_id', scopedOrderIds);
    }

    let invoices = (invoiceResult.data ?? []) as Array<Record<string, unknown>>;
    if (invoiceResult.error) {
      const compatibleLegacy =
        isMissingColumnError(invoiceResult.error, 'invoices', 'total') ||
        isMissingColumnError(invoiceResult.error, 'invoices', 'sales_order_id') ||
        isMissingSalesTable(invoiceResult.error);

      if (!compatibleLegacy) throw invoiceResult.error;

      let fallbackInvoiceQuery = service
        .from('invoices')
        .select('invoice_date, due_date, total_amount, balance_due, order_id, status')
        .eq('organization_id', ctx.organizationId);

      if (scopedOrderIds) {
        fallbackInvoiceQuery = scopedOrderIds.length === 0
          ? fallbackInvoiceQuery.in('order_id', ['00000000-0000-0000-0000-000000000000'])
          : fallbackInvoiceQuery.in('order_id', scopedOrderIds);
      }

      const fallbackInvoiceResult = await fallbackInvoiceQuery;
      if (fallbackInvoiceResult.error) throw fallbackInvoiceResult.error;
      invoices = (fallbackInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    }

    const finishedGoodsIds = finishedGoodsData.map((row) => String(row.id));
    let stockRows: Array<Record<string, unknown>> = [];
    if (finishedGoodsIds.length > 0) {
      let stockQuery = service
        .from('stock_balances')
        .select('quantity_on_hand, quantity_reserved, quantity_available, warehouse_id')
        .in('item_id', finishedGoodsIds);

      if (ctx.isBranchScoped && ctx.branchId) {
        const { data: warehouseIds, error: warehouseError } = await service
          .from('warehouses')
          .select('id')
          .eq('branch_id', ctx.branchId)
          .eq('is_active', true);
        if (warehouseError) throw warehouseError;
        const ids = (warehouseIds ?? []).map((row) => String(row.id));
        stockQuery = ids.length
          ? stockQuery.in('warehouse_id', ids)
          : stockQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
      }

      const stockResult = await stockQuery;
      if (stockResult.error) {
        const compatibleLegacy =
          isMissingColumnError(stockResult.error, 'stock_balances', 'quantity_on_hand') ||
          isMissingColumnError(stockResult.error, 'stock_balances', 'quantity_reserved');

        if (!compatibleLegacy) throw stockResult.error;

        let fallbackStockQuery = service
          .from('stock_balances')
          .select('quantity, reserved_qty, warehouse_id')
          .in('item_id', finishedGoodsIds);

        if (ctx.isBranchScoped && ctx.branchId) {
          const { data: warehouseIds, error: warehouseError } = await service
            .from('warehouses')
            .select('id')
            .eq('branch_id', ctx.branchId)
            .eq('is_active', true);
          if (warehouseError) throw warehouseError;
          const ids = (warehouseIds ?? []).map((row) => String(row.id));
          fallbackStockQuery = ids.length
            ? fallbackStockQuery.in('warehouse_id', ids)
            : fallbackStockQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
        }

        const fallbackStockResult = await fallbackStockQuery;
        if (fallbackStockResult.error) throw fallbackStockResult.error;
        stockRows = (fallbackStockResult.data ?? []) as Array<Record<string, unknown>>;
      } else {
        stockRows = (stockResult.data ?? []) as Array<Record<string, unknown>>;
      }
    }

    const customers = (customerResult.data ?? []) as Array<Record<string, unknown>>;
    const dispatches = (dispatchResult.data ?? []) as Array<Record<string, unknown>>;

    const todaySales = invoices
      .filter((row) => String(row.invoice_date ?? '') === today && String(row.status ?? '').toUpperCase() !== 'CANCELLED')
      .reduce((sum, row) => sum + Number(row.total ?? row.total_amount ?? 0), 0);

    const overdueInvoices = invoices.filter((row) => {
      const dueDate = String(row.due_date ?? '');
      const balanceDue = Number(row.balance_due ?? 0);
      return Boolean(dueDate) && dueDate < today && balanceDue > 0 && String(row.status ?? '').toUpperCase() !== 'CANCELLED';
    }).length;

    const creditAlerts = customers.filter((row) => {
      const creditLimit = Number(row.credit_limit ?? 0);
      const currentBalance = Number(row.current_balance ?? 0);
      return creditLimit > 0 && currentBalance > creditLimit;
    }).length;

    const pendingDispatches = dispatches.filter((row) => !['POSTED', 'CANCELLED'].includes(String(row.status ?? '').toUpperCase())).length;
    const stockAvailableForSale = stockRows.reduce((sum, row) => {
      const quantityOnHand = Number(row.quantity_on_hand ?? row.quantity ?? 0);
      const quantityReserved = Number(row.quantity_reserved ?? row.reserved_qty ?? 0);
      const quantityAvailable = Number(row.quantity_available ?? (quantityOnHand - quantityReserved));
      return sum + Math.max(0, quantityAvailable);
    }, 0);

    return NextResponse.json({
      stats: {
        creditAlerts: String(creditAlerts),
        overdueInvoices: String(overdueInvoices),
        pendingDispatches: String(pendingDispatches),
        stockAvailableForSale: String(stockAvailableForSale),
        todaySales: todaySales.toFixed(2),
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
