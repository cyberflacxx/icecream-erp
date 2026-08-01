# ERP Phase 1E Finance Integration Audit

Date: August 1, 2026
Branch: `fix/sales-invoice-production`
Phase scope: Procurement GRNs, Production postings, Inventory adjustments and write-offs, Branch transfers, Sales COGS preservation, Finance reports

## Executive summary

Phase 1D provided the Chart of Accounts, cost centre, and account-mapping foundation in migration `043_finance_chart_of_accounts_foundation.sql`, but several operational workflows still posted stock or production activity without finance journals. The finance report APIs and the finance reports page also under-used the new branch and cost-centre foundation.

This Phase 1E batch connected the main posting paths that were still missing route-level finance integration:

- Procurement GRN posting
- Production issue posting
- Production receipt posting
- Production issue reversal journal correction
- Production receipt reversal journal correction
- Inventory stock-take variance posting
- Inventory write-off posting
- Stock transfer completion posting
- Finance report filters and additional report surfaces

No new migration was required in this batch. `043` remains unapplied in this workspace and no `044` was created.

## Exact files inspected

- `ERP_PHASE_1D_CHART_OF_ACCOUNTS_AUDIT.md`
- `ERP_PHASE_1D_CHART_OF_ACCOUNTS_IMPLEMENTATION_REPORT.md`
- `migrations/040_sales_finance_transaction_engine.sql`
- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
- `src/lib/finance-foundation.ts`
- `src/lib/finance-foundation-server.ts`
- `src/lib/finance-server.ts`
- `src/lib/finance.ts`
- `src/lib/procurement-goods-received.ts`
- `src/lib/production-orders-server.ts`
- `src/lib/production-server.ts`
- `src/lib/inventory-server.ts`
- `src/lib/sales-transactions-server.ts`
- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/app/api/procurement/supplier-invoices/[id]/post/route.ts`
- `src/app/api/procurement/supplier-payments/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`
- `src/app/api/inventory/stock-take/route.ts`
- `src/app/api/inventory/write-off/route.ts`
- `src/app/api/inventory/transfers/[id]/complete/route.ts`
- `src/app/api/finance/reports/*`
- `src/app/(dashboard)/finance/reports/page.tsx`
- `tests/finance-helpers.test.ts`
- `tests/production-helpers.test.ts`

## Existing posting paths found before implementation

- GRN posting updated inventory and PO received quantities, but did not create journals.
- Production issue and receipt posted inventory through RPCs, but did not create journals in the route layer.
- Inventory stock take and write-off changed stock and created movements, but did not create journals.
- Stock transfer completion moved inventory and created stock movements, but did not create finance journals.
- Sales invoice and payment posting already used the migration 040 sales finance transaction engine and existing finance helpers.
- Supplier invoice and supplier payment routes already used `resolveFinancePostingAccount` and `postFinanceDocument`.

## Hard-coded account code exposure found before implementation

Fallback account codes already existed in finance posting paths. They were not hard-coded UUIDs, but they still required central resolution:

- `1210` raw materials inventory
- `1217` packaging inventory
- `1230` work in progress
- `1240` finished goods inventory
- `1250` branch inventory
- `1260` goods in transit
- `1270` inventory variance
- `2110` supplier payables
- `5090` inventory write-off
- `5100` production variance

Phase 1E kept the fallback-code pattern but moved route decisions through the shared mapping resolver so configured mappings take precedence.

## Missing mappings or metadata found before implementation

- GRN posting had no cost-centre resolution.
- Production issue and receipt routes had no account or cost-centre resolution.
- Finance report routes ignored branch, cost-centre, and date filters.
- The finance reports page exposed only a subset of required reports.
- Transfer completion had no goods-in-transit journal behavior.

## Duplicate posting risks found before implementation

- GRN inventory posting protected stock movements, but finance posting was absent.
- Production RPCs blocked duplicate operational postings, but finance posting was absent.
- Transfer completion blocked duplicate stock movements, but finance posting was absent.
- Inventory stock take and write-off had no finance duplicate guard because finance was absent.

## Atomicity and rollback findings

- There is still no single shared database transaction covering journal header, journal lines, inventory rows, stock balances, stock movements, status changes, and audit rows across all affected modules.
- This batch used compensating rollback where practical:
  - GRN: finance posts first, then stock posts; journal is deleted if stock posting fails.
  - Production issue and receipt: operational RPC posts first; reversal RPC is invoked if finance posting fails.
  - Inventory stock take, write-off, and transfer completion: journal is deleted if the later stock leg fails.

This improves consistency materially, but it is not equivalent to a single PostgreSQL transaction across module boundaries.

## Branch and cost-centre findings

- `postFinanceDocument` now accepts branch and cost-centre fields at journal and line level.
- `loadLedgerLines` now loads and filters branch and cost-centre data.
- Shared resolver improvements now support:
  - branch-aware account mapping lookup
  - reusable cost-centre resolution
  - reusable module default cost-centre priorities
  - open fiscal period lookup reuse

## Source document relationship findings

- Finance journals now link operational source documents for:
  - `goods_received_note`
  - `production_issue`
  - `production_receipt`
  - `production_issue_reversal`
  - `production_receipt_reversal`
  - `stock_take`
  - `inventory_write_off`
  - `stock_transfer`

Residual gap: stock take uses a synthetic source document id because there is no dedicated stock-take header document model in the current schema.

## Reporting gaps found before implementation

- Trial balance lacked opening, period, and closing columns.
- General ledger ignored filters.
- Branch profitability used `branch_reconciliations` instead of posted ledger lines.
- No cost-centre profit and loss route existed.
- Inventory valuation did not include branch, batch, or expiry context.
- Finance reports page did not surface general ledger, branch P&L, cost-centre P&L, inventory valuation, or production cost report together with common filters.

## Migration requirement

No migration required in this batch.

Reason:

- Account mappings and cost centres already exist in Phase 1D migration `043`.
- Route-level finance integration was achievable with existing schema and helper changes.
- Report filtering was achievable from current journal and stock tables.

## Implementation batches applied

1. Shared resolver and journal metadata alignment
2. Procurement and production posting integration
3. Inventory posting integration
4. Report API upgrades and finance reports page expansion
5. Helper and route test updates

## Residual risks after implementation

- Transfer finance is attached to completion, not the create route when a transfer is created directly in `COMPLETED` status.
- Stock take still relies on synthetic source ids because the workflow has no dedicated header document.
- Production rollback depends on reversal RPC success after a finance-post failure.
- `next build` passes, but it skips type validation in this repo configuration. A separate `npm run typecheck` still fails on many unrelated pre-existing files outside this batch.
