import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveFinancePostingAccount } from '@/lib/finance-foundation-server';
import { emitLowStockNotificationIfNeeded, emitOperationalNotifications } from '@/lib/notifications-server';
import { isMissingSalesColumn, isMissingSalesTable, salesService, writeSalesAuditLog } from '@/lib/sales-server';
import { getDocumentLockReason } from '@/lib/workflow';
import { workflowService } from '@/lib/workflow-server';

type SalesDispatchRow = Record<string, unknown>;
type SalesDispatchForPosting = SalesDispatchRow & {
  invoices: SalesDispatchRow | null;
  sales_dispatch_note_items: SalesDispatchRow[];
};

async function loadCompatDispatchForPosting(service: ReturnType<typeof salesService>, id: string) {
  const auditResult = await service
    .from('audit_logs')
    .select('new_values')
    .eq('action', 'SALES_DISPATCH_CREATED')
    .eq('entity_id', id)
    .eq('entity_type', 'sales_dispatch_note')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (auditResult.error) throw auditResult.error;

  const payload = ((auditResult.data as SalesDispatchRow | null)?.new_values ?? null) as SalesDispatchRow | null;
  if (!payload) throw new Error('Dispatch note not found.');

  let invoiceResult = await service
    .from('invoices')
    .select('id, invoice_number, status, approved_at, branch_id, department_id, cost_center_code, currency_code, exchange_rate')
    .eq('id', String(payload.invoiceId ?? ''))
    .maybeSingle();
  if (invoiceResult.error && isMissingSalesColumn(invoiceResult.error, 'invoices', 'approved_at')) {
    invoiceResult = await service
      .from('invoices')
      .select('id, invoice_number, status, branch_id, department_id, cost_center_code, currency_code, exchange_rate')
      .eq('id', String(payload.invoiceId ?? ''))
      .maybeSingle();
  }
  if (invoiceResult.error) throw invoiceResult.error;

  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    id,
    dispatch_note_number: String(payload.dispatchNoteNumber ?? id),
    invoice_id: String(payload.invoiceId ?? ''),
    invoices: (invoiceResult.data ?? null) as SalesDispatchRow | null,
    sales_dispatch_note_items: items.map((item) => ({
      id: String((item as SalesDispatchRow).invoiceItemId ?? (item as SalesDispatchRow).itemId ?? ''),
      invoice_item_id: (item as SalesDispatchRow).invoiceItemId ?? null,
      item_id: String((item as SalesDispatchRow).itemId ?? ''),
      quantity_dispatched: Number((item as SalesDispatchRow).quantityDispatched ?? 0),
      quantity_invoiced: Number((item as SalesDispatchRow).quantityInvoiced ?? 0),
    })),
    status: String(payload.status ?? 'PENDING'),
    warehouse_id: String(payload.warehouseId ?? ''),
  } as SalesDispatchForPosting;
}

async function loadDispatchForPosting(service: ReturnType<typeof salesService>, id: string) {
  const dispatchResult = await service
    .from('sales_dispatch_notes')
    .select('id, dispatch_note_number, invoice_id, warehouse_id, status')
    .eq('id', id)
    .single();
  if (dispatchResult.error) throw dispatchResult.error;

  const itemsResult = await service
    .from('sales_dispatch_note_items')
    .select('id, item_id, quantity_dispatched, quantity_invoiced, invoice_item_id')
    .eq('dispatch_note_id', id);
  if (itemsResult.error) throw itemsResult.error;

  let invoiceResult = await service
    .from('invoices')
    .select('id, invoice_number, status, approved_at, branch_id, department_id, cost_center_code, currency_code, exchange_rate')
    .eq('id', String((dispatchResult.data as SalesDispatchRow).invoice_id ?? ''))
    .maybeSingle();
  if (invoiceResult.error && isMissingSalesColumn(invoiceResult.error, 'invoices', 'approved_at')) {
    invoiceResult = await service
      .from('invoices')
      .select('id, invoice_number, status, branch_id, department_id, cost_center_code, currency_code, exchange_rate')
      .eq('id', String((dispatchResult.data as SalesDispatchRow).invoice_id ?? ''))
      .maybeSingle();
  }
  if (invoiceResult.error) throw invoiceResult.error;

  return {
    ...(dispatchResult.data as SalesDispatchRow),
    invoices: invoiceResult.data as SalesDispatchRow | null,
    sales_dispatch_note_items: (itemsResult.data ?? []) as SalesDispatchRow[],
  } as SalesDispatchForPosting;
}

