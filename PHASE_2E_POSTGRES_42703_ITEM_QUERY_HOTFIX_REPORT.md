# PHASE 2E PostgreSQL 42703 Item Query Hotfix Report

## Summary

- Incident: production item selector failures caused by PostgreSQL `42703 undefined_column`.
- User-facing symptom: selector-backed inventory, production, procurement, and sales item lookups failed.
- Root cause: selector and shared sales pricing queries referenced legacy `icecream_erp.items.cost_price` and `icecream_erp.items.purchase_price` columns that do not exist in the live schema snapshot.
- Migration required: `no`.

## Exact Failure

- Failing relation: `icecream_erp.items`
- Missing columns:
  - `cost_price`
  - `purchase_price`
- Exact failing selector clause before hotfix:
  - `src/app/api/inventory/items/route.ts`
  - `standard_cost, unit_cost, cost_price, purchase_price, selling_price, is_active`
- Exact shared pricing clause before hotfix:
  - `src/lib/sales-pricing.ts`
  - `unit_cost, standard_cost, cost_price, purchase_price, selling_price, is_active`

## Live Schema Verification

- Verified against `migrations/manual/icecream_erp_live_schema_20260712.sql`.
- Confirmed live `items` columns include:
  - `organization_id`
  - `code`
  - `name`
  - `description`
  - `type`
  - `category_id`
  - `unit_id`
  - `standard_cost`
  - `selling_price`
  - `reorder_level`
  - `reorder_qty`
  - `shelf_life_days`
  - `is_active`
  - `created_at`
  - `updated_at`
  - `item_type`
  - `unit_of_measure_id`
  - `unit_cost`
  - `default_warehouse_id`
  - `production_category`
- Confirmed live schema does not define `cost_price` or `purchase_price`.

## Files Changed

- `src/app/api/inventory/items/route.ts`
- `src/lib/sales-pricing.ts`
- `tests/inventory-helpers.test.ts`
- `tests/sales-helpers.test.ts`

## Hotfix Applied

- Replaced selector item query columns with live-schema-safe columns only.
- Removed all selector-path fallback reads of `row.cost_price` and `row.purchase_price`.
- Removed the same invalid columns from `loadResolvedSalesItemPricing`.
- Kept selector response contract stable: `success`, `items`, `data`, `pagination`, `requestId`.
- Standardized selector DB failure handling to:
  - client code: `ITEM_QUERY_FAILED`
  - client message: `Items could not be loaded.`
  - server logs only: PostgreSQL/Supabase code, message, hint, details, role, org, route, branch, warehouse, request id

## Consumer Verification

- Inventory selector route still resolves:
  - branch scope
  - warehouse scope
  - stock balances
  - shared pricing enrichment
- Shared pricing helper still supports sales selector consumers.
- Production, BOM, procurement, and sales selector consumers continue using the same shared item selector route and pricing helper with the repaired column set.

## Tests Executed

- `npm run test:inventory`
- `npm run test:production`
- `npm run test:procurement`
- `npm run test:sales`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Expected Live Verification

1. Open any selector consumer that loads items from `/api/inventory/items?selector=true`.
2. Confirm the request returns HTTP `200` instead of PostgreSQL `42703`.
3. Confirm inventory, production, procurement, and sales item pickers all populate.
4. If a database failure recurs, confirm the client receives `ITEM_QUERY_FAILED` and inspect server logs for PostgreSQL details.
