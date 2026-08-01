# ERP Phase 1F Atomic Posting and Stock Ledger Audit

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Scope: atomic operational posting, stock-take foundation, transfer consistency, stock ledger, reconciliation, exports/print, sidebar clarity, dashboard shortcuts

## Exact files inspected

- `ERP_PHASE_1D_CHART_OF_ACCOUNTS_IMPLEMENTATION_REPORT.md`
- `ERP_PHASE_1E_FINANCE_INTEGRATION_AUDIT.md`
- `ERP_PHASE_1E_FINANCE_INTEGRATION_IMPLEMENTATION_REPORT.md`
- `migrations/002_inventory_control_extensions.sql`
- `migrations/006_branch_operations_extensions.sql`
- `migrations/032_procurement_launch_workflow_compatibility.sql`
- `migrations/034_atomic_inventory_approval_processing.sql`
- `migrations/036_production_issue_and_receipt_documents.sql`
- `migrations/038_production_order_transaction_rpcs.sql`
- `migrations/040_sales_finance_transaction_engine.sql`
- `migrations/042_production_reopen_and_relationship_links.sql`
- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/icecream_erp_live_schema_20260712.sql`
- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/lib/procurement-goods-received.ts`
- `src/app/api/inventory/adjustments/route.ts`
- `src/app/api/inventory/stock-take/route.ts`
- `src/app/api/inventory/write-off/route.ts`
- `src/app/api/inventory/transfers/route.ts`
- `src/app/api/inventory/transfers/[id]/approve/route.ts`
- `src/app/api/inventory/transfers/[id]/cancel/route.ts`
- `src/app/api/inventory/transfers/[id]/complete/route.ts`
- `src/app/api/inventory/stock-movements/route.ts`
- `src/app/api/reports/export/[category]/[reportType]/route.ts`
- `src/app/api/reports/export/pdf/route.ts`
- `src/app/(dashboard)/inventory/stock-movements/page.tsx`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/finance/reports/page.tsx`
- `src/app/(dashboard)/finance/page.tsx`
- `src/components/dashboard/sidebar.tsx`
- `src/components/dashboard/dashboard-overview.tsx`
- `src/components/procurement/transaction-shortcuts.tsx`
- `src/hooks/inventory/types.ts`
- `src/hooks/inventory/useStockMovements.ts`
- `src/lib/inventory.ts`
- `src/lib/inventory-server.ts`
- `src/lib/finance-server.ts`
- `src/lib/reporting.ts`
- `src/lib/dashboard-access.ts`
- `tests/procurement-helpers.test.ts`
- `tests/inventory-helpers.test.ts`
- `tests/production-helpers.test.ts`

## Current posting flows

### GRN

Current path:

- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/lib/procurement-goods-received.ts`

Current behavior:

- Route validates approval and warehouse access.
- Route resolves finance mappings and posts a finance journal first.
- Helper then updates stock balances, stock movements, PO line received quantities, PO status, and GRN status.
- If the stock leg fails, the route deletes the journal as compensating cleanup.

Finding:

- Not atomic at database level.

### Stock adjustment

Current path:

- `src/app/api/inventory/adjustments/route.ts`
- `src/lib/inventory-server.ts`

Current behavior:

- Route creates a posted `stock_adjustments` header and item row.
- Route updates stock balances.
- Route inserts a stock movement.
- Route writes an audit log.
- No finance journal is created in this route.

Findings:

- No single transaction across header, line, stock balance, movement, and audit.
- No approval workflow.
- No duplicate-posting guard beyond request-level behavior.

### Stock take

Current path:

- `src/app/api/inventory/stock-take/route.ts`

Current behavior:

- Route accepts `warehouseId`, `items[]`, `postVariances`, and `reason`.
- No stock-take document header is created.
- If `postVariances` is true, the route posts finance first, then creates `stock_adjustments`, then updates stock balances.
- If the stock leg fails, the route deletes the finance journal.

Findings:

- Existing DB tables `inventory_stock_takes` and `inventory_stock_take_items` are not used.
- No DRAFT -> SUBMITTED -> APPROVED -> POSTED workflow.
- No idempotency key.
- No document number.
- No atomic posting.

### Write-off

Current path:

- `src/app/api/inventory/write-off/route.ts`

Current behavior:

- Route loads an expired batch and validates stock.
- Route posts a finance journal first.
- Route updates the batch.
- Route updates stock balances.
- Route inserts a stock movement.
- If later steps fail, the route deletes the journal.

Finding:

- Not atomic at database level.

### Stock transfer

Current paths:

- `src/app/api/inventory/transfers/route.ts`
- `src/app/api/inventory/transfers/[id]/approve/route.ts`
- `src/app/api/inventory/transfers/[id]/complete/route.ts`

Current behavior:

- Create route still allows `COMPLETED` input.
- Direct creation with `COMPLETED` immediately updates source and destination stock and inserts transfer movements.
- No finance posting happens on direct `COMPLETED` creation.
- Approve route maps approval-like states back to `DRAFT` because the live enum is still limited.
- Complete route blocks duplicate movements, posts a four-line finance journal first, then updates stock, then inserts movements, then updates transfer status.

