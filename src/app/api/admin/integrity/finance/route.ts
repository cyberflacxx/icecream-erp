import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { findJournalBySource, financeService, isMissingFinanceColumn, isMissingFinanceTable, loadLedgerLines } from '@/lib/finance-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type IntegrityIssue = {
  description: string;
  issueType: string;
  journalId: string | null;
  recommendedAction: string;
  severity: 'high' | 'medium' | 'low';
  sourceDocumentId: string | null;
  sourceDocumentType: string | null;
  sourceModule: string | null;
};

function issue(input: IntegrityIssue) {
  return input;
}

async function checkMissingInventoryColumns() {
  const service = createServiceRoleClient();
  const issues: IntegrityIssue[] = [];

  const grnItems = await service
    .schema('icecream_erp')
    .from('goods_received_note_items')
    .select('id, accepted_quantity, damaged_quantity, shortage_quantity')
    .limit(1);
  if (grnItems.error && isMissingFinanceColumn(grnItems.error, 'goods_received_note_items', 'accepted_quantity')) {
    issues.push(issue({
      description: 'Live schema is missing accepted/damaged/shortage quantity columns on goods_received_note_items.',
      issueType: 'missing_inventory_columns',
      journalId: null,
      recommendedAction: 'Apply migrations/023_inventory_stores_controls.sql on the VPS and reload PostgREST schema.',
      severity: 'high',
      sourceDocumentId: null,
      sourceDocumentType: 'goods_received_note_items',
      sourceModule: 'inventory',
    }));
  }

  const stockMovements = await service
    .schema('icecream_erp')
    .from('stock_movements')
    .select('id, source_warehouse_id, destination_warehouse_id')
    .limit(1);
  if (stockMovements.error && isMissingFinanceColumn(stockMovements.error, 'stock_movements', 'source_warehouse_id')) {
    issues.push(issue({
      description: 'Live schema is missing source/destination warehouse columns on stock_movements.',
      issueType: 'missing_inventory_columns',
      journalId: null,
      recommendedAction: 'Apply migrations/023_inventory_stores_controls.sql on the VPS and reload PostgREST schema.',
      severity: 'high',
      sourceDocumentId: null,
      sourceDocumentType: 'stock_movements',
      sourceModule: 'inventory',
    }));
  }

  return issues;
}

async function checkMissingFinanceTables() {
  const requiredTables = [
    ['finance_expenses', 'Finance expense management is unavailable because finance_expenses is not deployed.'],
    ['payments', 'Customer payment persistence is unavailable because payments is not deployed.'],
    ['bank_accounts', 'Bank setup is unavailable because bank_accounts is not deployed.'],
    ['bank_transactions', 'Bank transaction linking is unavailable because bank_transactions is not deployed.'],
    ['cash_accounts', 'Cash account setup is unavailable because cash_accounts is not deployed.'],
    ['cash_transactions', 'Cash transaction linking is unavailable because cash_transactions is not deployed.'],
  ] as const;

  const checks = await Promise.all(
    requiredTables.map(async ([table, description]) => {
      const result = await financeService().from(table).select('id').limit(1);
      return result.error && isMissingFinanceTable(result.error)
        ? issue({
            description,
            issueType: 'missing_finance_table',
            journalId: null,
            recommendedAction: `Apply the pending finance migrations that create ${table} on the live ERP database.`,
            severity: 'high',
            sourceDocumentId: null,
            sourceDocumentType: table,
            sourceModule: 'finance',
          })
        : null;
    }),
  );

  return checks.filter(Boolean) as IntegrityIssue[];
}

