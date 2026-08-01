# ERP Phase 1E Finance Integration Implementation Report

Date: August 1, 2026
Branch: `fix/sales-invoice-production`
Migration created: none

## Scope completed

This batch connected operational posting flows and finance reporting to the Phase 1D Chart of Accounts and cost-centre foundation without creating a new migration.

## Audit findings addressed

- GRN posting lacked finance journals.
- Production issue and receipt lacked finance journals.
- Production reversals lacked correcting finance journals.
- Inventory stock-take variance and write-off lacked finance journals.
- Stock transfer completion lacked finance journals.
- Finance ledger and summary reports ignored branch, cost-centre, and date filters.
- Finance reports UI exposed only part of the required report set.

## Account mappings used

The implementation resolves configured mappings first through `icecream_erp.erp_account_mappings` and only falls back to official account codes when a configured mapping is absent.

Mappings used in this batch:

- `RAW_MATERIAL_INVENTORY`
- `PACKAGING_INVENTORY`
- `WORK_IN_PROGRESS`
- `FINISHED_GOODS_INVENTORY`
- `BRANCH_INVENTORY`
- `GOODS_IN_TRANSIT`
- `INVENTORY_VARIANCE`
- `INVENTORY_WRITE_OFF`
- `SUPPLIER_PAYABLES`
- `PRODUCTION_VARIANCE`

## Procurement accounting

Updated:

- `src/app/api/procurement/grns/[id]/post/route.ts`

Behavior:

- Resolves branch and procurement cost centre before posting.
- Resolves inventory accounts per GRN line using item type and category heuristics.
- Posts a balanced GRN journal before stock posting.
- Deletes the journal if the stock-posting leg fails.
- Returns journal metadata and fiscal period id in the API response.

## Production accounting

Updated:

- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`

Behavior:

- Issue posting debits WIP and credits raw-material or packaging inventory.
- Receipt posting debits finished-goods inventory, debits write-off or variance where required, and credits WIP.
- Receipt costing uses completed, rejected, wastage, and residual variance amounts derived from receipt-line costs.
- Reversal routes now create correcting journals by inverting the original journal lines when a source journal exists.
- If finance posting fails after an operational RPC post, the matching production reversal RPC is invoked as a compensating rollback.

## Inventory adjustment accounting

Updated:

- `src/app/api/inventory/stock-take/route.ts`
- `src/app/api/inventory/write-off/route.ts`

Behavior:

- Stock-take gains debit inventory and credit inventory variance.
- Stock-take losses debit inventory variance and credit inventory.
- Expiry write-off debits inventory write-off and credits inventory.
- Journal posting now carries branch and cost-centre metadata.
- Journal cleanup is attempted if the stock leg fails after journal posting.

## Branch transfer accounting

Updated:

- `src/app/api/inventory/transfers/[id]/complete/route.ts`

Behavior:

- Transfer completion now posts a four-line goods-in-transit journal:
  - debit goods in transit
  - credit source branch inventory
  - debit destination branch inventory
  - credit goods in transit
- Journal metadata includes branch and cost-centre context for both source and destination legs.
- Journal cleanup is attempted if the stock movement leg fails.

Known limitation:

- Direct transfer creation in `COMPLETED` status is not yet routed through the same finance integration path.

## Sales COGS

Preserved:

- Existing sales transaction engine in `migrations/040_sales_finance_transaction_engine.sql`
- Existing sales finance helper flow

Phase 1E did not replace the migration 040 engine. It preserved the existing sales revenue and COGS posting path and extended finance reporting so that those postings surface through the new filtered ledgers and summaries.

## Cost-centre behavior

Shared resolver updates in `src/lib/finance-foundation-server.ts` now support:

- branch-aware account mapping resolution
- explicit cost-centre validation
- branch-default cost-centre resolution
- module-default cost-centre fallback
- open fiscal period reuse

Shared helper updates in `src/lib/finance-integration.ts` now support:

- inventory account mapping heuristics
- production shift cost-centre priority
- journal-line collapsing
- date normalization

## Report behavior

Updated report APIs:

- `src/app/api/finance/reports/trial-balance/route.ts`
- `src/app/api/finance/reports/profit-and-loss/route.ts`
- `src/app/api/finance/reports/balance-sheet/route.ts`
- `src/app/api/finance/reports/general-ledger/route.ts`
- `src/app/api/finance/reports/branch-profitability/route.ts`
- `src/app/api/finance/reports/inventory-valuation/route.ts`
- `src/app/api/finance/reports/production-costing/route.ts`
- `src/app/api/finance/reports/cost-centre-profitability/route.ts`

Updated UI:

- `src/app/(dashboard)/finance/reports/page.tsx`

Behavior:

- Trial balance now returns opening, period, and closing balances.
- P&L and balance sheet now accept branch, cost-centre, and date filters.
- General ledger now accepts account, branch, cost-centre, and date filters.
- Branch P&L now uses posted ledger lines rather than branch reconciliation snapshots.
- Cost-centre P&L is now exposed.
- Inventory valuation now includes branch, batch, warehouse, expiry, and total valuation.
- Production costing now surfaces receipt-based accepted-unit costing.
- Finance reports page now exposes the expanded report set behind a shared filter bar.

## Files changed in this batch

- `ERP_PHASE_1E_FINANCE_INTEGRATION_AUDIT.md`
- `ERP_PHASE_1E_FINANCE_INTEGRATION_IMPLEMENTATION_REPORT.md`
- `src/lib/finance-foundation-server.ts`
- `src/lib/finance-integration.ts`
- `src/lib/finance-server.ts`
- `src/lib/finance.ts`
- `src/lib/shared/api-routes.ts`
- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`
- `src/app/api/inventory/stock-take/route.ts`
- `src/app/api/inventory/write-off/route.ts`
- `src/app/api/inventory/transfers/[id]/complete/route.ts`
- `src/app/api/finance/reports/trial-balance/route.ts`
- `src/app/api/finance/reports/profit-and-loss/route.ts`
- `src/app/api/finance/reports/balance-sheet/route.ts`
- `src/app/api/finance/reports/general-ledger/route.ts`
- `src/app/api/finance/reports/branch-profitability/route.ts`
- `src/app/api/finance/reports/inventory-valuation/route.ts`
- `src/app/api/finance/reports/production-costing/route.ts`
- `src/app/api/finance/reports/cost-centre-profitability/route.ts`
- `src/app/(dashboard)/finance/reports/page.tsx`
- `tests/finance-helpers.test.ts`
- `tests/production-helpers.test.ts`

