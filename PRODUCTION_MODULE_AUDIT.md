# PRODUCTION_MODULE_AUDIT

Audit date: July 30, 2026
Repository: Icecream ERP
Scope: inspection only, no functional changes, no migrations, no deploys, no destructive database work

## 1. Executive summary

The repository contains a real production-order workflow built around migrations `035` through `039`, server-side PostgREST RPC calls, and `/production/orders` pages. Core order planning, release, issue, receipt, closing, inventory posting, costing, audit logging, and duplicate-posting protection are implemented in the database layer and exposed through authenticated API routes.

The Production module is not internally aligned end to end. The main order workflow exists, but the production dashboard, navigation, and batch pages still front an older `production_batches` flow. Reversal support exists only in database RPCs. The relationship-map view does not use `production_document_links` even though those links are written. Branch-scoped write protection is incomplete on the order write endpoints. Tests do not cover the real production-order transaction layer or failure paths.

Bottom line: the module is not ready for end-to-end production-order testing in its current state.

## 2. Existing Production architecture

- Entry point:
  - `src/app/(dashboard)/production/page.tsx` redirects to `/production/orders`.
- New production-order workflow:
  - UI:
    - `src/app/(dashboard)/production/orders/page.tsx`
    - `src/app/(dashboard)/production/orders/[id]/page.tsx`
  - API:
    - `src/app/api/production/orders/route.ts`
    - `src/app/api/production/orders/[id]/route.ts`
    - `src/app/api/production/orders/[id]/release/route.ts`
    - `src/app/api/production/orders/[id]/issue/route.ts`
    - `src/app/api/production/orders/[id]/receipt/route.ts`
    - `src/app/api/production/orders/[id]/close/route.ts`
    - `src/app/api/production/orders/products/route.ts`
    - `src/app/api/production/meta/route.ts`
  - Server helper:
    - `src/lib/production-orders-server.ts`
  - Database:
    - `migrations/035_production_order_workflow_foundation.sql`
    - `migrations/036_production_issue_and_receipt_documents.sql`
    - `migrations/037_production_order_planning_release_rpcs.sql`
    - `migrations/038_production_order_transaction_rpcs.sql`
    - `migrations/039_production_relationship_map_and_reporting.sql`
- Legacy production-batch workflow still present and still exposed:
  - UI:
    - `src/app/(dashboard)/production/dashboard/page.tsx`
    - `src/app/(dashboard)/production/batches/page.tsx`
    - `src/components/production/production-dashboard.tsx`
    - `src/components/production/production-nav.tsx`
  - API:
    - `src/app/api/production/dashboard/route.ts`
    - `src/app/api/production/batches/**`
- Service-role access:
  - `src/lib/production-server.ts:3-4` creates `createServiceRoleClient().schema('icecream_erp')`.

## 3. Complete file inventory

### Frontend

- `src/app/(dashboard)/production/page.tsx`
- `src/app/(dashboard)/production/dashboard/page.tsx`
- `src/app/(dashboard)/production/orders/page.tsx`
- `src/app/(dashboard)/production/orders/[id]/page.tsx`
- `src/app/(dashboard)/production/batches/page.tsx`
- `src/components/production/production-nav.tsx`
- `src/components/production/production-dashboard.tsx`

### Production API and services

- `src/app/api/production/orders/route.ts`
- `src/app/api/production/orders/[id]/route.ts`
- `src/app/api/production/orders/[id]/release/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/close/route.ts`
- `src/app/api/production/orders/products/route.ts`
- `src/app/api/production/meta/route.ts`
- `src/app/api/production/dashboard/route.ts`
- `src/app/api/production/batches/route.ts`
- `src/app/api/production/batches/[id]/output/route.ts`
- `src/app/api/production/batches/[id]/transfer-finished-goods/route.ts`
- `src/lib/production-orders-server.ts`
- `src/lib/production-server.ts`
- `src/lib/production.ts`

### Hooks and types

- `src/hooks/production/useProductionOrders.ts`
- `src/hooks/production/useProductionMeta.ts`
- `src/hooks/production/useProductionRequest.ts`
- `src/hooks/production/useBatches.ts`
- `src/hooks/production/useProduction.ts`
- `src/hooks/production/useBatchAction.ts`

### Migrations in requested scope

- `migrations/034_atomic_inventory_approval_processing.sql`
- `migrations/035_production_order_workflow_foundation.sql`
- `migrations/036_production_issue_and_receipt_documents.sql`
- `migrations/037_production_order_planning_release_rpcs.sql`
- `migrations/038_production_order_transaction_rpcs.sql`
- `migrations/039_production_relationship_map_and_reporting.sql`

