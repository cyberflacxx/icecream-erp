# Phase 2B Core Forms UI and BOM Report

## Root causes found

1. Shared item-selector requests were under-fetching and could return empty usable results.
   - `src/app/api/inventory/items/route.ts` only effectively handled a narrow selector window for multi-type requests, so BOM, PO, and related forms could miss valid items outside the first batch.
2. The shared selector UI failed poorly.
   - `src/components/shared/item-selector-field.tsx` used a datalist-style interaction with weak empty and error handling, no retry control, and an easy path to a disabled field that looked like endless loading.
3. BOM create flow lacked submission hardening.
   - `src/app/(dashboard)/production/recipes/page.tsx` did not guard duplicate line items, did not prevent duplicate submits, and did not reliably focus the saved BOM after creation.
4. BOM API validation was weaker than the frontend needed.
   - `src/app/api/production/recipes/route.ts` accepted duplicate raw-material or packaging rows until this pass.
5. Shared layout primitives were too tight.
   - Sidebar width, drawer width, table cell padding, and global input/card spacing were compressing labels and actions across multiple modules.

## Files changed

- `src/app/api/inventory/items/route.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/components/shared/item-selector-field.tsx`
- `src/app/(dashboard)/production/recipes/page.tsx`
- `src/app/api/production/recipes/route.ts`
- `src/components/production/production-order-planning-form.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `src/app/(dashboard)/procurement/requisitions/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/branches/[id]/sales/page.tsx`
- `src/components/sales/sales-line-items-editor.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/sidebar.tsx`
- `src/components/ui-library/form-drawer.tsx`
- `src/components/ui-library/data-table.tsx`
- `src/app/globals.css`
- `tests/inventory-helpers.test.ts`
- `tests/production-helpers.test.ts`
- `tests/procurement-helpers.test.ts`
- `tests/sales-helpers.test.ts`
- `tests/branch-helpers.test.ts`

## Production item-selector fix

- Added selector batching in `src/app/api/inventory/items/route.ts` so selector mode keeps fetching until it has enough matching items or runs out of rows.
- Raised the practical selector window and normalized downstream row usage through `limitedSelectorRows`.
- Hardened `src/hooks/useItemSelectorOptions.ts` to accept both array and `{ data }` response shapes, add `retry: 1`, and use a short `staleTime`.
- Replaced the old datalist selector with a searchable dropdown that:
  - clears loading on success or failure,
  - shows explicit empty and error states,
  - supports retry,
  - supports searching by code, name, category, type, unit, and tax status.

## BOM creation fix

- Added `limit: 250` to finished-good, ingredient, and packaging selectors.
- Added retry hooks on finished-good, ingredient, and packaging selectors.
- Added duplicate-line detection for ingredients and packaging rows before submit.
- Added in-flight submit protection and a restoring `finally` path.
- After successful create, the saved BOM ID is fed back into the calculator/list context so the saved record is surfaced immediately.
- API route now rejects duplicate raw-material and packaging rows and returns structured server errors.

## Purchase Order fix

- Added the same selector contract used by production:
  - `limit: 250`
  - retry support
  - searchable shared selector field
- Added a live draft totals summary in the purchase-order form so subtotal, tax, discount, and total are visible while editing.
- The same selector improvements now also cover requisitions and goods received note line entry.

## Sidebar and layout changes

- Increased desktop shell/sidebar widths to the `304px` / `312px` range.
- Kept mobile navigation as a readable drawer with a constrained width and no horizontal overflow.
- Improved sidebar icon/label spacing, nav padding, active-state readability, and footer button sizing.
- Increased form drawer width to `max-w-4xl`.
- Increased data-table cell padding and line-height for action readability.

## Shared form-spacing changes

- Increased shared card padding.
- Standardized input and textarea heights/padding.
- Added better label spacing inside forms.
- Ensured direct form controls fill available width.
- Added minimum action-button height and nowrap handling for table actions.

## Other modules repaired through shared components

These forms were updated to consume the repaired selector contract through the shared selector or shared sales line editor:

- Production order planning
- Procurement requisitions
- Procurement purchase orders
- Procurement goods received notes
- Inventory stores transactions
- Inventory transfers
- Sales quotations
- Sales orders
- Sales invoices
- Branch sales

## Tests executed

- `npm run test:production` — PASS
- `npm run test:procurement` — PASS
- `npm run test:inventory` — PASS
- `npm run test:sales` — PASS
- `npm run test:branches` — PASS
- `npm run lint` — PASS with existing warnings outside this scope:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`
- `npm run build` — PASS
- `git diff --check` — PASS

## Build result

- Next.js production build completed successfully on August 2, 2026.

## Remaining known limitations

- `npm run lint` still reports two existing `react-hooks/exhaustive-deps` warnings in maintenance and sales customer pages that were not modified in this pass.
- This pass was intentionally limited to shared selector reliability, BOM/PO transaction entry, and shared layout/form primitives. It did not rewrite unrelated workflows.

## Database migration required

- No.

