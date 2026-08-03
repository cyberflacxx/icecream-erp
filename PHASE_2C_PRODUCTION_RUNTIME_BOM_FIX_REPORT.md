# Phase 2C Production Runtime BOM Fix Report

## Incident Summary

- Date handled: August 3, 2026
- Repository commit inspected and fixed: `6b8561e`
- Affected runtime areas:
  - `/production/reports`
  - `/production/recipes`
  - shared inventory item selector
  - `/procurement/purchase-orders`

## Exact ReferenceError Root Cause

- Root cause: [`src/app/(dashboard)/production/reports/page.tsx`](./src/app/(dashboard)/production/reports/page.tsx) rendered `notice` inside `ReportSection`, but `notice` was not destructured from the function props.
- Runtime effect: the page hit a client-side `ReferenceError` during render and fell into the error boundary with the user-facing message "The page could not finish loading."
- Why build/tests passed before:
  - TypeScript did not block the render-time reference in the deployed path.
  - Prior source-level tests validated report content strings but did not assert the `ReportSection` prop destructuring contract.
  - The failure only surfaced when the costing section rendered the zero-output notice path at runtime.

## Item Selector Runtime Root Cause

- Root cause 1: the selector API at [`src/app/api/inventory/items/route.ts`](./src/app/api/inventory/items/route.ts) returned legacy `{ data: [...] }` only, while the incident required normalized `{ items, pagination }`.
- Root cause 2: the frontend hook at [`src/hooks/useItemSelectorOptions.ts`](./src/hooks/useItemSelectorOptions.ts) only normalized legacy array and `data` responses, not the requested `items` contract.
- Runtime effect:
  - selector consumers were fragile across response shapes;
  - production and procurement selectors could appear empty or inconsistent during response-shape transitions;
  - supportability was poor because request IDs were not surfaced consistently.
- Fix:
  - selector API now returns `data`, `items`, and `pagination`;
  - selector hook now supports legacy array, legacy `data`, and normalized `items`;
  - shared `apiFetch` now parses structured API failures and logs `requestId`.

## BOM Creation Root Cause

- Root cause: [`src/app/api/production/recipes/route.ts`](./src/app/api/production/recipes/route.ts) inserted the BOM header first, then inserted ingredient and packaging lines without rollback or post-save verification.
- Runtime effect:
  - a line insert failure could leave a saved recipe header behind;
  - the API could report failure after a partial write;
  - the next load could show a BOM header without confirmed lines.
- Fix:
  - added item and unit prevalidation before insert;
  - enforced active finished-good, ingredient, and packaging item checks;
  - added deterministic `sort_order` and production-category line payloads;
  - added post-save verification that the saved line counts match the submitted payload;
  - added rollback compensation that removes the created BOM if any later step fails.

## Purchase Order Verification

- Shared selector compatibility was reverified against [`src/app/(dashboard)/procurement/purchase-orders/page.tsx`](./src/app/(dashboard)/procurement/purchase-orders/page.tsx).
- Additional hardening was applied in [`src/app/api/procurement/purchase-orders/route.ts`](./src/app/api/procurement/purchase-orders/route.ts):
  - structured `requestId` failure payload for PO create failures;
  - rollback compensation if line insertion fails after the PO header is created.
- Result:
  - PO line selection remains on the shared selector path;
  - PO create no longer leaves an orphan header if line persistence fails.

## Role And Permission Findings

- `production_manager` still has the required permissions in code:
  - `dashboard.read`
  - `production.read`
  - `production.write`
  - `inventory.read`
  - `quality.read`
  - `quality.write`
  - `reports.read`
- No security bypass was added.
- The new build-info endpoint is authenticated and limited to users with `dashboard.read`.

## Error Handling Changes

- Shared API error helpers in [`src/lib/api-auth.ts`](./src/lib/api-auth.ts) now return:

```json
{
  "success": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Readable message",
    "requestId": "..."
  }
}
```

- Shared client fetch handling in [`src/lib/api.ts`](./src/lib/api.ts) now:
  - parses nested `error.message`, `error.code`, and `error.requestId`;
  - logs failed request IDs;
  - throws a structured `ApiRequestError`.

## Build And Deployment Verification

- Added dashboard-scoped error boundary:
  - [`src/app/(dashboard)/error.tsx`](./src/app/(dashboard)/error.tsx)
- Added authenticated internal build endpoint:
  - [`src/app/api/internal/build-info/route.ts`](./src/app/api/internal/build-info/route.ts)
- Added build metadata helper:
  - [`src/lib/build-info.ts`](./src/lib/build-info.ts)

### Deployment Verification Instructions

1. Deploy this artifact.
2. Sign in as an authenticated internal user.
3. Request `GET /api/internal/build-info`.
4. Confirm the returned `build.commitShort` matches `6b8561e` or the deploy-time commit SHA.
5. Open:
   - `/production/reports`
   - `/production/recipes`
   - `/production/orders/new`
   - `/procurement/purchase-orders`
6. Confirm the production reports page renders without the previous runtime failure.
7. Confirm BOM selectors load, select items, add lines, and save without partial-write artifacts.

## Files Changed

- `src/app/(dashboard)/production/reports/page.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/internal/build-info/route.ts`
- `src/app/api/procurement/purchase-orders/route.ts`
- `src/app/api/production/recipes/route.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/lib/api-auth.ts`
- `src/lib/api.ts`
- `src/lib/build-info.ts`
- `tests/inventory-helpers.test.ts`
- `tests/procurement-helpers.test.ts`
- `tests/production-helpers.test.ts`

## Tests Added Or Updated

- production reports regression:
  - confirms `notice` is part of `ReportSection` props;
  - confirms retry UI exists.
- production BOM regression:
  - confirms rollback helper exists;
  - confirms line `sort_order` persistence;
  - confirms post-save verification exists.
- inventory selector regression:
  - confirms normalized `items` and `pagination` response;
  - confirms frontend supports `response.items ?? response.data`.
- procurement PO regression:
  - confirms PO rollback helper exists;
  - confirms create failure includes `requestId`.

## Commands Executed

- `npm run test:production`
- `npm run test:procurement`
- `npm run test:inventory`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Build Result

- `npm run build`: passed on August 3, 2026
- `npm run lint`: passed with two pre-existing warnings outside the incident scope
- `git diff --check`: passed

## Migration Status

- No migration added
- No new database RPC added
- Compensation/rollback was implemented in application code only

## Remaining Limitations

- The build-info endpoint can only report the deploy-time commit that is available in the runtime environment or embedded artifact.
- Existing out-of-scope lint warnings remain in:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`

## Source-Level Runtime Smoke Verification

- Verified route presence and successful build output for:
  - `/production/reports`
  - `/production/recipes`
  - `/production/orders/new`
  - `/procurement/purchase-orders`
- Added direct regression coverage for the production reports render path, selector normalization path, BOM persistence safeguards, and PO rollback path.
