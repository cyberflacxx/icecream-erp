# ERP Phase 1A Implementation Report

## Summary

Phase 1A repaired the branch and item selector foundation after production feedback:

- branch authorization is now reusable and server-side
- branch selector output is now organization-scoped and authorization-aware
- item selector output is now reusable, searchable, warehouse-aware, and branch-aware
- affected sales, procurement, production, inventory stores, transfers, and branch sales screens now use the shared selector path

## Files Changed

- `src/lib/branch-access.ts`
- `src/lib/item-selector.ts`
- `src/hooks/useAuthorizedBranches.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/components/shared/item-selector-field.tsx`
- `src/app/api/branches/route.ts`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/components/sales/sales-line-items-editor.tsx`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/procurement/requisitions/page.tsx`
- `src/app/(dashboard)/procurement/purchase-orders/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/branches/[id]/sales/page.tsx`
- `src/components/production/production-order-planning-form.tsx`
- `src/app/(dashboard)/production/recipes/page.tsx`
- `tests/branch-helpers.test.ts`
- `tests/inventory-helpers.test.ts`
- `tests/procurement-helpers.test.ts`
- `tests/production-helpers.test.ts`
- `tests/sales-helpers.test.ts`

## APIs Changed

### `GET /api/branches`

Added selector behavior:

- `selector=true`
- `includeInactive=true`

Selector output now includes:

- `id`
- `code`
- `name`
- `status`
- `organizationId`
- `defaultWarehouseId`
- `defaultWarehouse`

Behavior changes:

- always filtered by authenticated `organization_id`
- inactive branches excluded by default
- branch-restricted users only receive assigned branches

### `GET /api/inventory/items`

Added selector behavior:

- `selector=true`
- `branch_id`
- `warehouse_id`
- `item_type`
- `category`
- `search`
- `include_stock`
- `include_cost`
- `include_price`
- `includeInactive`

Selector output now includes:

- `id`
- `code`
- `name`
- `itemType`
- `categoryId`
- `categoryName`
- `unitId`
- `unitName`
- `unitAbbreviation`
- `isActive`
- `currentInventoryCost`
- `sellingPrice`
- `warehouseQuantity`
- `branchQuantity`
- `label`

Behavior changes:

- branch scope is validated server-side
- warehouse scope is validated server-side
- missing cost and price remain `null` instead of being masked as zero

### `POST /api/sales/orders`

Behavior changes:

- requested `branchId` is resolved through shared server-side branch authorization
- branch-restricted users cannot override branch scope by payload
- warehouse-to-branch mismatch is rejected before write

## Authorization Behavior

### Shared Branch Authorization

Implemented in `src/lib/branch-access.ts`:

- resolves authorized branch ids
- determines global versus branch-restricted access
- auto-applies the only assigned branch when appropriate
- rejects unauthorized branch ids
- excludes inactive branches by default

### Branch Manager Behavior

- branch managers only receive assigned branches from selector mode
- branch managers cannot override `branchId` in sales order create payloads
- branch-restricted workflows now consume the same shared selector and authorization path instead of page-specific branch/item lists

## Selector Behavior

### Shared UI Pattern

Implemented through:

- `src/hooks/useAuthorizedBranches.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/components/shared/item-selector-field.tsx`

Selector UX now consistently provides:

- searchable item entry
- loading state
- empty-state message
- API error message
- stock / cost / selling-price detail text
- auto-disabled selection until prerequisite warehouse or branch context exists

### Updated Screens

- Production order planning
- Production BOM / recipes
- Procurement requisitions
- Procurement purchase orders
- Procurement GRNs
- Sales quotations
- Sales orders
- Sales invoices
- Inventory stores adjustments / stock take / returns / production issue / finished goods receipt
- Inventory transfers
- Branch sales

## Validation Results

### Targeted Tests

Passed:

- `npm run test:branches`
- `npm run test:inventory`
- `npm run test:procurement`
- `npm run test:sales`
- `npm run test:production`

### Lint

`npm run lint` passed with two pre-existing warnings:

- `src/app/(dashboard)/maintenance/machines/page.tsx`
- `src/app/(dashboard)/sales/customers/page.tsx`

### Build

`npm run build` passed.

Notes:

- build required a longer timeout window
- Next.js build output confirmed:
  - compiled successfully
  - skipped linting
  - skipped type validation

### Diff Check

`git diff --check` passed.

Notes:

- Git reported CRLF normalization warnings only
- no whitespace or patch-format errors were reported

### Additional Observation

`npm run typecheck` still fails because of pre-existing repo-wide TypeScript issues outside Phase 1A, including finance, procurement, sales, health, and shared server files. Phase 1A did not attempt to repair those unrelated failures.

## Remaining Risks

1. Repo-wide type safety is still degraded outside this batch.
2. Some branch-restricted reporting routes still rely on broader static audit confidence rather than interaction tests.
3. Shared selector UI uses a datalist-based searchable input, which is consistent and functional, but not a full custom combobox.

## Recommended Next Phase

1. Repair repo-wide TypeScript failures so build-quality checks become trustworthy again.
2. Add browser-level interaction coverage for branch-restricted selectors and branch report access.
3. Continue consolidating remaining branch-scoped report and meta endpoints onto the same authorization primitives.
