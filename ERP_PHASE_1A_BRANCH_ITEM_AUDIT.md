# ERP Phase 1A Branch and Item Audit

## Scope

Phase 1A audit covered branch and item selector behavior across:

- `src/app/api/branches/route.ts`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/procurement/requisitions/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/branches/[id]/sales/page.tsx`
- `src/components/production/production-order-planning-form.tsx`
- `src/app/(dashboard)/production/recipes/page.tsx`
- `src/components/sales/sales-line-items-editor.tsx`

## Root Causes

1. Branch selector behavior was fragmented.
   - Branch dropdowns depended on route-specific payloads instead of one server-side authorization path.
   - `src/app/api/branches/route.ts` did not consistently behave like a selector endpoint.

2. Item selector behavior was fragmented.
   - Sales, procurement, production, stores, and branch sales screens pulled item options from different meta payloads or ad hoc item queries.
   - Several pages depended on `meta.items` lists that were not warehouse-aware and could return empty or stale data for the user workflow.

3. Browser-supplied branch context was still too trusted in some flows.
   - `src/app/api/sales/orders/route.ts` needed explicit server-side resolution of the requested `branchId` against the authenticated user's allowed branches.

4. Empty-dropdown failures were amplified by missing selector UX states.
   - Several item inputs lacked a consistent loading state, empty-state message, and backend error display.

## Affected Routes

- `src/app/api/branches/route.ts`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/sales/orders/route.ts`

Audited but not changed in this batch because existing branch or warehouse enforcement was already present:

- `src/app/api/procurement/grns/route.ts`
- `src/app/api/procurement/purchase-orders/route.ts`
- `src/app/api/procurement/requisitions/route.ts`
- `src/app/api/inventory/adjustments/route.ts`
- `src/app/api/inventory/transfers/route.ts`
- `src/app/api/production/orders/route.ts`

## Affected Components and Pages

- `src/components/production/production-order-planning-form.tsx`
- `src/app/(dashboard)/production/recipes/page.tsx`
- `src/app/(dashboard)/procurement/requisitions/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/branches/[id]/sales/page.tsx`
- `src/components/sales/sales-line-items-editor.tsx`

## Security Risks Identified

1. Branch-restricted users could still depend on frontend branch selection unless the API revalidated branch access.
2. Inconsistent selector sources increased the chance of exposing unauthorized branch or warehouse data through broad meta endpoints.
3. Empty item dropdowns encouraged retry or manual payload tampering against APIs if the UI did not expose the proper server-scoped selector data.

## Database Assumptions Confirmed

1. Branch scope is enforced through `organization_id`, branch assignments, and warehouse-to-branch relationships.
2. Warehouse-scoped item balances come from stock balance rows keyed by `item_id` and `warehouse_id`.
3. Current cost may be absent; it must not be silently forced to zero in selector output.
4. Branch quantity and warehouse quantity can be computed from authorized warehouse rows without schema changes.

## Audit Conclusions

1. A reusable branch authorization helper was required and is now the correct shared control point for selector authorization.
2. A reusable selector-shaped branch endpoint was required to stop page-specific branch list behavior.
3. A reusable selector-shaped item endpoint was required to stop page-specific item list behavior.
4. The biggest functional failures were not database absence; they were inconsistent API contracts and inconsistent UI data sources.

## Missing or Residual Test Areas

1. Repo-wide `tsc --noEmit` still fails outside Phase 1A in pre-existing finance, procurement, sales, and shared server files.
2. Branch-restricted report routes outside the touched selector workflows were audited statically, not by end-to-end browser tests.
3. Selector UX is covered by static route/page assertions plus targeted helper tests, not Playwright-style interactive tests.

## Safe Commands Executed During Audit

- `git status --short`
- `rg --files src/app src/components src/hooks src/lib tests migrations package.json`
- targeted `rg -n` source inspection across production, procurement, sales, inventory, and branch APIs/pages
- `npm run typecheck` (observed pre-existing repo-wide failures outside Phase 1A scope)
- `npm run test:branches`
- `npm run test:inventory`
- `npm run test:procurement`
- `npm run test:sales`
- `npm run test:production`
- `npm run lint`
- `npm run build`
- `git diff --check`
