import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  NO_OPEN_ACCOUNTING_PERIOD_MESSAGE,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { collapseFinancePostingLines, resolveInventoryPostingMappingKey, resolveProductionCostCentrePriority, toDateOnly } from '@/lib/finance-integration';
import { postFinanceDocument } from '@/lib/finance-server';
import { mapProductionRpcError, postProductionIssue, reverseProductionIssue } from '@/lib/production-orders-server';
import { isProductionDocumentDateInFuture } from '@/lib/production';
import { authorizeProductionOrderWriteAccess } from '@/lib/production-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_issue.post')) return forbidden();

  try {
    const { id } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }
    const body = await request.json() as {
      department?: string | null;
      idempotencyKey?: string | null;
      issueDate?: string | null;
      lines?: Array<Record<string, unknown>>;
      remarks?: string | null;
      shift?: string | null;
    };
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('At least one issue line is required.');
    if (isProductionDocumentDateInFuture(body.issueDate ?? null)) {
      return badRequest('issueDate cannot be in the future.');
    }
    const result = await postProductionIssue({
      department: body.department ?? null,
      idempotencyKey: body.idempotencyKey ?? request.headers.get('idempotency-key'),
      issueDate: body.issueDate ?? null,
      lines: body.lines,
      orderId: id,
      remarks: body.remarks ?? null,
      shift: body.shift ?? null,
    }, ctx);
    if (result.success === false || !result.productionIssueId) {
      return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
    }

    const service = createServiceRoleClient();
    const issueResult = await service
      .schema('icecream_erp')
      .from('production_issues')
      .select('id, issue_number, issue_date, branch_id, shift, total_cost')
      .eq('organization_id', ctx.organizationId)
      .eq('id', String(result.productionIssueId))
      .single();
    if (issueResult.error || !issueResult.data) {
      throw issueResult.error ?? new Error('Posted production issue could not be loaded for finance integration.');
    }
    const issueLinesResult = await service
      .schema('icecream_erp')
      .from('production_issue_lines')
      .select('component_item_id, current_issue_quantity, unit_cost, line_cost')
      .eq('organization_id', ctx.organizationId)
      .eq('production_issue_id', String(result.productionIssueId));
    if (issueLinesResult.error) {
      throw issueLinesResult.error;
    }

    try {
      const postingDate = toDateOnly(String(issueResult.data.issue_date ?? body.issueDate ?? ''));
      const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
      if (!period) {
        throw new Error(NO_OPEN_ACCOUNTING_PERIOD_MESSAGE);
      }

      const branchId = issueResult.data.branch_id ? String(issueResult.data.branch_id) : null;
      const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
        branchId,
        preferredCodes: [
          ...resolveProductionCostCentrePriority(String(issueResult.data.shift ?? body.shift ?? '')),
          ...getFinanceModuleDefaultCostCentreCodes('production'),
        ],
      });
      const itemIds = [
        ...new Set((issueLinesResult.data ?? []).map((line) => String(line.component_item_id ?? '')).filter(Boolean)),
      ];
      const itemsResult = itemIds.length > 0
        ? await service
            .schema('icecream_erp')
            .from('items')
            .select('id, item_type, item_categories(name)')
            .in('id', itemIds)
        : { data: [], error: null };
      if (itemsResult.error) {
        throw itemsResult.error;
      }
      const itemMeta = new Map(
        ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
          const category = Array.isArray(row.item_categories) ? row.item_categories[0] : row.item_categories;
          return [
            String(row.id ?? ''),
            {
              itemCategoryName: category && typeof category === 'object' ? String((category as Record<string, unknown>).name ?? '') : '',
              itemType: String(row.item_type ?? ''),
            },
          ] as const;
        }),
      );
      const wipAccount = await resolveFinancePostingAccount(ctx.organizationId, 'WORK_IN_PROGRESS', {
        branchId,
        fallbackAccountCode: '1230',
        transactionType: 'PRODUCTION_ISSUE',
      });
      const creditLines = await Promise.all((issueLinesResult.data ?? []).map(async (line) => {
        const itemId = String(line.component_item_id ?? '').trim();
        const amount = Number(line.line_cost ?? (Number(line.current_issue_quantity ?? 0) * Number(line.unit_cost ?? 0)));
        if (!itemId || amount <= 0) return null;
        const meta = itemMeta.get(itemId);
        const mappingKey = resolveInventoryPostingMappingKey({
          itemCategoryName: meta?.itemCategoryName ?? null,
          itemType: meta?.itemType ?? null,
        });
        const inventoryAccount = await resolveFinancePostingAccount(ctx.organizationId, mappingKey, {
          branchId,
          fallbackAccountCode: mappingKey === 'PACKAGING_INVENTORY' ? '1217' : '1210',
          transactionType: 'PRODUCTION_ISSUE',
        });
        return {
          accountId: inventoryAccount.id,
          branchId,
          costCenterCode,
          creditAmount: amount,
          debitAmount: 0,
          description: `Production material issue item ${itemId}`,
        };
      }));
      const totalIssueCost = creditLines.reduce((sum, line) => sum + Number(line?.creditAmount ?? 0), 0) || Number(issueResult.data.total_cost ?? 0);
      const financeLines = collapseFinancePostingLines([
        {
          accountId: wipAccount.id,
          branchId,
          costCenterCode,
          creditAmount: 0,
          debitAmount: totalIssueCost,
          description: `WIP for production issue ${String(issueResult.data.issue_number ?? result.productionIssueId)}`,
        },
        ...creditLines.filter(Boolean) as Array<{
          accountId: string;
          branchId?: string | null;
          costCenterCode?: string | null;
          creditAmount: number;
          debitAmount: number;
          description?: string | null;
        }>,
      ]);

      const journal = await postFinanceDocument({
        branchId,
        costCenterCode,
        createdBy: ctx.userId,
        description: `Production issue ${String(issueResult.data.issue_number ?? result.productionIssueId)}`,
        journalDate: postingDate,
        lines: financeLines,
        organizationId: ctx.organizationId,
        sourceDocumentId: String(result.productionIssueId),
        sourceDocumentType: 'production_issue',
        sourceModule: 'production',
      });

      return NextResponse.json({ ...result, fiscalPeriodId: String(period.id ?? ''), journal }, { status: 200 });
    } catch (postingError) {
      await reverseProductionIssue({
        issueId: String(result.productionIssueId),
        reason: `Finance posting failed: ${postingError instanceof Error ? postingError.message : 'unknown error'}`,
      }, ctx).catch(() => null);
      throw postingError;
    }
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
