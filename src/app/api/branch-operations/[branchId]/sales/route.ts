import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateBranchSaleQuantity } from '@/lib/branches';
import { ensureBranchScope, getActiveBranchWarehouse, requireOpenShift, writeBranchAuditLog } from '@/lib/branches-server';
import { resolveFinancePostingAccount } from '@/lib/finance-foundation-server';
import { createLinkedFinanceTransaction, financeErrorMessage, postFinanceDocument } from '@/lib/finance-server';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { resolveInventoryUnitCosts } from '@/lib/sales-pricing';
import { createServiceRoleClient } from '@/lib/supabase/server';

function normalizeBranchPaymentMethod(value: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'CARD' || normalized === 'ECOCASH' || normalized === 'BANK_TRANSFER') {
    return 'BANK';
  }
  return normalized;
}

async function resolveSelectedTenderAccountId(input: {
  bankAccountId?: string | null;
  cashAccountId?: string | null;
  normalizedPaymentMethod: string;
  organizationId: string;
  service: ReturnType<typeof createServiceRoleClient>;
}) {
  if (input.normalizedPaymentMethod === 'CREDIT') {
    const receivable = await resolveFinancePostingAccount(
      input.organizationId,
      'ACCOUNTS_RECEIVABLE',
      { fallbackAccountCode: '1017' },
    );
    return receivable.id;
  }

  if (input.normalizedPaymentMethod === 'BANK') {
    const bankResult = await input.service
      .schema('icecream_erp')
      .from('bank_accounts')
      .select('id, account_id, is_active')
      .eq('organization_id', input.organizationId)
      .eq('id', String(input.bankAccountId ?? ''))
      .maybeSingle();
    if (bankResult.error) throw bankResult.error;
    if (!bankResult.data) throw new Error('The selected bank account was not found.');
    if (bankResult.data.is_active === false) throw new Error('The selected bank account is inactive.');
    if (!bankResult.data.account_id) throw new Error('The selected bank account is missing its linked ledger account.');
    return String(bankResult.data.account_id);
  }

  const cashResult = await input.service
    .schema('icecream_erp')
    .from('cash_accounts')
    .select('id, account_id, is_active')
    .eq('organization_id', input.organizationId)
    .eq('id', String(input.cashAccountId ?? ''))
    .maybeSingle();
  if (cashResult.error) throw cashResult.error;
  if (!cashResult.data) throw new Error('The selected cash account was not found.');
  if (cashResult.data.is_active === false) throw new Error('The selected cash account is inactive.');
  if (!cashResult.data.account_id) throw new Error('The selected cash account is missing its linked ledger account.');
  return String(cashResult.data.account_id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const paymentMethod = searchParams.get('paymentMethod') ?? undefined;
  const shift = searchParams.get('shift') ?? undefined;

  try {
    ensureBranchScope(ctx, branchId);

    let query = service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('id, sale_number, sale_date, shift, item_id, quantity, unit_price, total_amount, payment_method, served_by, status', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('sale_date', { ascending: false });

    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (shift) query = query.eq('shift', shift);
    if (startDate) query = query.gte('sale_date', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('sale_date', `${endDate}T23:59:59.999Z`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        saleNumber: row.sale_number ?? row.id,
        saleDate: row.sale_date,
        shift: row.shift,
        itemsCount: 1,
        totalAmount: Number(row.total_amount ?? 0),
        paymentMethod: row.payment_method,
        servedBy: row.served_by,
        status: row.status ?? 'POSTED',
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const { branchId } = await params;
  const service = createServiceRoleClient();

  try {
    ensureBranchScope(ctx, branchId);

    const body = await request.json() as {
      bankAccountId?: string;
      cashAccountId?: string;
      discountAmount?: number;
      paymentMethod: string;
      paymentStatus?: string;
      shift: string;
      remarks?: string;
      taxAmount?: number;
      items: Array<{ itemId: string; quantity: number; unitPrice: number; totalPrice: number }>;
      customerId?: string;
      paymentReference?: string;
      saleDate?: string;
    };

    if (!body.paymentMethod || !body.shift || !body.items?.length) {
      return badRequest('paymentMethod, shift, and items are required');
    }
    const normalizedPaymentMethod = normalizeBranchPaymentMethod(body.paymentMethod);
    if (normalizedPaymentMethod === 'BANK' && !String(body.bankAccountId ?? '').trim()) {
      return badRequest('bankAccountId is required for bank branch sales');
    }
    if ((normalizedPaymentMethod === 'CASH' || normalizedPaymentMethod === 'PETTY_CASH') && !String(body.cashAccountId ?? '').trim()) {
      return badRequest('cashAccountId is required for cash branch sales');
    }
    if (normalizedPaymentMethod === 'CREDIT' && !String(body.customerId ?? '').trim()) {
      return badRequest('customerId is required for credit branch sales');
    }

    const saleDate = body.saleDate ?? new Date().toISOString().slice(0, 10);
    const openShift = await requireOpenShift(branchId, body.shift, saleDate);
    const warehouse = await getActiveBranchWarehouse(branchId);

    // Validate items
    const itemIds = [...new Set(body.items.map((i) => i.itemId))];
    const buildItemsQuery = (includeDeletedAtFilter: boolean, typeColumn: 'item_type' | 'type') => {
      let query = service
        .schema('icecream_erp')
        .from('items')
        .select('id, unit_cost, standard_cost')
        .eq('is_active', true)
        .eq(typeColumn, 'FINISHED_GOOD')
        .in('id', itemIds);

      if (includeDeletedAtFilter) {
        query = query.is('deleted_at', null);
      }

      return query;
    };

    let itemsResult = await buildItemsQuery(true, 'item_type');
    if (itemsResult.error && isMissingColumnError(itemsResult.error, 'items', 'deleted_at')) {
      itemsResult = await buildItemsQuery(false, 'item_type');
    }
    if (itemsResult.error && isMissingColumnError(itemsResult.error, 'items', 'item_type')) {
      itemsResult = await buildItemsQuery(false, 'type');
    }
    if (
      itemsResult.error &&
      isMissingColumnError(itemsResult.error, 'items', 'deleted_at')
    ) {
      itemsResult = await buildItemsQuery(false, 'type');
    }
    if (itemsResult.error) throw itemsResult.error;
    const items = itemsResult.data;
    if ((items ?? []).length !== itemIds.length) return badRequest('One or more sale items are invalid');
    const itemById = new Map((items ?? []).map((row) => [String(row.id), row]));

    const availableBalances = await service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('id, item_id, quantity_on_hand, quantity_available, average_cost, avg_cost')
      .eq('warehouse_id', warehouse.id)
      .in('item_id', itemIds);
    if (availableBalances.error) throw availableBalances.error;

    const stockBalanceByItemId = new Map((availableBalances.data ?? []).map((row) => [String(row.item_id), row]));
    for (const item of body.items) {
      if (!validateBranchSaleQuantity(item.quantity, Number(stockBalanceByItemId.get(item.itemId)?.quantity_available ?? 0))) {
        return badRequest(`Insufficient branch stock for item ${item.itemId}`);
      }
    }

    const resolvedItemCosts = await resolveInventoryUnitCosts({
      itemIds,
      organizationId: ctx.organizationId,
      service: service.schema('icecream_erp'),
      warehouseId: warehouse.id,
    });

    const { count } = await service.schema('icecream_erp').from('branch_sales').select('*', { count: 'exact', head: true });
    const saleNumber = `BS-${String((count ?? 0) + 1).padStart(5, '0')}`;
    const grossAmount = body.items.reduce((s, i) => s + i.totalPrice, 0);
    const discountAmount = Number(body.discountAmount ?? 0);
    const taxAmount = Number(body.taxAmount ?? 0);
    const totalAmount = grossAmount - discountAmount + taxAmount;

    const { data: sale, error: saleErr } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .insert({
        branch_id: branchId,
        organization_id: ctx.organizationId,
        sale_number: saleNumber,
        payment_method: normalizedPaymentMethod,
        payment_status: body.paymentStatus ?? (normalizedPaymentMethod === 'CREDIT' ? 'CREDIT' : 'PAID'),
        shift: body.shift,
        shift_close_id: openShift.id,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        remarks: body.remarks ?? null,
        status: 'POSTED',
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        sale_date: new Date(`${saleDate}T00:00:00.000Z`).toISOString(),
        served_by: ctx.userId,
        customer_id: body.customerId ?? null,
        payment_reference: body.paymentReference ?? null,
      })
      .select()
      .single();
    if (saleErr) throw saleErr;

    await service.schema('icecream_erp').from('branch_sale_items').insert(
      body.items.map((i) => ({
        branch_sale_id: sale.id,
        item_id: i.itemId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total_price: i.totalPrice,
      }))
    );

    let totalInventoryCost = 0;
    for (const item of body.items) {
      const balance = stockBalanceByItemId.get(item.itemId);
      const itemRow = itemById.get(item.itemId) as Record<string, unknown> | undefined;
      const resolvedCost = resolvedItemCosts.get(item.itemId)?.cost;
      const inventoryUnitCost = Number(
        resolvedCost ??
        balance?.average_cost ??
        balance?.avg_cost ??
        itemRow?.unit_cost ??
        itemRow?.standard_cost ??
        0,
      );
      const lineInventoryCost = inventoryUnitCost * item.quantity;
      totalInventoryCost += lineInventoryCost;

      if (balance) {
        await service.schema('icecream_erp').from('stock_balances').update({
          quantity_on_hand: Math.max(0, Number(balance.quantity_on_hand) - item.quantity),
          quantity_available: Math.max(0, Number(balance.quantity_available) - item.quantity),
          last_updated: new Date().toISOString(),
        }).eq('id', balance.id);

        await service.schema('icecream_erp').from('stock_movements').insert({
          item_id: item.itemId,
          warehouse_id: warehouse.id,
          movement_type: 'SALES_ISSUE',
          quantity: item.quantity,
          unit_cost: inventoryUnitCost,
          total_cost: lineInventoryCost,
          reference_id: sale.id,
          reference_type: 'branch_sale',
          created_by: ctx.userId,
        });

        await service.schema('icecream_erp').from('branch_stock_ledger').insert({
          branch_id: branchId,
          warehouse_id: warehouse.id,
          item_id: item.itemId,
          shift_close_id: openShift.id,
          reference_id: sale.id,
          reference_type: 'branch_sale',
          movement_type: 'SALE',
          quantity: item.quantity,
          unit_cost: inventoryUnitCost,
          total_cost: lineInventoryCost,
          created_by: ctx.userId,
        });
      }
    }

    if (normalizedPaymentMethod === 'CREDIT' && body.customerId) {
      const { data: customer } = await service
        .schema('icecream_erp')
        .from('branch_customers')
        .select('id, current_balance')
        .eq('id', body.customerId)
        .maybeSingle();
      if (customer) {
        await service
          .schema('icecream_erp')
          .from('branch_customers')
          .update({
            current_balance: Number(customer.current_balance ?? 0) + totalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.customerId);
      }
    }

    let journal: Awaited<ReturnType<typeof postFinanceDocument>> | null = null;
    let linkedTransaction: Awaited<ReturnType<typeof createLinkedFinanceTransaction>> | null = null;
    try {
      const tenderAccountId = await resolveSelectedTenderAccountId({
        bankAccountId: body.bankAccountId ?? null,
        cashAccountId: body.cashAccountId ?? null,
        normalizedPaymentMethod,
        organizationId: ctx.organizationId,
        service,
      });
      const revenueAccount = await resolveFinancePostingAccount(
        ctx.organizationId,
        'BRANCH_SALES_REVENUE',
        { fallbackAccountCode: '4000' },
      );
      const inventoryAccount = await resolveFinancePostingAccount(
        ctx.organizationId,
        'BRANCH_INVENTORY',
        { fallbackAccountCode: '1029' },
      );
      const cogsAccount = await resolveFinancePostingAccount(
        ctx.organizationId,
        'COST_OF_GOODS_SOLD',
        { fallbackAccountCode: '5000' },
      );

      const lines = [
        {
          accountId: tenderAccountId,
          branchId,
          creditAmount: 0,
          debitAmount: totalAmount,
          description: `Branch sale ${saleNumber} receipt`,
        },
        {
          accountId: revenueAccount.id,
          branchId,
          creditAmount: totalAmount,
          debitAmount: 0,
          description: `Branch sale ${saleNumber} revenue`,
        },
      ];

      if (totalInventoryCost > 0) {
        lines.push(
          {
            accountId: cogsAccount.id,
            branchId,
            creditAmount: 0,
            debitAmount: totalInventoryCost,
            description: `Branch sale ${saleNumber} cost of goods sold`,
          },
          {
            accountId: inventoryAccount.id,
            branchId,
            creditAmount: totalInventoryCost,
            debitAmount: 0,
            description: `Branch sale ${saleNumber} inventory issue`,
          },
        );
      }

      journal = await postFinanceDocument({
        branchId,
        createdBy: ctx.userId,
        description: `Branch sale ${saleNumber}`,
        journalDate: saleDate,
        lines,
        organizationId: ctx.organizationId,
        sourceDocumentId: String(sale.id),
        sourceDocumentType: 'branch_sale',
        sourceModule: 'branches',
      });

      if (normalizedPaymentMethod !== 'CREDIT') {
        linkedTransaction = await createLinkedFinanceTransaction({
          amount: totalAmount,
          createdBy: ctx.userId,
          description: `Branch sale ${saleNumber}`,
          direction: 'IN',
          organizationId: ctx.organizationId,
          paymentMethod: normalizedPaymentMethod === 'BANK' ? 'BANK' : normalizedPaymentMethod === 'PETTY_CASH' ? 'PETTY_CASH' : 'CASH',
          selectedAccountId: normalizedPaymentMethod === 'BANK' ? body.bankAccountId ?? null : body.cashAccountId ?? null,
          referenceNumber: body.paymentReference ?? null,
          sourceDocument: journal.sourceReference,
          transactionDate: saleDate,
        });
      }
    } catch (postingError) {
      return serverError(financeErrorMessage(postingError) || 'Failed to post branch sale to finance.');
    }

    await writeBranchAuditLog('BRANCH_SALE_CREATED', sale.id, ctx.userId, {
      branchId,
      journalId: journal?.id ?? null,
      linkedTransactionId: linkedTransaction?.id ?? null,
      paymentMethod: normalizedPaymentMethod,
      totalAmount,
      warehouseId: warehouse.id,
    }, 'branch_sale');

    const { data: full } = await service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('*, branch_sale_items(*, items(id, code, name))')
      .eq('id', sale.id)
      .single();

    return NextResponse.json({ ...full, journal, linkedTransaction, warehouse }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
