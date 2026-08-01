# ERP Phase 1B Batch 1 Status Contract Report

## Scope completed

Batch 1 implemented the requested procurement and GRN contract repairs only:

- requisition approval eligibility tightened
- GRN-eligible purchase-order logic centralized
- approved-PO receiving lookup aligned across helper, API, hook, and UI
- GRN submit, approve, and post guards repaired
- focused procurement and branch tests added

Not implemented in this batch:

- finance journals
- item-master cost updates
- GRN inventory redesign
- schema migrations
- `branch_id` columns

## Root causes fixed

1. Requisition conversion gate was too loose:
   - `SUBMITTED` and `PENDING_APPROVAL` were treated as PO-convertible.
   - fixed by making only `APPROVED` eligible in shared helpers and picker filters.

2. GRN-eligible PO logic was inconsistent:
   - different routes accepted `DRAFT`, `OPEN`, and `SUBMITTED`.
   - fixed by centralizing effective PO state derivation plus remaining-quantity validation.

3. Approved PO lookup for GRN was inconsistent:
   - raw `purchase_orders.status` could hide approved records with compatibility timestamps or `approval_status`.
   - fixed by deriving effective PO state from `status`, `approval_status`, `approved_at`, `approved_by`, `sent_at`, and `rejected_at`.

4. GRN workflow state was internally inconsistent:
   - submit left header status at `DRAFT`
   - approve also posted stock
   - post did not require approved quality state
   - fixed by separating approval from posting and enforcing explicit guards in each route.

5. PO rejection left approval compatibility fields inconsistent:
   - fixed by writing `approval_status='REJECTED'` and preferring `status='REJECTED'` with schema-compatible fallback to `CANCELLED` only when needed.

6. Warehouse authorization checks were duplicated and incomplete:
   - fixed by extending shared branch access helpers with warehouse-aware authorization and reusing them in GRN routes and PO warehouse validation.

## Files changed

- `src/lib/branch-access.ts`
- `src/lib/procurement-purchase-orders.ts`
- `src/lib/procurement-workflow.ts`
- `src/hooks/procurement/useProcurementMeta.ts`
- `src/app/api/procurement/requisitions/route.ts`
- `src/app/api/procurement/purchase-orders/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/approve/route.ts`
- `src/app/api/procurement/purchase-orders/[id]/reject/route.ts`
- `src/app/api/procurement/meta/route.ts`
- `src/app/api/procurement/goods-receiving-status/route.ts`
- `src/app/api/procurement/grns/route.ts`
- `src/app/api/procurement/grns/[id]/receive/route.ts`
- `src/app/api/procurement/grns/[id]/approve/route.ts`
- `src/app/api/procurement/grns/[id]/reject/route.ts`
- `src/app/api/procurement/grns/[id]/post/route.ts`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `tests/procurement-helpers.test.ts`
- `tests/branch-helpers.test.ts`

## Requisition eligibility contract

Eligible for PO conversion:

- `APPROVED`

Not eligible:

- `DRAFT`
- `SUBMITTED`
- `PENDING_APPROVAL`
- `REJECTED`
- `CANCELLED`
- `PO_CREATED`

API behavior:

- PO create now returns: `Only approved requisitions can be converted to purchase orders.`
- conversion with exhausted remaining approved quantity is blocked
- requisition picker now filters to approved records only

## Purchase-order eligibility contract for GRN

A PO is eligible for receiving only when its effective state is:

- `APPROVED`
- `SENT_TO_SUPPLIER`
- `PARTIAL_RECEIVED`

and it also:

- belongs to the authenticated organization
- has an active supplier reference
- is not rejected
- is not cancelled
- is not closed
- is not fully received
- has at least one line with remaining quantity

Effective state derivation now uses:

- `status`
- `approval_status`
- `approved_at`
- `approved_by`
- `sent_at`
- `rejected_at`

Remaining quantity contract:

- `remaining = ordered - previously posted received + reversed posted`
- current implementation uses posted PO line receipt quantities
- draft GRNs do not reduce remaining quantity
- PO receiving line payloads now expose:
  - item id
  - item code
  - item name
  - unit
  - ordered quantity
  - previously posted received quantity
  - remaining quantity
  - unit price
  - line total

## GRN status contract

Create:

- `status='DRAFT'`
- `quality_status='PENDING'`