### Tests and scripts

- `tests/production-helpers.test.ts`
- `scripts/smoke-production-receive.mjs`
- `scripts/verify-production-workflow.mjs`
- `package.json`

## 4. Requirement-by-requirement implementation matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Product Number is the primary production identifier | Fully implemented | Orders list/search and detail use `product_number`; UI labels product selection as `Product Number` in `src/app/(dashboard)/production/orders/page.tsx:149`. |
| 2 | Dedicated Planned Quantity entry page must exist | Partially implemented | Planned quantity entry exists, but only inside a `FormDrawer`, not a dedicated page: `src/app/(dashboard)/production/orders/page.tsx:144-171`. |
| 3 | Selecting a product must load the latest active BOM | Partially implemented | Product picker loads `activeBom` from `src/app/api/production/orders/products/route.ts:37-58`; save RPC selects latest active recipe by `version desc, updated_at desc` in `migrations/037_production_order_planning_release_rpcs.sql:215`, but the product route orders by `version` only at `src/app/api/production/orders/products/route.ts:43`. |
| 4 | Raw-material requirements must be calculated from planned quantity | Fully implemented | Components are rebuilt from planned/released quantity in `production_rebuild_order_components` and saved through `save_planned_production_order` / `release_production_order`; detail page shows calculated components. |
| 5 | Production statuses must support Planned, Released, and Closed | Fully implemented | Status values and transitions exist in migrations `035`, `037`, and `038`; UI branches on `PLANNED`, `RELEASED`, `CLOSED` in `src/app/(dashboard)/production/orders/[id]/page.tsx:51-53`. |
| 6 | Closed orders must be read-only | Fully implemented | UI locks closed orders at `src/app/(dashboard)/production/orders/[id]/page.tsx:224-226`; RPC update path blocks non-`PLANNED` edits in `migrations/037_production_order_planning_release_rpcs.sql:254-255`. |
| 7 | Released Quantity must support manual entry where required | Fully implemented | Release route requires `releasedQuantity` and UI submits it manually: `src/app/api/production/orders/[id]/release/route.ts:17-24`, `src/app/(dashboard)/production/orders/[id]/page.tsx:80-82`. |
| 8 | Issue for Production must deduct raw-material inventory | Fully implemented | `post_production_issue` updates `stock_balances` and inserts `stock_movements` in `migrations/038_production_order_transaction_rpcs.sql:117-181`. |
| 9 | Receipt from Production must add finished-goods inventory | Fully implemented | `post_production_receipt` updates/inserts finished-goods stock and average cost in `migrations/038_production_order_transaction_rpcs.sql:292-315`. |
| 10 | A Relationship Map must link Production Order, Issue, and Receipt | Partially implemented | Relationship map exists and is rendered, but the SQL view uses `production_order_id` unions rather than `production_document_links`: `migrations/039_production_relationship_map_and_reporting.sql:5-52`. |
| 11 | The system must prevent duplicate posting | Fully implemented | Idempotency keys and unique indexes exist in `migrations/036_production_issue_and_receipt_documents.sql:127-132`; RPCs return conflict on duplicate idempotency and also cap cumulative issue/receipt quantities in `migrations/038_production_order_transaction_rpcs.sql:41`, `97`, `237`, `257`. |
| 12 | Posting must be transactional and auditable | Fully implemented | Posting logic is in `SECURITY DEFINER` PL/pgSQL RPCs with inventory updates, document inserts, and `audit_logs` writes in `migrations/037` and `038`. |
| 13 | Reversal functions must restore inventory safely | Backend only | `reverse_production_issue` and `reverse_production_receipt` restore stock safely in `migrations/038_production_order_transaction_rpcs.sql:446-628`, but there are no production-order API routes or UI controls exposing them. |
| 14 | Frontend, API routes, RPC payloads, database columns, TypeScript types, and tests must all agree | Implemented but broken | The repo contains mismatches across UI, API, SQL views, and tests; details are listed below. |

## 5. Frontend findings

