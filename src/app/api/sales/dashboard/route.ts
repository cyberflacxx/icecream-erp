import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

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

    let invoiceQuery = service
      .from('invoices')
        .select('invoice_date, due_date, total_amount, balance_due, order_id, status')
        .eq('organization_id', ctx.organizationId);
    if (scopedOrderIds) {
      if (scopedOrderIds.length === 0) {
        invoiceQuery = invoiceQuery.in('order_id', ['00000000-0000-0000-0000-000000000000']);
      } else {
        invoiceQuery = invoiceQuery.in('order_id', scopedOrderIds);
      }
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

    const [invoiceResult, dispatchResult, customerResult, finishedGoodsResult] = await Promise.all([
      invoiceQuery,
      dispatchQuery,
      service.from('customers').select('credit_limit, outstanding_balance').eq('organization_id', ctx.organizationId),
      service.from('items').select('id').eq('organization_id', ctx.organizationId).eq('type', 'FINISHED_GOOD'),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    if (dispatchResult.error && !dispatchResult.error.message.includes("Could not find the table 'icecream_erp.sales_dispatch_notes'")) throw dispatchResult.error;
    if (customerResult.error) throw customerResult.error;
    if (finishedGoodsResult.error) throw finishedGoodsResult.error;

    const finishedGoodsIds = (finishedGoodsResult.data ?? []).map((row) => String(row.id));
    let stockRows: Array<Record<string, unknown>> = [];
    if (finishedGoodsIds.length > 0) {
      let stockQuery = service
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
        stockQuery = ids.length
          ? stockQuery.in('warehouse_id', ids)
          : stockQuery.in('warehouse_id', ['00000000-0000-0000-0000-000000000000']);
      }

      const { data: stockData, error: stockError } = await stockQuery;
      if (stockError) throw stockError;
      stockRows = (stockData ?? []) as Array<Record<string, unknown>>;
    }

    const invoices = (invoiceResult.data ?? []) as Array<Record<string, unknown>>;
    const customers = (customerResult.data ?? []) as Array<Record<string, unknown>>;
    const dispatches = (dispatchResult.data ?? []) as Array<Record<string, unknown>>;

    const todaySales = invoices
      .filter((row) => String(row.invoice_date ?? '') === today && String(row.status ?? '').toUpperCase() !== 'CANCELLED')
      .reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

    const overdueInvoices = invoices.filter((row) => {
      const dueDate = String(row.due_date ?? '');
      const balanceDue = Number(row.balance_due ?? 0);
      return Boolean(dueDate) && dueDate < today && balanceDue > 0 && String(row.status ?? '').toUpperCase() !== 'CANCELLED';
    }).length;

    const creditAlerts = customers.filter((row) => {
      const creditLimit = Number(row.credit_limit ?? 0);
      const currentBalance = Number(row.outstanding_balance ?? 0);
      return creditLimit > 0 && currentBalance > creditLimit;
    }).length;

    const pendingDispatches = dispatches.filter((row) => !['POSTED', 'CANCELLED'].includes(String(row.status ?? '').toUpperCase())).length;
    const stockAvailableForSale = stockRows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity ?? 0) - Number(row.reserved_qty ?? 0)), 0);

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
