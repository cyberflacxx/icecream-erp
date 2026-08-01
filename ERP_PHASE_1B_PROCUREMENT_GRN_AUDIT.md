# ERP Phase 1B Procurement GRN Audit

## Executive Summary

The Procurement approval to Goods Received Note workflow is not ready for end-to-end testing.

Confirmed repository-level blockers:

1. Requisition approval is not a true gate for purchase-order conversion. Both `SUBMITTED` and `PENDING_APPROVAL` are treated as approved.
2. Approved purchase orders can be absent from the GRN dropdown because the GRN meta API filters on raw `purchase_orders.status` only, while other procurement surfaces derive approval state from timestamps and `approval_status`.
3. GRN submit/approve/post is internally inconsistent. `/receive` leaves `status='DRAFT'`, `/approve` both approves and posts inventory, and `/post` can post without first checking approved quality state.
4. Procurement requisition and purchase-order routes do not use the shared Phase 1A branch-authorization helper and do not enforce branch-scoped document access.
5. GRN posting updates stock balances, stock movements, and PO received quantities, but does not update finance journals and does not update item-master cost fields.

## Exact Files Inspected

- `package.json`
- `migrations/024_procurement_workflow_hq_receipts.sql`
- `migrations/031_procurement_approver_header_fields.sql`
- `migrations/032_procurement_launch_workflow_compatibility.sql`
- `migrations/033_final_procurement_stock_and_po_template_compatibility.sql`
- `migrations/manual/icecream_erp_live_schema_20260712.sql`
- `src/lib/branch-access.ts`
- `src/lib/item-selector.ts`
- `src/lib/procurement.ts`
- `src/lib/procurement-workflow.ts`
- `src/lib/procurement-requisitions.ts`
- `src/lib/procurement-purchase-orders.ts`
- `src/lib/procurement-goods-received.ts`
- `src/hooks/useAuthorizedBranches.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/components/shared/item-selector-field.tsx`
- `src/hooks/procurement/index.ts`
- `src/hooks/procurement/types.ts`
- `src/hooks/procurement/useGRNs.ts`
- `src/hooks/procurement/useGoodsReceivingStatus.ts`
- `src/hooks/procurement/useProcurementMeta.ts`
- `src/hooks/procurement/usePurchaseOrders.ts`
- `src/hooks/procurement/useRequisitions.ts`
- `src/hooks/procurement/useProcurementRequest.ts`
- `src/app/api/procurement/requisitions/route.ts`
- `src/app/api/procurement/requisitions/[id]/route.ts`
- `src/app/api/procurement/requisitions/[id]/submit/route.ts`
- `src/app/api/procurement/requisitions/[id]/approve/route.ts`
- `src/app/api/procurement/requisitions/[id]/reject/route.ts`
- `src/app/api/procurement/purchase-orders/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/approve/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/reject/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/send/route.ts`
- `src/app/api/procurement/grns/route.ts`
- `src/app/api/procurement/grns/[id]/route.ts`
- `src/app/api/procurement/grns/[id]/receive/route.ts`
- `src/app/api/procurement/grns/[id]/approve/route.ts`
- `src/app/api/procurement/grns/[id]/reject/route.ts`
- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/app/api/procurement/meta/route.ts`
- `src/app/api/procurement/goods-receiving-status/route.ts`
- `src/app/(dashboard)/procurement/requisitions/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/[id]/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `tests/procurement-helpers.test.ts`
- `tests/branch-helpers.test.ts`
- `tests/inventory-helpers.test.ts`
- `tests/finance-helpers.test.ts`

## Current Requisition Statuses

Observed in helpers and routes:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `PO_CREATED`
- `REJECTED`
- `CANCELLED` is recognized by workflow helpers, but no requisition cancel route was found

Actual route writes:

- create: `status='draft'`, `approval_status='draft'`
- submit: `status='submitted'`, `approval_status='submitted'`
- approve: `status='approved'`, `approval_status='approved'`
- reject: `status='rejected'`, `approval_status='rejected'`
- requisition consumed by active POs: `status='PO_CREATED'` only

## Current Purchase-Order Statuses

Observed in helpers and routes:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `SENT_TO_SUPPLIER`
- `PARTIAL_RECEIVED`
- `FULLY_RECEIVED`
- `REJECTED`
- `CANCELLED`

Actual route writes:

- create: `status='DRAFT'`
- approve: `approval_status='APPROVED'`, `status='APPROVED'` when the existing case is uppercase
- reject: `status='CANCELLED'`
- send: `status='SENT_TO_SUPPLIER'`
- GRN posting helper: `status='PARTIAL_RECEIVED'`, `FULLY_RECEIVED`, or falls back to `APPROVED`

No PO submit route was found. No dedicated PO cancel route was found.

## Current GRN Statuses

Observed in helpers and routes:

- header `status`: `DRAFT`, `REJECTED`, `POSTED`, `RECEIVED`
- header `quality_status`: `PENDING`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`

Actual route writes:

- create: `status='DRAFT'`, `quality_status='PENDING'`
- receive/submit: `quality_status='PENDING_APPROVAL'` but leaves `status='DRAFT'`
- approve: `quality_status='APPROVED'`, then immediately posts inventory
- reject: `status='REJECTED'`, `quality_status='REJECTED'`
- post helper final state: prefers `POSTED`, but can fall back to other posted-compatible enum values such as `RECEIVED`

No GRN cancel route was found. No GRN reverse route was found.

## Current End-to-End Workflow

1. Requisition draft is created.
2. Requisition submit writes `submitted`.
3. Requisition approve writes `approved`.
4. PO can be created either directly or from the requisition picker.
5. PO approve writes approval fields and `status='APPROVED'`.
6. PO send writes `status='SENT_TO_SUPPLIER'`.
7. GRN page creates a draft GRN with `POST /api/procurement/grns`.
8. The same page immediately submits received quantities with `POST /api/procurement/grns/[id]/receive`.
9. `/receive` sets `quality_status='PENDING_APPROVAL'` but does not advance `status` out of `DRAFT`.
10. `/approve` updates approval fields and then posts stock in the same request.
11. `/post` separately exists and can also post stock directly.

## Root Causes of Approval Failure

### 1. Approval is not modeled as a hard business gate

`src/lib/procurement-purchase-orders.ts:3-11` and `:38-42` treat `PENDING_APPROVAL` and `SUBMITTED` requisitions as approved equivalents.

`src/app/api/procurement/requisitions/route.ts:31-35` applies the same loose filter to the requisition picker.

Impact: requisitions can move into PO conversion before true approval.

### 2. GRN approval is coupled to stock posting

`src/app/api/procurement/grns/[id]/approve/route.ts:66-87` updates GRN approval fields and then calls `postGoodsReceivedNoteToInventory(...)`.

Impact: a posting failure can return an error after the GRN is already marked `quality_status='APPROVED'`.

### 3. GRN submit and approve state are split across `status` and `quality_status`

`src/app/api/procurement/grns/[id]/receive/route.ts:171-178` moves only `quality_status` to `PENDING_APPROVAL`.

Impact: GRNs remain `status='DRAFT'` while the approval queue depends on `quality_status`, which makes downstream state handling inconsistent.

## Root Causes of Approved POs Not Appearing in GRN

### 1. GRN meta API filters only raw `purchase_orders.status`

`src/app/api/procurement/meta/route.ts:200-204` selects only `id, po_number, status, supplier_id`.

`src/app/api/procurement/meta/route.ts:35-37` and `:289-290` expose receivable POs only when raw `status` maps to `APPROVED`, `SENT_TO_SUPPLIER`, or `PARTIAL_RECEIVED`.

Impact: a PO with `approved_at` or `approval_status='APPROVED'` but stale raw `status='DRAFT'` will not appear in the GRN dropdown.

### 2. Other procurement surfaces derive PO state differently

`src/lib/procurement-workflow.ts:171-203` and `src/lib/procurement-purchase-orders.ts:45-79` derive approval state from timestamps and compatibility fields.

Impact: a PO can look approved on the PO UI and still be excluded from GRN meta lookup.

### 3. GRN-eligible PO rules are inconsistent across APIs

`src/app/api/procurement/purchase-orders/route.ts:150-179` allows `DRAFT`, `CREATED`, `OPEN`, and `SUBMITTED` in the GRN picker.

`src/app/api/procurement/grns/route.ts:328-331` claims GRNs are only for sent or partially received POs, but depends on `isPurchaseOrderSentLike(...)`.

`src/lib/procurement-purchase-orders.ts:92-105` defines `isPurchaseOrderSentLike(...)` to also accept `DRAFT`, `OPEN`, and `SUBMITTED`.

Impact: different procurement endpoints disagree on which POs are receivable.

## Broken Status Transitions

1. Requisition -> PO gate is broken because `SUBMITTED` and `PENDING_APPROVAL` are accepted as approved.
2. PO workflow has no explicit submit transition. Draft orders can be approved directly.
3. GRN submit does not advance header `status` out of `DRAFT`.
4. GRN approve is not a pure approval transition. It immediately posts stock.
5. GRN post is not gated by approved quality state.
6. PO reject writes `status='CANCELLED'` but does not update `approval_status`.
7. Requisition cancel, PO cancel, GRN cancel, and GRN reverse routes are missing.

## Authorization Gaps

1. No procurement route inspected uses `src/lib/branch-access.ts`. Repository search returned matches only inside the helper itself.
2. Requisition routes are organization-scoped only and do not enforce branch-scoped access:
   - `src/app/api/procurement/requisitions/route.ts:57-72`
   - `src/app/api/procurement/requisitions/[id]/route.ts`
   - `src/app/api/procurement/requisitions/[id]/approve/route.ts:27-33`
3. Purchase-order routes are organization-scoped only and do not enforce branch-scoped access:
   - `src/app/api/procurement/purchase-orders/route.ts:151-157`
   - `src/app/api/procurement/purchase-orders/route.ts:183-201`
   - `src/app/api/procurement/purchase-orders/[id]/approve/route.ts:32-38`
4. GRN approve and receive do branch-check the warehouse, but `src/app/api/procurement/grns/[id]/reject/route.ts` and `src/app/api/procurement/grns/[id]/post/route.ts` do not.
5. `src/app/api/procurement/goods-receiving-status/route.ts:15-18` reads `purchase_order_items` with no organization filter and no branch filter.

## Inventory Integration Gaps

Confirmed implemented:

- stock-balance insert/update: `src/lib/procurement-goods-received.ts:737-917`
- weighted average stock-balance cost update: `src/lib/procurement-goods-received.ts:951-959`
- stock movement creation with duplicate guard: `src/lib/procurement-goods-received.ts:1060-1237`
- GRN posted-state update: `src/lib/procurement-goods-received.ts:1247-1285`
- PO line received-quantity update: `src/lib/procurement-goods-received.ts:1602-1617`
- PO header partial/full receipt status update: `src/lib/procurement-goods-received.ts:1624-1633`

Confirmed gaps:

- posting is multi-step and not wrapped in a database transaction
- no GRN reversal path restores stock balances, stock movements, or PO received quantities
- no item-master cost field update was found after receipt posting

## Costing Gaps

Implemented:

- weighted-average inventory cost is maintained on `stock_balances`

Missing:

- no landed-cost allocation logic was found
- no item-master `cost_price`, `unit_cost`, or `standard_cost` update was found after GRN posting
- no route-level test proves the costing update path is triggered from actual GRN approve/post routes

## Finance Integration Gaps

No GRN finance posting was found in inspected procurement GRN routes or in `postGoodsReceivedNoteToInventory(...)`.

Evidence:

- `src/lib/procurement-goods-received.ts` updates inventory and PO state only
- repository search found no GRN path writing `journal_entries`, `journal_entry_lines`, or using finance-posting helpers

Impact: posted GRNs do not currently create confirmed finance journals from the inspected code.

## Missing Validations

1. Requisition eligibility for PO conversion is too broad.
2. GRN-eligible PO status validation is too broad.
3. PO branch validation is missing.
4. PO warehouse existence and scope validation is missing.
5. GRN post approved-state validation is missing.
6. GRN receive does not enforce all quantity sanity rules server-side. For example, no direct guard was found for `quantityRejected <= quantityReceived`.
7. Unauthorized branch access on requisition and PO routes is not blocked via the Phase 1A helper.

## Missing Tests

1. No route-level procurement tests were found for branch-scoped requisition or PO access.
2. No route-level tests were found for approved-PO visibility in the GRN dropdown.
3. No route-level tests were found for GRN receive -> approve -> post state transitions.
4. No test was found for partial failure after GRN approval fields are written but inventory posting fails.
5. No test was found for GRN finance posting because no finance-posting path exists.
6. `tests/procurement-helpers.test.ts:320-325` currently codifies the wrong business rule by asserting that `submitted` and `pending_approval` count as approved requisitions.

## Database Assumptions

Observed compatibility assumptions in code:

- requisitions use both `requisition_number` and `pr_number`
- requisition lines use both `requisition_id` and `pr_id`
- purchase orders use both `purchase_order_id` and `po_id`
- GRNs use both `purchase_order_id` and `po_id`
- GRN lines use both `goods_received_note_items` and legacy `grn_items`
- PO and GRN lines use both modern `quantity_received` and legacy `received_qty`

Observed schema facts from `migrations/manual/icecream_erp_live_schema_20260712.sql`:

- `purchase_requisitions.status` and `approval_status` are `text`
- `purchase_orders.status` is enum `icecream_erp.po_status`
- `goods_received_notes.status` is enum `icecream_erp.grn_status`
- `purchase_requisitions` has no `branch_id`
- `purchase_orders` has no `branch_id`
- `goods_received_notes` is branch-related only indirectly through `warehouse_id`

## Whether a Migration Is Required

Yes, most likely.

Fact-based basis:

1. The live schema snapshot shows no `branch_id` on `purchase_requisitions` or `purchase_orders`.
2. The required branch-manager restriction across requisition -> PO -> GRN cannot be enforced cleanly at document level without branch ownership on requisitions and purchase orders.
3. No schema linkage for GRN-origin finance journals was found in the inspected procurement migrations or code paths.

If the target implementation only repairs status logic and reuses warehouse-based branch restriction for GRNs, those fixes are code-only. The branch-safe requisition/PO workflow requirement points to additional schema work.

## Recommended Implementation Batches

### Batch 1: Status and workflow contract repair

- remove `SUBMITTED` and `PENDING_APPROVAL` from approved-requisition eligibility
- align requisition picker, PO creation validation, and workflow helpers
- align GRN-eligible PO rules across `meta`, PO picker, GRN create route, and UI copy
- fix GRN submit so it advances a consistent workflow state

### Batch 2: Branch-safe procurement authorization

- apply `src/lib/branch-access.ts` across requisition, PO, and procurement meta routes
- enforce branch-scoped access on list, detail, create, approve, reject, and conversion paths
- validate warehouse ownership and branch scope on PO create/edit as well as GRN

### Batch 3: GRN transaction boundary repair

- separate GRN approval from posting, or move both into one transactional server-side function
- block `/grns/[id]/post` unless the GRN is already approved
- add reversal/cancel behavior that restores inventory and PO receipt balances

### Batch 4: Finance and costing integration

- create finance journals at GRN posting time
- link the GRN to finance source references
- update item-master cost fields if that is part of the costing contract

### Batch 5: Route-level tests

- branch authorization tests for requisitions, POs, and GRNs
- approved-PO visibility tests for the GRN dropdown
- partial receipt and over-receipt tests
- duplicate-posting and rollback tests
- finance-journal creation tests

## Exact Defects with File Paths and Line Numbers

1. Requisition approval gate is broken:
   - `src/lib/procurement-purchase-orders.ts:3-11`
   - `src/lib/procurement-purchase-orders.ts:38-42`
2. Requisition approved picker explicitly includes non-approved states:
   - `src/app/api/procurement/requisitions/route.ts:31-35`
3. GRN-eligible PO helper accepts draft/open/submitted:
   - `src/lib/procurement-purchase-orders.ts:92-105`
4. PO GRN picker also accepts draft/open/submitted:
   - `src/app/api/procurement/purchase-orders/route.ts:150-179`
5. GRN meta API can exclude approved-looking POs because it filters raw PO status only:
   - `src/app/api/procurement/meta/route.ts:35-37`
   - `src/app/api/procurement/meta/route.ts:200-204`
   - `src/app/api/procurement/meta/route.ts:289-290`
6. GRN receive leaves header `status='DRAFT'` while moving only `quality_status`:
   - `src/app/api/procurement/grns/[id]/receive/route.ts:171-178`
7. GRN approve combines approval and stock posting in one non-transactional route:
   - `src/app/api/procurement/grns/[id]/approve/route.ts:66-87`
8. GRN post route performs posting without an approved-state guard:
   - `src/app/api/procurement/grns/[id]/post/route.ts:26-31`
9. GRN reject route has no branch warehouse check:
   - `src/app/api/procurement/grns/[id]/reject/route.ts:18-45`
10. Goods receiving status route has no organization or branch filter on the initial PO-item query:
   - `src/app/api/procurement/goods-receiving-status/route.ts:15-18`
11. PO reject route does not update `approval_status`:
   - `src/app/api/procurement/purchase-orders/[id]/reject/route.ts:56-63`
12. Procurement tests currently lock in the wrong requisition approval rule:
   - `tests/procurement-helpers.test.ts:320-325`

## Commands Executed and Results

- `git status --short`
  - before editing the report: `?? ERP_PHASE_1B_PROCUREMENT_GRN_AUDIT.md`

- `rg --files ...` and targeted `rg -n ...` searches across:
  - `src/app/api/procurement`
  - `src/app/(dashboard)/procurement`
  - `src/lib`
  - `src/hooks/procurement`
  - `tests`
  - `migrations`
  - results:
    - confirmed no procurement usage of `src/lib/branch-access.ts`
    - confirmed no GRN finance-posting path
    - confirmed no requisition cancel, PO submit/cancel, or GRN cancel/reverse routes in the inspected workflow path

- `npm run test:procurement`
  - pass: 52/52
  - note: helper-focused coverage only

- `npm run test:branches`
  - pass: 9/9
  - note: validates the helper, not procurement route integration

- `npm run test:inventory`
  - pass: 28/28

- `npm run test:finance`
  - pass: 16/16

## Conclusion

Root causes:

- requisition approval eligibility is too broad
- approved-PO lookup for GRNs depends on raw PO status only
- GRN receive/approve/post transitions are inconsistent and non-transactional
- procurement routes do not use the shared branch-authorization helper
- GRN posting stops at inventory and PO updates, without finance posting

Proposed first implementation batch:

- repair the status contract first:
  - strict requisition approval gate
  - strict GRN-eligible PO gate
  - GRN submit/approve/post transition cleanup
  - consistent approved-PO lookup in procurement meta and GRN screens