Submit / receive:

- `status='RECEIVED'`
- `quality_status='PENDING_APPROVAL'`

Approve:

- `quality_status='APPROVED'`
- `approved_by` recorded
- `approved_at` recorded
- no stock posting is performed in the approve route anymore

Post:

- allowed only when `quality_status='APPROVED'`
- blocked when already posted
- blocked when rejected
- blocked when still draft
- blocked when still pending approval

Clear API messages implemented:

- `Goods Received Note must be submitted before approval.`
- `Goods Received Note must be approved before posting.`
- `Goods Received Note has already been posted.`
- `Rejected Goods Received Notes cannot be posted.`

Compatibility handling:

- posted GRNs still use the existing posted-state helper in `src/lib/procurement-goods-received.ts`
- when legacy enum compatibility forces `RECEIVED` instead of `POSTED`, workflow display now treats `stockPosted=true` as posted

## Rejection behavior

Purchase-order rejection now:

- requires a reason
- records `rejected_by`
- records `rejected_at`
- writes `approval_status='REJECTED'`
- prefers `status='REJECTED'`
- falls back to `status='CANCELLED'` only if the PO status enum rejects `REJECTED`

## Branch authorization behavior

Shared helper additions:

- warehouse assignment normalization
- warehouse visibility authorization
- authorized warehouse filtering

Applied in this batch:

- PO create validates any browser-supplied warehouse id against org and warehouse scope
- GRN create validates authorized warehouse access with the shared helper
- GRN receive validates authorized warehouse access with the shared helper
- GRN approve validates authorized warehouse access with the shared helper
- GRN reject validates authorized warehouse access with the shared helper
- GRN post validates authorized warehouse access with the shared helper

Known branch limitations still present:

- `purchase_requisitions` has no `branch_id`
- `purchase_orders` has no `branch_id`
- PO header routes do not have a reliable persisted warehouse relationship
- requisition picker and PO lookup can be organization-scoped only until document-level branch ownership exists in schema

## Compatibility fallbacks

- PO reject falls back from `REJECTED` to `CANCELLED` only when enum compatibility requires it
- GRN posted-state helper still falls back across `POSTED`, `RECEIVED`, and `COMPLETED`
- receiving line extraction tolerates modern and legacy PO line quantity aliases
- procurement meta now supports `purchaseOrderScope=receiving`; default meta callers keep broader PO visibility

## Tests added or updated

Updated:

- strict requisition approval test coverage
- PO effective approval derivation coverage
- PO receivability and remaining-quantity coverage
- GRN posted-state workflow coverage

Added:

- warehouse authorization helper tests
- static contract tests for procurement receiving routes and UI

## Validation results

- `npm run test:procurement`: PASS
- `npm run test:branches`: PASS
- `npm run test:inventory`: PASS
- `npm run lint`: PASS with existing warnings outside this batch
- `npm run build`: PASS
- `git diff --check`: PASS

Existing lint warnings not introduced by this batch:

- `src/app/(dashboard)/maintenance/machines/page.tsx`
- `src/app/(dashboard)/sales/customers/page.tsx`

## Known limitations

1. Requisition and purchase-order branch enforcement is still incomplete without persisted branch ownership on those documents.
2. GRN posting still does not create finance journals in this batch.
3. GRN posting still does not update item-master cost fields in this batch.
4. Remaining quantity currently depends on posted PO line receipt quantities; reversal support is not expanded in this batch beyond compatibility-safe calculation structure.
5. The repository build skips full type validation as part of `next build`; the focused test scripts still compile the touched helper surfaces.

## Migration requirement

Yes, still required for full Phase 1B completion.

Most likely follow-up schema work:

- add persisted branch ownership to purchase requisitions
- add persisted branch or warehouse ownership to purchase orders
- add document-level relationships needed for strict branch-safe lookup without inference

## Recommended Batch 2

1. Finish procurement branch safety at document level:
   - persist branch or warehouse ownership for requisitions and purchase orders
   - enforce branch-safe requisition picker and PO approval/rejection

2. Add route-level integration tests:
   - requisition-to-PO conversion failure paths
   - approved-PO receiving lookup
   - GRN submit/approve/post guard failures
   - unauthorized warehouse and organization access

3. Then move to finance and costing integration:
   - GRN journal posting
   - item-master cost update rules