- `/production` correctly redirects to `/production/orders`.
- Orders list page creates planned orders through the real API and shows the product as `Product Number`.
- Planned order entry is a drawer, not a dedicated page.
- Product selection shows an active BOM code/version from live metadata.
- Detail page is real, not mocked. It shows tabs for Summary, Components, Issue for Production, Receipt from Production, Costing, Relationship Map, and Audit History.
- Detail actions call the real order APIs and invalidate both `['production']` and `['production', 'order', id]`.
- Closed-order UI is read-only.
- There is no planned-order edit UI even though `PUT /api/production/orders/[id]` exists.
- There are no reversal buttons or reopen controls in the order detail UI.
- The detail page states that corrections require reversal or reopening (`src/app/(dashboard)/production/orders/[id]/page.tsx:226`), but no such UI/API workflow exists.
- The receipt form does not collect `receiptDate`, although the API route and server helper accept it.
- The Relationship Map tab has a display encoding defect at `src/app/(dashboard)/production/orders/[id]/page.tsx:335` (`Â·`).
- The production dashboard and navigation still guide users into the legacy batch flow instead of the production-order workflow.

## 6. API findings

- Production-order write APIs are server-side and use authenticated routes plus service-role RPC calls. No direct browser-to-database writes were found in the inspected order workflow.
- `GET /api/production/orders` is branch-scoped correctly at `src/app/api/production/orders/route.ts:36`.
- `GET /api/production/orders/[id]` loads the order first, then blocks branch mismatch at `src/app/api/production/orders/[id]/route.ts:35`.
- `POST /api/production/orders` and `PUT /api/production/orders/[id]` accept a client `branchId` and pass `body.branchId ?? ctx.branchId` into the RPC (`src/app/api/production/orders/route.ts:53-79`, `src/app/api/production/orders/[id]/route.ts:75-103`). For branch-scoped users, this is not server-enforced branch isolation.
- `POST /api/production/orders/[id]/release`, `issue`, `receipt`, and `close` do not load the order or branch-check it before calling service-role RPCs (`src/app/api/production/orders/[id]/release/route.ts:15-25`, `issue/route.ts:15-33`, `receipt/route.ts:15-46`, `close/route.ts:14-17`).
- There are no API routes for:
  - reversing production issues
  - reversing production receipts
  - reopening closed production orders
- `src/app/api/production/orders/products/route.ts` and `save_planned_production_order` do not use identical BOM-selection ordering logic.
- `src/app/api/production/dashboard/route.ts` is still batch-based and does not report the production-order workflow.

## 7. Database and RPC findings

- Migration `035` creates the core order tables and status history.
- Migration `036` creates issue/receipt headers and lines, document links, posting statuses, and idempotency indexes.
- Migration `037` defines:
  - `save_planned_production_order`
  - `release_production_order`
- Migration `038` defines:
  - `post_production_issue`
  - `post_production_receipt`
  - `close_production_order`
  - `reverse_production_issue`
  - `reverse_production_receipt`
- Migration `039` defines:
  - `production_order_relationship_map`
  - `production_order_cost_summary`
  - production permissions including reverse/reopen permissions
- The seven required RPCs exist in SQL.
- The frontend/backend code references only five forward RPCs through `src/lib/production-orders-server.ts:24-140`; reversal RPCs are not wrapped there.
- `post_production_issue` and `post_production_receipt` are transactional, audit logged, and idempotent.
- Average-cost handling is present in the receipt RPC: `migrations/038_production_order_transaction_rpcs.sql:292-299`.
- Reversal RPCs refuse direct reversal on closed orders:
  - issue reversal: `migrations/038_production_order_transaction_rpcs.sql:473-477`
  - receipt reversal: `migrations/038_production_order_transaction_rpcs.sql:570-574`
- The relationship-map view does not read `production_document_links`, even though issue/receipt RPCs populate that table at `migrations/038_production_order_transaction_rpcs.sql:181-185` and `356-360`.

## 8. Inventory integration findings

- Raw-material issue deducts inventory from `stock_balances` and writes `stock_movements`.
- Finished-goods receipt increases inventory, updates `avg_cost`, and writes `stock_movements`.
- Over-issue is blocked at the component level by `v_component.issued_quantity + v_quantity > v_component.released_quantity` in `migrations/038_production_order_transaction_rpcs.sql:97`.
- Over-receipt is blocked by `completed + rejected > released_quantity` in `migrations/038_production_order_transaction_rpcs.sql:257`.
- Reversal RPCs restore stock balances and write reversal stock movements.
- The legacy batch flow also performs production inventory actions, but it is a separate subsystem and does not use the production-order RPCs.

## 9. Finance and costing findings

- Planned cost is calculated from rebuilt component rows.
- Posted material cost and actual cost are surfaced through `production_order_cost_summary`.
- Receipt posting updates finished-goods `avg_cost` and `total_value`.
- Cost per unit is recalculated on receipt and close.
- No defect was found in average-cost handling inside the receipt RPC itself.
- The main costing risk is architectural: the dashboard and batch flow are not aligned to the order-based costing workflow.