async function createDispatchCostJournal(input: {
  branchId: string | null;
  costCenterCode: string | null;
  currencyCode: string | null;
  departmentId: string | null;
  dispatchId: string;
  dispatchNumber: string;
  exchangeRate: number | null;
  organizationId: string;
  service: ReturnType<typeof salesService>;
  totalCost: number;
  userId: string;
}) {
  if (input.totalCost <= 0) {
    return null;
  }

  const [cogsAccount, inventoryAccount, entryNumberResult] = await Promise.all([
    resolveFinancePostingAccount(input.organizationId, 'COST_OF_GOODS_SOLD', {
      branchId: input.branchId,
      fallbackAccountCode: '5110',
    }),
    resolveFinancePostingAccount(input.organizationId, 'FINISHED_GOODS_INVENTORY', {
      branchId: input.branchId,
      fallbackAccountCode: '1240',
    }),
    input.service.rpc('sales_next_document_number', {
      p_organization_id: input.organizationId,
      p_prefix: 'JE',
      p_series_type: 'JOURNAL_ENTRY',
    }),
  ]);

  if (entryNumberResult.error) {
    throw entryNumberResult.error;
  }

  const entryNumber = String(entryNumberResult.data ?? '').trim();
  if (!entryNumber) {
    throw new Error('Dispatch journal number could not be generated.');
  }

  const now = new Date().toISOString();
  const journalInsert = await input.service
    .from('journal_entries')
    .insert({
      organization_id: input.organizationId,
      entry_number: entryNumber,
      entry_date: now.slice(0, 10),
      description: `Dispatch ${input.dispatchNumber}`,
      reference: `sales:sales_dispatch:${input.dispatchId}`,
      reference_type: 'sales_dispatch',
      reference_id: input.dispatchId,
      branch_id: input.branchId,
      department_id: input.departmentId,
      cost_center_code: input.costCenterCode,
      currency_code: input.currencyCode ?? 'USD',
      exchange_rate: input.exchangeRate ?? 1,
      status: 'POSTED',
      is_posted: true,
      posted_by: input.userId,
      posted_at: now,
      created_by: input.userId,
      approved_by: input.userId,
      total_debit: input.totalCost,
      total_credit: input.totalCost,
    })
    .select('id')
    .single();

  if (journalInsert.error) {
    throw journalInsert.error;
  }

  const journalId = String((journalInsert.data as SalesDispatchRow).id ?? '');
  const journalLinesInsert = await input.service
    .from('journal_entry_lines')
    .insert([
      {
        journal_entry_id: journalId,
        account_id: cogsAccount.id,
        branch_id: input.branchId,
        department_id: input.departmentId,
        cost_center_code: input.costCenterCode,
        description: `Cost of goods sold for dispatch ${input.dispatchNumber}`,
        debit_amount: input.totalCost,
        credit_amount: 0,
      },
      {
        journal_entry_id: journalId,
        account_id: inventoryAccount.id,
        branch_id: input.branchId,
        department_id: input.departmentId,
        cost_center_code: input.costCenterCode,
        description: `Inventory issue for dispatch ${input.dispatchNumber}`,
        debit_amount: 0,
        credit_amount: input.totalCost,
      },
    ]);

  if (journalLinesInsert.error) {
    throw journalLinesInsert.error;
  }

  return journalId;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    let dispatch: SalesDispatchForPosting;
    try {
      dispatch = id.startsWith('compat-dispatch-')
        ? await loadCompatDispatchForPosting(service, id)
        : await loadDispatchForPosting(service, id);
    } catch (error) {
      if (!id.startsWith('compat-dispatch-') && isMissingSalesTable(error)) {
        dispatch = await loadCompatDispatchForPosting(service, id);
      } else {
        throw error;
      }
    }
    if (String(dispatch.status).toUpperCase() !== 'PENDING') {
      return badRequest('Only pending dispatches can be posted.');
    }
    const linkedInvoice = Array.isArray(dispatch.invoices) ? dispatch.invoices[0] : dispatch.invoices;
    const linkedInvoiceStatus = String(linkedInvoice?.status ?? '').toUpperCase();
    const invoiceApproved =
      Boolean(linkedInvoice?.approved_at) ||
      ['APPROVED', 'SENT', 'PARTIAL_PAID', 'PAID', 'FULLY_DISPATCHED'].includes(linkedInvoiceStatus);
    if (!linkedInvoice || !invoiceApproved) {
      return badRequest('Dispatch cannot be posted until the linked invoice is approved.');
    }

    const [existingJournalResult, existingMovementResult] = await Promise.all([
      service
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'sales_dispatch')
        .eq('reference_id', id)
        .limit(1)
        .maybeSingle(),
      service
        .from('stock_movements')
        .select('id')
        .eq('reference_type', 'sales_dispatch')
        .eq('reference_id', id)
        .eq('movement_type', 'SALES_ISSUE')
        .limit(1)
        .maybeSingle(),
    ]);
    if (existingJournalResult.error) throw existingJournalResult.error;
    if (existingMovementResult.error) throw existingMovementResult.error;
    if (existingJournalResult.data || existingMovementResult.data) {
      return badRequest('Dispatch already has posting artifacts and cannot be retried automatically.');
    }

    const workflow = workflowService();
    let workflowPostingAvailable = true;
    let existingLock: Record<string, unknown> | null = null;
    const lockResult = await workflow
      .from('document_locks')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('document_type', 'sales_dispatch')
      .eq('document_id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (lockResult.error) {
      if (isMissingSalesTable(lockResult.error)) {
        workflowPostingAvailable = false;
      } else {
        throw lockResult.error;
      }
    } else {
      existingLock = (lockResult.data ?? null) as Record<string, unknown> | null;
    }
    if (existingLock) return badRequest('Dispatch note is already locked.');

    let postingLogId: string | null = null;
    if (workflowPostingAvailable) {
      const postingLogResult = await workflow.from('posting_logs').insert({
        document_id: id,
        document_reference: String(dispatch.dispatch_note_number ?? id),
        document_type: 'sales_dispatch',
        module_name: 'sales',
        organization_id: ctx.organizationId,
        payload: { source: 'sales.dispatch.post' },
        posted_by: ctx.userId,
        posting_action: 'POST',
        posting_status: 'PENDING',
      }).select().single();
      if (postingLogResult.error) {
        if (isMissingSalesTable(postingLogResult.error)) {
          workflowPostingAvailable = false;
        } else {
          throw postingLogResult.error;
        }
      } else {
        postingLogId = String((postingLogResult.data as Record<string, unknown>).id ?? '');
      }
    }

    const items = Array.isArray(dispatch.sales_dispatch_note_items) ? dispatch.sales_dispatch_note_items : [];
    try {
      const movementPlans: Array<{
        balanceId: string;
        itemId: string;
        nextOnHand: number;
        nextReserved: number;
        nextTotalValue: number;
        quantity: number;
        quantityAvailable: number;
        totalCost: number;
        unitCost: number;
      }> = [];
      let totalDispatchCost = 0;

      for (const item of items) {
        if (Number(item.quantity_dispatched ?? 0) > Number(item.quantity_invoiced ?? 0)) {
          return badRequest('Dispatch quantity cannot exceed invoiced quantity.');
        }

        const { data: balance, error: balanceError } = await service
          .from('stock_balances')
          .select('id, quantity, quantity_on_hand, quantity_reserved, quantity_available, average_cost, avg_cost, total_value')
          .eq('item_id', item.item_id)
          .eq('warehouse_id', dispatch.warehouse_id)
          .single();
        if (balanceError) throw balanceError;

        const quantity = Number(item.quantity_dispatched ?? 0);
        const currentOnHand = Number(balance.quantity_on_hand ?? balance.quantity ?? 0);
        const currentReserved = Number(balance.quantity_reserved ?? 0);
        const currentAvailable = Number(balance.quantity_available ?? Math.max(0, currentOnHand - currentReserved));
        const unitCost = Number(balance.average_cost ?? balance.avg_cost ?? 0);
        if (unitCost <= 0) {
          return badRequest(`Dispatch requires an inventory cost for item ${String(item.item_id ?? '')}.`);
        }

        const totalCost = unitCost * quantity;
        const nextReserved = Math.max(0, Number(balance.quantity_reserved ?? 0) - quantity);
        const nextOnHand = currentOnHand - quantity;
        if (nextOnHand < 0) return badRequest('Negative stock blocked.');
        const nextAvailable = Math.max(0, currentAvailable - Math.max(0, quantity - currentReserved));

        const currentTotalValue = Number(balance.total_value ?? (currentOnHand * unitCost));
        const nextTotalValue = Math.max(0, currentTotalValue - totalCost);
        movementPlans.push({
          balanceId: String(balance.id),
          itemId: String(item.item_id ?? ''),
          nextOnHand,
          nextReserved,
          nextTotalValue,
          quantity,
          quantityAvailable: nextAvailable,
          totalCost,
          unitCost,
        });
        totalDispatchCost += totalCost;
      }

      const linkedInvoiceBranchId = linkedInvoice?.branch_id ? String(linkedInvoice.branch_id) : null;
      const linkedInvoiceDepartmentId = linkedInvoice?.department_id ? String(linkedInvoice.department_id) : null;
      const linkedInvoiceCostCenterCode = linkedInvoice?.cost_center_code ? String(linkedInvoice.cost_center_code) : null;
      const linkedInvoiceCurrencyCode = linkedInvoice?.currency_code ? String(linkedInvoice.currency_code) : null;
      const linkedInvoiceExchangeRate = linkedInvoice?.exchange_rate == null ? null : Number(linkedInvoice.exchange_rate);
      const journalId = await createDispatchCostJournal({
        branchId: linkedInvoiceBranchId,
        costCenterCode: linkedInvoiceCostCenterCode,
        currencyCode: linkedInvoiceCurrencyCode,
        departmentId: linkedInvoiceDepartmentId,
        dispatchId: id,
        dispatchNumber: String(dispatch.dispatch_note_number ?? id),
        exchangeRate: linkedInvoiceExchangeRate,
        organizationId: ctx.organizationId,
        service,
        totalCost: totalDispatchCost,
        userId: ctx.userId,
      });

      for (const plan of movementPlans) {
        const balanceUpdateResult = await service
          .from('stock_balances')
          .update({
            last_updated: new Date().toISOString(),
            quantity: plan.nextOnHand,
            quantity_available: plan.quantityAvailable,
            quantity_on_hand: plan.nextOnHand,
            quantity_reserved: plan.nextReserved,
            total_value: plan.nextTotalValue,
          })
          .eq('id', plan.balanceId);
        if (balanceUpdateResult.error) {
          throw balanceUpdateResult.error;
        }

        const movementInsertResult = await service.from('stock_movements').insert({
          branch_id: linkedInvoiceBranchId,
          created_by: ctx.userId,
          item_id: plan.itemId,
          journal_entry_id: journalId,
          movement_type: 'SALES_ISSUE',
          organization_id: ctx.organizationId,
          quantity: plan.quantity,
          reference_number: String(dispatch.dispatch_note_number ?? id),
          running_balance: plan.nextOnHand,
          running_value: plan.nextTotalValue,
          reference_id: id,
          reference_type: 'sales_dispatch',
          source_document_id: id,
          source_document_type: 'sales_dispatch',
          total_cost: plan.totalCost,
          total_value: plan.totalCost,
          unit_cost: plan.unitCost,
          warehouse_id: dispatch.warehouse_id,
        });
        if (movementInsertResult.error) {
          throw movementInsertResult.error;
        }

        try {
          await emitLowStockNotificationIfNeeded({
            actorUserId: ctx.userId,
            itemId: plan.itemId,
            organizationId: ctx.organizationId,
            warehouseId: String(dispatch.warehouse_id ?? ''),
          });
        } catch {
          // Notification delivery is non-blocking for live compatibility.
        }
      }

      const dispatchUpdateResult = await service
        .from('sales_dispatch_notes')
        .update({
          dispatched_by: ctx.userId,
          posted_at: new Date().toISOString(),
          status: 'POSTED',
        })
        .eq('id', id);
      if (dispatchUpdateResult.error && !isMissingSalesTable(dispatchUpdateResult.error)) {
        throw dispatchUpdateResult.error;
      }

      const invoiceUpdateResult = await service
        .from('invoices')
        .update({ status: 'FULLY_DISPATCHED' })
        .eq('id', dispatch.invoice_id);
      if (invoiceUpdateResult.error && linkedInvoiceStatus !== 'SENT') {
        throw invoiceUpdateResult.error;
      }

      if (workflowPostingAvailable && postingLogId) {
        const postingLogUpdateResult = await workflow.from('posting_logs').update({
          posted_at: new Date().toISOString(),
          posting_status: 'POSTED',
        }).eq('id', postingLogId);
        if (postingLogUpdateResult.error && !isMissingSalesTable(postingLogUpdateResult.error)) {
          throw postingLogUpdateResult.error;
        }
      }

      if (workflowPostingAvailable) {
        const documentLockInsertResult = await workflow.from('document_locks').insert({
          document_id: id,
          document_type: 'sales_dispatch',
          is_active: true,
          lock_reason: getDocumentLockReason('POSTED'),
          locked_at: new Date().toISOString(),
          locked_by: ctx.userId,
          module_name: 'sales',
          organization_id: ctx.organizationId,
        });
        if (documentLockInsertResult.error && !isMissingSalesTable(documentLockInsertResult.error)) {
          throw documentLockInsertResult.error;
        }
      }

      const workflowHistoryResult = await workflow.from('workflow_history').insert({
        action: 'SALES_SALES_DISPATCH_POSTED',
        action_at: new Date().toISOString(),
        actor_id: ctx.userId,
        document_id: id,
        document_reference: String(dispatch.dispatch_note_number ?? id),
        document_type: 'sales_dispatch',
        from_status: 'APPROVED',
        module_name: 'sales',
        organization_id: ctx.organizationId,
        to_status: 'POSTED',
      });
      if (workflowHistoryResult.error && !isMissingSalesTable(workflowHistoryResult.error)) {
        throw workflowHistoryResult.error;
      }

      await writeSalesAuditLog('SALES_DISPATCH_POSTED', id, ctx.userId, { status: 'POSTED' }, 'sales_dispatch_note');
      try {
        await emitOperationalNotifications({
          actorUserId: ctx.userId,
          documentId: id,
          documentType: 'sales_dispatch',
          eventType: 'DISPATCH_POSTED',
          message: `Dispatch ${String(dispatch.dispatch_note_number ?? id)} was posted successfully.`,
          metadata: {
            dispatchNumber: String(dispatch.dispatch_note_number ?? id),
            invoiceId: String(dispatch.invoice_id ?? ''),
          },
          moduleName: 'dispatch',
          organizationId: ctx.organizationId,
          recipientRoleNames: ['Stores Manager', 'Sales Manager'],
          severity: 'LOW',
          title: 'Dispatch posted',
          warehouseId: String(dispatch.warehouse_id ?? ''),
        });
      } catch {
        // Notification delivery is non-blocking for live compatibility.
      }
      return NextResponse.json({ posted: true });
    } catch (error) {
      if (workflowPostingAvailable && postingLogId) {
        await workflow.from('posting_logs').update({
          error_message: error instanceof Error ? error.message : 'Posting failed.',
          posted_at: new Date().toISOString(),
          posting_status: 'FAILED',
        }).eq('id', postingLogId);
      }
      throw error;
    }
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