## Tests added or expanded

- `tests/finance-helpers.test.ts`
  - detailed production costing
  - detailed trial balance
  - branch profit and loss summary
  - cost-centre profit and loss summary
  - finance integration helper coverage
- `tests/production-helpers.test.ts`
  - route harness support for new finance imports

## Validation results

Commands executed:

- `npm run test:finance` -> PASS
- `npm run test:procurement` -> PASS
- `npm run test:production` -> PASS
- `npm run test:inventory` -> PASS
- `npm run test:sales` -> PASS
- `npm run test:branches` -> PASS
- `npm run lint` -> PASS with two existing warnings in unrelated files:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`
- `npm run build` -> PASS
- `git diff --check` -> PASS for whitespace checks; emitted existing LF to CRLF warnings only

Additional check run:

- `npm run typecheck` -> FAIL on pre-existing unrelated repository type errors outside the Phase 1E files

## Transaction rollback behavior

- GRN: journal deleted if stock posting fails after journal creation.
- Production issue and receipt: reversal RPC invoked if finance posting fails after the operational RPC.
- Stock take, write-off, and transfer completion: journal deleted if the later stock leg fails.
- Reversal routes: correcting journals are created by inverting the original source journal lines when a source journal exists.

## Known risks

- No shared database transaction spans journal posting and inventory mutation across all modules.
- Stock-take source document references are synthetic because the workflow lacks a dedicated header table.
- Transfer finance integration is attached to completion only.
- Production finance rollback depends on reversal RPC success.
- Global repo typecheck remains red due pre-existing non-Phase-1E issues.

## Deployment order

1. Deploy all preserved Phase 1A through 1D code and migration assets already in the branch.
2. Apply migration `043_finance_chart_of_accounts_foundation.sql` with its verification plan.
3. Deploy this Phase 1E application batch.
4. Run post-deploy validation for GRN, production issue, production receipt, stock take, write-off, and transfer completion.
5. Reconcile finance reports against posted operational samples.

## Rollback steps

1. Revert this application batch.
2. Rebuild and redeploy the previous application version.
3. For any partially posted operational document created during testing, use the module reversal flow first.
4. If a finance journal exists without the intended operational state, remove or reverse it using the finance source reference and module-specific correction procedure.

## Next recommended batch

1. Attach transfer finance posting to the direct create-in-completed flow.
2. Introduce true database-level atomic posting wrappers for GRN, transfer, and inventory adjustment workflows.
3. Add dedicated stock-take document headers so finance and audit links stop relying on synthetic ids.
4. Extend report exports and print views from the new report endpoints.