async function checkJournals(organizationId: string) {
  const lines = await loadLedgerLines(organizationId, false);
  const grouped = new Map<string, { credit: number; debit: number; lines: typeof lines }>();
  const issues: IntegrityIssue[] = [];

  for (const line of lines) {
    const current = grouped.get(line.journalId) ?? { credit: 0, debit: 0, lines: [] as typeof lines };
    current.credit += line.creditAmount;
    current.debit += line.debitAmount;
    current.lines.push(line);
    grouped.set(line.journalId, current);
  }

  const duplicateSourceMap = new Map<string, string[]>();
  for (const [journalId, group] of grouped.entries()) {
    const firstLine = group.lines[0];
    if (!firstLine) continue;

    if (Math.abs(group.debit - group.credit) > 0.01) {
      issues.push(issue({
        description: `Journal ${firstLine.entryNumber ?? journalId} is unbalanced.`,
        issueType: 'unbalanced_journal',
        journalId,
        recommendedAction: 'Review journal lines and reverse/repost the source document.',
        severity: 'high',
        sourceDocumentId: firstLine.sourceDocumentId,
        sourceDocumentType: firstLine.sourceDocumentType,
        sourceModule: firstLine.sourceModule,
      }));
    }

    if (firstLine.sourceReference) {
      const journalIds = duplicateSourceMap.get(firstLine.sourceReference) ?? [];
      journalIds.push(journalId);
      duplicateSourceMap.set(firstLine.sourceReference, journalIds);
    }
  }

  for (const [sourceReference, journalIds] of duplicateSourceMap.entries()) {
    if (journalIds.length < 2) continue;
    issues.push(issue({
      description: `Multiple journals are linked to the same source reference ${sourceReference}.`,
      issueType: 'duplicate_source_posting',
      journalId: journalIds[0] ?? null,
      recommendedAction: 'Identify the correct journal and reverse duplicates before further posting.',
      severity: 'high',
      sourceDocumentId: sourceReference.split(':').slice(2).join(':') || null,
      sourceDocumentType: sourceReference.split(':')[1] ?? null,
      sourceModule: sourceReference.split(':')[0] ?? null,
    }));
  }

  return issues;
}

async function checkPostedProcurementDocuments(organizationId: string) {
  const service = createServiceRoleClient();
  const issues: IntegrityIssue[] = [];

  const supplierPayments = await service
    .schema('icecream_erp')
    .from('supplier_payments')
    .select('id, status')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);
  if (!supplierPayments.error) {
    for (const row of supplierPayments.data ?? []) {
      if (String(row.status ?? '').toUpperCase() !== 'POSTED') continue;
      const journal = await findJournalBySource(organizationId, 'procurement', 'supplier_payment', String(row.id));
      if (!journal) {
        issues.push(issue({
          description: `Supplier payment ${row.id} is posted without a linked journal.`,
          issueType: 'posted_source_without_journal',
          journalId: null,
          recommendedAction: 'Post the supplier payment through the finance posting service.',
          severity: 'high',
          sourceDocumentId: String(row.id),
          sourceDocumentType: 'supplier_payment',
          sourceModule: 'procurement',
        }));
      }
    }
  }

  const supplierInvoices = await service
    .schema('icecream_erp')
    .from('supplier_invoices')
    .select('id, status')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);
  if (!supplierInvoices.error) {
    for (const row of supplierInvoices.data ?? []) {
      if (String(row.status ?? '').toUpperCase() !== 'POSTED') continue;
      const journal = await findJournalBySource(organizationId, 'procurement', 'supplier_invoice', String(row.id));
      if (!journal) {
        issues.push(issue({
          description: `Supplier invoice ${row.id} is posted without a linked journal.`,
          issueType: 'posted_source_without_journal',
          journalId: null,
          recommendedAction: 'Post the supplier invoice through the finance posting service.',
          severity: 'high',
          sourceDocumentId: String(row.id),
          sourceDocumentType: 'supplier_invoice',
          sourceModule: 'procurement',
        }));
      }
    }
  }

  return issues;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.integrity.view', 'finance.read', 'settings.manage')) return forbidden();

  try {
    const [inventoryColumns, financeTables, journals, procurement] = await Promise.all([
      checkMissingInventoryColumns(),
      checkMissingFinanceTables(),
      checkJournals(ctx.organizationId),
      checkPostedProcurementDocuments(ctx.organizationId),
    ]);

    return NextResponse.json([
      ...inventoryColumns,
      ...financeTables,
      ...journals,
      ...procurement,
    ]);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to run finance integrity checks.');
  }
}