Findings:

- Direct completed creation bypasses finance posting.
- Dispatch and receipt are collapsed into one completion action.
- No partial receipt route.
- No separate Goods In Transit operational state.
- Not atomic at database level.

### Production issue and receipt

Current paths:

- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `migrations/038_production_order_transaction_rpcs.sql`

Current behavior:

- Operational stock posting is transactional inside DB RPCs.
- Finance journals are still posted from the route after the RPC succeeds.
- If finance posting fails, the route calls the matching reversal RPC as compensating rollback.

Finding:

- Production still depends on application-level compensating reversal when finance posting fails.

## Non-atomic paths

- GRN posting
- stock adjustment posting
- stock-take variance posting
- write-off posting
- transfer completion posting
- direct transfer creation with immediate stock movement
- production finance integration after issue RPC
- production finance integration after receipt RPC

## Duplicate posting risks

- GRN route is guarded by `stock_posted` and movement uniqueness, but finance and stock are still separate steps.
- write-off route has no operation-level idempotency key.
- stock-take route has no header-level or request-level idempotency key.
- stock adjustment route has no idempotency key.
- transfer create route can post movements immediately without a shared posting token.
- transfer completion route guards existing movements, but direct create `COMPLETED` is a bypass path.

## Missing idempotency protection

- `goods_received_notes` has no posting idempotency key for GRN posting.
- `stock_adjustments` route does not use idempotency.
- `inventory_stock_takes` existing tables do not have idempotency keys.
- write-off route does not persist idempotency.
- transfer dispatch/receipt do not have dispatch/receipt idempotency keys.

## Transfer bypass paths

- `src/app/api/inventory/transfers/route.ts` accepts `COMPLETED` on create.
- `src/lib/inventory.ts` maps `PENDING_APPROVAL` and `APPROVED` back to `DRAFT` because the current enum is behind the UI.
- Current workflow has no explicit dispatch route and no explicit receipt route.

## Stock movement inconsistencies

- `stock_movements` is used as history, but not as one deterministic ledger.
- Current `/inventory/stock-movements` view shows movement date, quantity, running balance, and reference only.
- It does not calculate deterministic running value.
- It does not include branch, source branch, destination branch, posting status, journal link, source document number, movement number, or reversal reference.
- It does not include opening balances as first-class display rows.
- Movement labels are still normalized from legacy types such as `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, and `EXPIRY_WRITE_OFF`.

## Missing source-document links

- GRN movements do carry `reference_type`, `reference_id`, `source_document_type`, and `source_document_id`.
- Many inventory movement paths still rely only on `reference_type` and `reference_id`.
- There is no shared inventory relationship map equivalent to production document links.
- Current ledger API does not expose journal linkage.

## Running-balance gaps

- `running_balance` is stored, but not recomputed deterministically across filtered ledgers.
- `running_value` is not available on the live table contract used by the current page.
- Opening stock is recorded today as `ADJUSTMENT_IN` with `reference_type = 'opening_stock_balance'`, not as a normalized `OPENING_BALANCE` ledger movement.

## Report export gaps

- Generic CSV and PDF export routes already exist under `/api/reports/export/...`.
- Finance reports page does not expose export or print controls for the required finance reports.
- Inventory stock-movement page does not expose CSV export or print view.
- No inventory reconciliation report exists yet.
- No generic HTML print view exists for the required report set.

## Sidebar and shortcut gaps

- Sidebar groups are `Overview`, `Operations`, `Control`, `Platform`, not the required `Operations`, `Finance`, `Administration`.
- Sidebar items are top-level only; there is no active child indication or expandable group structure.
- No collapsed sidebar tooltip behavior exists.
- Role-based visibility exists, but branch-oriented operational shortcuts are not surfaced from the main dashboard.
- Finance module page has shortcuts, but there is no shared role-based dashboard shortcut system for Branch Manager, Procurement, Production, Finance, and Administrator personas.

## Schema changes required

Required in `044`:

- additive transfer status support for `PENDING_APPROVAL`, `APPROVED`, and `PARTIALLY_RECEIVED`
- stock-take header and line workflow columns on `inventory_stock_takes` and `inventory_stock_take_items`
- atomic posting RPCs for GRN, stock take posting, write-off, transfer dispatch, and transfer receipt
- operation-level idempotency storage
- stock movement ledger support columns and indexes
- inventory document relationship support
- reversal support columns for stock-take, transfer, and write-off documents

## Recommended implementation sequence

1. Migration `044`:
   - posting-run/idempotency support
   - stock-take workflow foundation
   - transfer status support
   - stock-movement ledger columns/indexes
   - atomic RPCs
2. Replace app-level compensating cleanup in:
   - GRN post route
   - stock-take route
   - write-off route
   - transfer completion paths
3. Remove direct `COMPLETED` transfer bypass and introduce dispatch/receipt consistency.
4. Upgrade stock movement API and page into a proper ledger plus reconciliation report.
5. Add export and print controls plus a reusable print view.
6. Rework sidebar grouping and add role-based dashboard shortcuts.
7. Add tests for atomic posting, transfer consistency, ledger behavior, reconciliation, exports, and shortcut visibility.
