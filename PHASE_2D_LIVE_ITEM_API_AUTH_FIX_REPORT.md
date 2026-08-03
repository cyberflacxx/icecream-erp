# PHASE 2D Live Item API Auth Fix Report

Date: August 3, 2026
Repository: `C:\Users\CyberFlacx\Desktop\desktttoop\icecream erp`
Production branch: `master`
Deployed commit inspected: `283f026`

## Root Cause

The deployed `283f026` selector path authenticated `/api/inventory/items?selector=true` with `getAuthContext()` but did not pass the incoming `NextRequest`. The frontend already sent `Authorization: Bearer <access_token>` plus `credentials: "include"`, but the server auth helper ignored the bearer token and depended only on SSR cookies.

On Vercel, that left the selector route vulnerable to a live `401 Unauthorized` when the browser request arrived without a usable cookie-backed Supabase session. The frontend then surfaced only the generic selector failure. This was the concrete production blocker for `production_manager` on Planned Production and the same shared endpoint risked the same failure for BOM, Purchase Orders, Requisitions, GRNs, Transfers, Sales Orders, and Sales Invoices.

This root cause is from the deployed code path itself. I did not have direct access to live Vercel request logs in this workspace.

## HTTP Status And Error Code

Pre-fix failure path:

- Likely live status: `401`
- Pre-fix client symptom: generic selector load failure
- Post-fix structured auth failure code: `ITEM_AUTH_REQUIRED`

Other new selector error codes added:

- `ITEM_ACCESS_DENIED`
- `ITEM_ORGANIZATION_REQUIRED`
- `ITEM_BRANCH_INVALID`
- `ITEM_WAREHOUSE_INVALID`
- `ITEM_ENV_MISCONFIGURED`

## Authentication Findings

- `useItemSelectorOptions` was already sending the Supabase access token and `credentials: "include"`.
- `apiFetch` already preserved same-origin credentials, so the browser side was not the primary bug.
- `getAuthContext(request)` now accepts the request and reads the bearer token from `Authorization`.
- If a bearer token is present, the server now resolves the user with `supabase.auth.getUser(accessToken)` and uses that same token for session activity checks.
- Cookie-backed auth still works; the fix adds header-backed auth instead of bypassing auth.
- The selector API now always returns JSON, never HTML, and includes `requestId`.

## Organization And Scoping Findings

- Organization scope remains mandatory.
- Empty branch and warehouse filters are still optional and are not forced into blank equality filters.
- Branch authorization still uses `resolveRequestedBranchId`.
- Warehouse scoping still validates requested warehouses against organization and branch scope.
- Planned Production still requests finished goods with `['FINISHED_GOOD', 'FINISHED']`.
- BOM still requests:
  - finished goods: `['FINISHED_GOOD', 'FINISHED']`
  - ingredients: `['RAW', 'RAW_MATERIAL', 'INGREDIENT', 'CONSUMABLE', 'STOCK']`
  - packaging: `['PACKAGING', 'PACKAGING_MATERIAL']`
- Purchase Orders still request purchasable inventory types from the shared selector.

## Schema And Query Findings

- Server and service-role Supabase clients continue to target `icecream_erp`.
- No shared Supabase deployment configuration was changed.
- The selector API still uses the approved server-side service-role query pattern after authenticated user validation.
- The route now logs safe selector diagnostics per request:
  - `requestId`
  - HTTP status
  - user ID
  - role
  - organization ID
  - branch ID
  - warehouse ID
  - requested item types
  - search term
  - page and page size
  - Supabase error code and message
  - returned row count

## Vercel Environment Findings

New runtime validation now fails startup/build when required env names are missing.

Required in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- One canonical app URL variable. Recommended: `NEXT_PUBLIC_APP_URL`

Accepted canonical URL env names:

- `ABSOLUTE_ERP_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `APP_URL`
- `BASE_URL`
- `SITE_URL`
- `NEXTAUTH_URL`
- `VERCEL_URL`

## Files Changed

- `src/app/api/inventory/items/route.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/lib/api-auth.ts`
- `src/lib/api.ts`
- `src/lib/app-url.ts`
- `src/lib/runtime-env.ts`
- `src/lib/supabase/server.ts`
- `src/middleware.ts`
- `tests/inventory-helpers.test.ts`
- `tests/procurement-helpers.test.ts`
- `tests/production-helpers.test.ts`
- `tests/sales-helpers.test.ts`

## Endpoint Contract After Fix

Success:

```json
{
  "success": true,
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 250,
    "total": 0
  },
  "requestId": "item-selector-..."
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "ITEM_AUTH_REQUIRED",
    "message": "Authentication is required to load selector items.",
    "requestId": "item-selector-..."
  }
}
```

Frontend selector errors now surface:

- HTTP status
- stable error code
- request ID
- readable message

Example:

`Items could not be loaded. — API 403 — ITEM_ACCESS_DENIED — Request item-selector-... — You do not have permission to load selector items.`

## Tests Run

- `npm run test:production`
- `npm run test:procurement`
- `npm run test:inventory`
- `npm run test:sales`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Build Result

- `npm run build`: passed on August 3, 2026
- `npm run lint`: passed with pre-existing warnings outside the touched files:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`

## Production Verification Steps

1. Deploy this commit to Vercel with the required env vars present.
2. Sign in as a `production_manager`.
3. Open `Production -> Orders -> New Planned Production`.
4. Confirm Product Number loads finished goods.
5. Select a product and confirm Product Name and active BOM summary populate.
6. Open `Production -> BOM Standards` and confirm:
   - finished product selector loads
   - raw material selector loads
   - packaging selector loads
7. Open `Procurement -> Purchase Orders` and confirm item selector loads and draft save still works.
8. Open Requisitions, GRNs, Inventory Transfers, Sales Orders, and Sales Invoices and confirm the shared selector loads.
9. If a selector fails, capture the displayed `requestId` and inspect the Vercel logs for the matching `inventory.item-selector` entry.

## Remaining Limitation

- I validated the live failure path from the deployed code and repaired the runtime request path locally, but I could not directly replay the production Vercel session/cookie state from this workspace. Post-deploy verification on Vercel is still required.