## 10. Security findings

- Positive findings:
  - Production-order writes are routed through authenticated API handlers, not direct browser writes.
  - Order list and order detail reads enforce branch scope.
  - SQL RPCs use organization IDs and locking.
- Confirmed risks:
  - Branch-scoped order creation/update is not server-enforced because `branchId` is accepted from the client and forwarded to the RPC (`src/app/api/production/orders/route.ts:53-79`, `src/app/api/production/orders/[id]/route.ts:75-103`).
  - Release/issue/receipt/close routes do not branch-check the target order before calling service-role RPCs (`release/route.ts:15-25`, `issue/route.ts:15-33`, `receipt/route.ts:15-46`, `close/route.ts:14-17`).
  - Reverse/reopen permissions are seeded in SQL, but no corresponding app-layer routes or UI exist, so those permissions are operationally dead in the repository state.

## 11. Test coverage findings

- `tests/production-helpers.test.ts` verifies:
  - migration files contain forward RPC names
  - helper library contains forward RPC call strings
  - helper math and smoke helper utilities
- It does not test:
  - the real API routes under `src/app/api/production/orders/**`
  - `src/lib/production-orders-server.ts` runtime behavior
  - reversal RPC exposure
  - branch-scope enforcement
  - failure paths
  - duplicate-post conflict responses
  - closed-order edit attempts
  - relationship-map correctness
  - receipt payload fields such as `receiptDate`
- `package.json:16` shows `test:production` compiles to `.tmp-tests`, so I did not execute it during this no-file-modification audit.

## 12. Exact defects with file paths and line numbers

1. Legacy dashboard API is still based on `production_batches`, not `production_orders`.
   - `src/app/api/production/dashboard/route.ts:66`
   - `src/app/api/production/dashboard/route.ts:93`
   - `src/app/api/production/dashboard/route.ts:111`
   - `src/app/api/production/dashboard/route.ts:135`

2. Production navigation routes `Issues` and `Release` into the legacy batch screens.
   - `src/components/production/production-nav.tsx:20`
   - `src/components/production/production-nav.tsx:21`

3. Production dashboard shortcut cards also route issue/release into the legacy batch screens.
   - `src/components/production/production-dashboard.tsx:51`
   - `src/components/production/production-dashboard.tsx:57`

4. The legacy batch page still presents and executes a separate issue/release production flow outside the production-order workflow.
   - `src/app/(dashboard)/production/batches/page.tsx:264-295`
   - `src/app/api/production/batches/[id]/output/route.ts:32-64`
   - `src/app/api/production/batches/[id]/transfer-finished-goods/route.ts:34-83`

5. The relationship-map view ignores `production_document_links` and reconstructs relationships only from `production_order_id`.
   - `migrations/039_production_relationship_map_and_reporting.sql:5-52`
   - Compare with link writes at `migrations/038_production_order_transaction_rpcs.sql:181-185` and `356-360`

6. Reversal and reopen capabilities exist in SQL permissions/RPCs but are not exposed by the production-order app layer.
   - SQL permissions: `migrations/039_production_relationship_map_and_reporting.sql:91`, `:94`, `:96`
   - SQL RPCs: `migrations/038_production_order_transaction_rpcs.sql:446`, `:543`
   - Server wrapper stops at forward actions: `src/lib/production-orders-server.ts:24-140`
   - API route inventory under `src/app/api/production/orders/[id]`: only `close`, `issue`, `receipt`, `release`, `route.ts`

7. The UI claims reversals or reopening are available for corrections, but no such workflow exists in the repository.
   - `src/app/(dashboard)/production/orders/[id]/page.tsx:224-226`

8. Branch-scoped create/update is not server-enforced; client `branchId` is forwarded into service-role order writes.
   - `src/app/api/production/orders/route.ts:53-79`
   - `src/app/api/production/orders/[id]/route.ts:75-103`

9. Release/issue/receipt/close write routes do not branch-check the target order before calling service-role RPCs.
   - `src/app/api/production/orders/[id]/release/route.ts:15-25`
   - `src/app/api/production/orders/[id]/issue/route.ts:15-33`
   - `src/app/api/production/orders/[id]/receipt/route.ts:15-46`
   - `src/app/api/production/orders/[id]/close/route.ts:14-17`

