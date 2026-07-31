# Production Workflow Alignment Implementation Report

## 1. Executive summary

Production Batch 3 is implemented in the repository workspace. The Production Orders workflow is now the primary operational path for planning, issue posting, receipt posting, and planned-order editing. The primary dashboard no longer uses legacy `production_batches` totals. Legacy batch pages remain reachable, but they are explicitly labeled legacy and warn users to use Production Orders for new transactions.

No migration was executed. No VPS action occurred.

## 2. Files changed

- `src/components/production/production-order-planning-form.tsx`
- `src/app/(dashboard)/production/orders/new/page.tsx`
- `src/app/(dashboard)/production/orders/[id]/edit/page.tsx`
- `src/app/(dashboard)/production/orders/page.tsx`
- `src/app/(dashboard)/production/orders/[id]/page.tsx`
- `src/app/(dashboard)/production/batches/page.tsx`
- `src/components/production/production-nav.tsx`
- `src/components/production/production-dashboard.tsx`
- `src/app/api/production/dashboard/route.ts`
- `src/app/api/production/meta/route.ts`
- `src/app/api/production/orders/products/route.ts`
- `src/app/api/production/orders/[id]/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/hooks/production/useProduction.ts`
- `src/hooks/production/useProductionMeta.ts`
- `src/lib/production.ts`
- `tests/production-helpers.test.ts`

## 3. Navigation changes

- Production navigation now exposes:
  - Dashboard
  - Production Orders
  - Planned Production
  - Issues
  - Receipts
  - Reports
  - Legacy Batches
- Issue and Receipt links now route to filtered Production Orders, not legacy batch stage screens.
- `/production` still redirects into the modern orders workflow.
- The orders list create action now routes to `/production/orders/new`.

## 4. Dashboard architecture

- The dashboard is now order-centric.
- Primary summary cards and recent activity grids are derived from:
  - `production_orders`
  - `production_order_components`
  - `production_issues`
  - `production_receipts`
  - `production_order_cost_summary`
- Legacy `production_batches` totals were removed from the primary dashboard path.

## 5. Dashboard query details

`src/app/api/production/dashboard/route.ts` now:

- enforces authenticated organization scope
- applies branch scope when the user is branch-scoped
- reads `production_orders` first
- loads dependent component, issue, receipt, and cost-summary rows for those order IDs
- returns zero-safe snapshots when no orders exist
- builds the response through `buildProductionOrdersDashboard(...)`

## 6. Dedicated planning page

- Added `/production/orders/new`
- Added shared planning component `ProductionOrderPlanningForm`
- Supports:
  - Product Number selector
  - Product name display
  - latest active BOM code/version
  - planned quantity
  - planned start/completion dates
  - branch
  - production warehouse
  - finished-goods warehouse
  - notes
  - calculated material requirements
  - available stock
  - shortages
  - estimated per-component cost
  - estimated total cost
- Save calls the existing authenticated Production Order API and redirects to the created order detail page.

## 7. Planned-order editing

- Added `/production/orders/[id]/edit`
- Editing is exposed only for `PLANNED` orders.
- The detail page now shows `Edit Planned Order` only when:
  - the order is `PLANNED`
  - the user has planned-order edit permission
  - no posted issue/receipt documents exist
- Editing reuses the same planning component and saves through the existing `PUT /api/production/orders/[id]` path.
- Quantity/product changes trigger a user warning before recalculating component requirements from the latest BOM.

## 8. BOM selection alignment

- `src/app/api/production/orders/products/route.ts` now aligns active BOM selection to:
  - active BOM only
  - `version desc`
  - `updated_at desc`
  - `id desc`
- `src/lib/production.ts` now exposes `selectLatestActiveBom(...)` for stable reuse.
- `src/app/api/production/meta/route.ts` uses the same selection logic when building `products`.

## 9. Issue and receipt changes

- Order detail now supports:
  - `issueDate`
  - `receiptDate`
  - sensible default dates
  - remarks on issue and receipt forms
- Issue and receipt sections now display document cards with:
  - document number
  - posting status
  - document date
  - quantity
  - warehouse
  - creator
  - reversal status
  - reversal reason
  - line-level detail
- API routes now reject future `issueDate` and `receiptDate`.
- Detail API reads issue/receipt warehouse and user joins for display.

## 10. Cache refresh behaviour

- Order detail actions invalidate:
  - `['production']`
  - `['production', 'order', id]`
  - `['production-batches']`
- Create/edit planning invalidates `['production']`
- This keeps order list, dashboard, and detail views fresh after:
  - create
  - edit
  - release
  - issue
  - receipt
  - reverse issue
  - reverse receipt
  - close
  - reopen

## 11. Legacy workflow handling

- Legacy batch pages remain present.
- They are no longer the primary navigation target for issue/receipt operations.
- The legacy page header and page body now explicitly warn that new transactions must use Production Orders.
- Historical compatibility is preserved.

## 12. Branch and organization enforcement

- Batch 1 protections were preserved.
- Order create/update/write APIs still rely on the existing branch/organization authorization helpers.
- Branch-scoped users remain restricted to their authenticated branch.
- Head-office branch changes still flow through the server-side authorization path.

## 13. Tests added

Added focused Production Batch 3 coverage in `tests/production-helpers.test.ts` for:

- future issue-date rejection
- future receipt-date rejection
- latest active BOM ordering
- zero-safe dashboard output
- dashboard aggregation from order tables
- navigation away from legacy batch posting paths
- dashboard route table usage
- dedicated create/edit page wiring
- legacy page labeling and warning

## 14. Validation results

- `npm run test:production`: PASS
- focused Batch 3 tests: PASS
- `npm run lint`: PASS with unrelated existing warnings
- `npm run typecheck`: FAIL due unrelated existing repository errors outside Production
- filtered Production typecheck grep: `NO_PRODUCTION_TYPECHECK_ERRORS_FOUND`
- `npm run build`: PASS
- `git diff --check`: PASS, with line-ending warnings only
- duplicate migration prefix check: PASS (`NO_DUPLICATE_MIGRATION_PREFIXES`)

## 15. Unrelated repository failures

`npm run typecheck` still fails outside Production, including existing errors in:

- `src/app/api/finance/dashboard/route.ts`
- multiple procurement API routes
- multiple sales API routes
- `src/app/api/users/[id]/route.ts`
- `src/lib/finance-server.ts`
- `src/lib/health.ts`
- `src/lib/sales-server.ts`

These were not modified as part of Batch 3.

## 16. Remaining Production issues

- No new Production-specific typecheck errors remain after the Batch 3 fixes.
- Legacy batch creation remains available by design for backward compatibility; it is now clearly marked legacy.
- Repo-wide typecheck remains blocked by unrelated modules, so full repository type safety is not yet green.

## 17. Confirmation that no migration or VPS action occurred

- No migration executed
- No deploy executed
- No VPS configuration changed
- No commit or push performed