10. BOM-selection logic is inconsistent between the product picker API and the order-save RPC.
   - Product route orders only by version: `src/app/api/production/orders/products/route.ts:37-43`
   - Save RPC orders by version and `updated_at`: `migrations/037_production_order_planning_release_rpcs.sql:215`

11. The receipt API accepts `receiptDate`, but the detail UI never collects or sends it.
   - API route: `src/app/api/production/orders/[id]/receipt/route.ts:17-45`
   - UI form fields: `src/app/(dashboard)/production/orders/[id]/page.tsx:287-292`
   - UI submit payload: `src/app/(dashboard)/production/orders/[id]/page.tsx:104-109`

12. Relationship Map text rendering contains mojibake.
   - `src/app/(dashboard)/production/orders/[id]/page.tsx:335`

13. Production tests only cover forward-RPC strings and helper math; they do not cover reverse routes or failure conditions.
   - `tests/production-helpers.test.ts:44-70`
   - `package.json:16`

## 13. Missing functionality

- Dedicated Planned Quantity entry page
- Production-order reversal API routes
- Production-order reversal UI controls
- Closed-order reopen API route
- Closed-order reopen UI control
- Planned-order edit UI
- End-to-end tests for the real production-order transaction workflow
- Failure-path tests for duplicate posting, branch scope, reversal rejection, and closed-order edits

## 14. Root-cause analysis

The current Production module is a hybrid of two different implementations:

- A newer order-centric workflow introduced in migrations `035` through `039`
- An older batch-centric workflow still driving dashboard, shortcuts, and operational screens

That split causes most of the observed defects:

- users are still steered into the wrong workflow
- relationship mapping was added at the SQL layer but not wired to the document-link source of truth
- reversal and reopen permissions/RPCs were added in SQL but not carried through server wrappers, APIs, UI, or tests
- security enforcement is strong on read routes but incomplete on write routes
- tests remained focused on helper utilities instead of the live order transaction path

## 15. Recommended implementation order

1. Fix branch-scope enforcement on all production-order write routes.
2. Expose reversal and reopen flows through server wrappers, API routes, permissions checks, and UI.
3. Replace legacy dashboard/nav batch entry points with production-order entry points.
4. Make the relationship-map view read from `production_document_links`.
5. Align BOM-selection logic between product-pick API and save RPC.
6. Add a dedicated planned-order entry/edit experience.
7. Align receipt/issue UI payloads with the full API/RPC contract.
8. Add end-to-end and failure-path coverage for the real order workflow.

## 16. Risks and regression areas

- Inventory accuracy during release/issue/receipt/reversal transitions
- Cross-branch posting if write-route branch scope is not fixed
- User confusion from having both batch and order production flows active
- Reporting inconsistency between dashboard/batch data and order-based transactions
- Relationship/audit traceability if links and views continue to diverge
- Test blind spots around reversals and permission failures

## 17. Commands executed and their results

1. `git status --short`
   - Result: clean working tree before report creation.

2. `rg --files ...` and targeted `rg -n ...`
   - Result: identified production frontend, API, hooks, services, migrations, tests, and all references to the seven production RPCs.

3. Targeted `Get-Content -LiteralPath ...`
   - Result: inspected exact implementation lines for production pages, routes, helpers, migrations, and tests.

4. `Get-ChildItem -LiteralPath 'src/app/api/production/orders/[id]' -Name`
   - Result: only `close`, `issue`, `receipt`, `release`, and `route.ts` exist; no reverse/reopen route directories.

5. `npm run lint`
   - Result: completed successfully. Two warnings were reported outside Production:
     - `src/app/(dashboard)/maintenance/machines/page.tsx`
     - `src/app/(dashboard)/sales/customers/page.tsx`

6. `npm run typecheck`
   - Result: failed with repo-wide TypeScript errors outside Production, primarily in Finance, Procurement, Sales, Suppliers, Users, Health, and shared server code. No Production-file matches were returned by a follow-up filtered search.

7. `npm run typecheck 2>&1 | rg "src/(app/api/production|app/\\(dashboard\\)/production|components/production|hooks/production|lib/production)"`
   - Result: no Production TypeScript errors were emitted in the filtered output.

Commands intentionally not executed:

- `npm run test:production`
  - Not run because `package.json:16` compiles to `.tmp-tests`, which would create files during a no-file-modification audit.
- `npm run build`
  - Not run because it would create build artifacts, which would violate the audit constraint.

## Final counts

- Fully implemented requirements: 9
- Partially implemented requirements: 5
- Missing requirements: 0
- Confirmed defects: 13
- Production module ready for end-to-end testing: NO
