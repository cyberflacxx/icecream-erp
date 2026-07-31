# PRODUCTION_REVERSAL_RELATIONSHIP_IMPLEMENTATION_REPORT

## 1. Executive summary

Batch 2 is implemented in the repository without deploying anything.

Delivered:
- authenticated issue reversal API
- authenticated receipt reversal API
- safe closed-order reopen workflow
- additive migration `042_production_reopen_and_relationship_links.sql`
- relationship-map view rebuilt from `production_document_links`
- Production order detail UI controls for reverse and reopen
- focused automated tests for route policy, SQL contract, relationship-map contract, and UI/API wiring

Not deployed:
- no migration execution
- no VPS action
- no destructive database operation

## 2. Files changed

- `migrations/042_production_reopen_and_relationship_links.sql`
- `src/lib/permission-access.ts`
- `src/lib/production-server.ts`
- `src/lib/production-orders-server.ts`
- `src/lib/shared/api-routes.ts`
- `src/components/ui-library/confirm-dialog.tsx`
- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/reopen/route.ts`
- `src/app/(dashboard)/production/orders/[id]/page.tsx`
- `tests/production-helpers.test.ts`

Pre-existing modified files from batch 1 remain in the worktree and were preserved.

## 3. Existing SQL capabilities discovered

Confirmed before changes:
- `reverse_production_issue(uuid, uuid, uuid, uuid, text) returns jsonb`
- `reverse_production_receipt(uuid, uuid, uuid, uuid, text) returns jsonb`
- both RPCs already existed in `038_production_order_transaction_rpcs.sql`
- both RPCs are `security definer`
- both RPCs are restricted to `service_role`
- both RPCs reject reversals when the production order is `CLOSED`
- both RPCs preserve audit history and inventory restoration inside SQL

Confirmed missing before changes:
- no existing `reopen_production_order` RPC in the repository

## 4. Reopen RPC existence result

Result: `reopen_production_order` did not exist.

Action taken:
- created additive migration `042_production_reopen_and_relationship_links.sql`
- added `icecream_erp.reopen_production_order(...) returns jsonb`

## 5. New migration created, if any

Created:
- `migrations/042_production_reopen_and_relationship_links.sql`

Contents:
- `icecream_erp.reopen_production_order(...)`
- `create or replace view icecream_erp.production_order_relationship_map`
- service-role-only grant for reopen RPC
- `notify pgrst, 'reload schema'`

Shared DB rule compliance:
- schema remains `icecream_erp`
- no `ALTER ROLE authenticator`
- no `public` schema objects
- no destructive DDL

## 6. Issue reversal implementation

Backend:
- added wrapper `reverseProductionIssue(...)` in `src/lib/production-orders-server.ts`
- added route `POST /api/production/orders/[id]/issues/[issueId]/reverse`

Route protections:
- requires auth
- requires `production_issue.reverse`
- uses authenticated organization only
- authorizes the production order through batch 1 branch/org helper
- loads and verifies the issue belongs to the same organization and order
- requires non-empty reason
- returns structured mapped errors

UI:
- reverse button shown only for posted issues
- hidden for closed orders
- hidden without permission
- confirmation dialog requires reason

## 7. Receipt reversal implementation

Backend:
- added wrapper `reverseProductionReceipt(...)` in `src/lib/production-orders-server.ts`
- added route `POST /api/production/orders/[id]/receipts/[receiptId]/reverse`

Route protections:
- requires auth
- requires `production_receipt.reverse`
- enforces order branch/org authorization before RPC
- verifies receipt ownership against order and organization
- requires non-empty reason
- preserves SQL-side atomic inventory restoration by calling the existing RPC only

UI:
- reverse button shown only for posted receipts
- hidden for closed orders
- hidden without permission
- confirmation dialog requires reason

## 8. Reopen implementation

Backend:
- added wrapper `reopenProductionOrder(...)` in `src/lib/production-orders-server.ts`
- added route `POST /api/production/orders/[id]/reopen`
- added permission alias handling for `production_order.reopen`

SQL behavior:
- only `CLOSED` orders can be reopened
- reason required
- order row locked with `FOR UPDATE`
- reopen target status is `RELEASED`
- no deletion of issues, receipts, stock movements, links, or audit rows
- inserts `production_order_status_history`
- inserts `audit_logs`
- no inventory reversal is invoked

Reason for reopening to `RELEASED`:
- closed orders already have posted production history
- reopening to `PLANNED` would make posted issue/receipt history inconsistent

UI:
- reopen button appears only for closed orders and authorized users
- confirmation dialog requires reason

## 9. Relationship-map implementation

Previous state:
- `039_production_relationship_map_and_reporting.sql` rebuilt the map directly from `production_order_id`

Current state:
- migration `041` replaces the view with a `production_document_links`-driven view
- root node remains the production order
- linked issue and receipt nodes are resolved through document links
- view stays organization-scoped
- reversed documents remain visible because there is no `POSTED` filter
- duplicate links are deduplicated with `row_number() over (...)` and `where rn = 1`
- UI compatibility preserved by keeping the original leading columns and adding document metadata columns

## 10. Branch and organization protection

Preserved:
- batch 1 `authorizeProductionOrderWriteAccess(...)`
- production order branch enforcement
- authenticated organization scoping

Added:
- issue ownership lookup by organization and order
- receipt ownership lookup by organization and order
- reopen permission alias in `permission-access.ts`

## 11. UI controls and permission behaviour

Updated page:
- `src/app/(dashboard)/production/orders/[id]/page.tsx`

Behavior:
- release form hidden without `production_order.release`
- issue posting form hidden without `production_issue.post`
- receipt posting form hidden without `production_receipt.post`
- close action hidden without `production_order.close`
- reopen action hidden without `production_order.reopen`
- reverse issue action hidden without `production_issue.reverse`
- reverse receipt action hidden without `production_receipt.reverse`
- reverse/reopen use confirmation dialogs with required reason
- close now uses confirmation dialog
- submit buttons are disabled while pending
- query invalidation refreshes production detail, production lists/dashboard, and production-batches caches
- relationship-map mojibake removed and replaced with a normal separator

## 12. Tests added

Added/updated coverage in `tests/production-helpers.test.ts`:
- reversal route success paths
- reversal reason validation
- cross-order / cross-organization rejection
- branch authorization failure before RPC invocation
- controlled duplicate/already-reversed error mapping
- reopen success path
- reopen rejection for non-closed, unauthorized, cross-branch, cross-organization, and empty reason
- reopen SQL contract checks for status history and audit logging
- relationship-map SQL contract checks for `production_document_links` and deduplication
- UI/API path and refresh contract checks
- migration package updated to include `041`

## 13. Commands run and complete results

1. `npm run test:production`
- PASS
- 45 tests passed

2. `node --test --test-name-pattern "reversal|reopen|relationship map|detail page" .tmp-tests/tests/production-helpers.test.js`
- PASS
- no additional failures reported

3. `npm run lint`
- PASS with pre-existing warnings:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`

4. `npm run typecheck`
- FAIL
- unrelated existing repo-wide errors remain in finance, procurement, sales, suppliers, users, health, and shared server files

5. `npm run build`
- PASS
- Next.js production build completed successfully

6. `git diff --check`
- PASS for whitespace errors
- emitted CRLF conversion warnings only

7. `git status --short`
- shows current modified/untracked files
- no commit created

## 14. Known unrelated failures

`npm run typecheck` still fails outside the Production batch 2 surface. The failures are pre-existing in files such as:
- `src/app/api/finance/dashboard/route.ts`
- `src/app/api/procurement/requisitions/route.ts`
- `src/app/api/procurement/supplier-invoices/route.ts`
- `src/app/api/procurement/supplier-payments/route.ts`
- `src/app/api/sales/customers/route.ts`
- `src/app/api/sales/dispatches/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/api/sales/quotations/route.ts`
- `src/app/api/sales/returns/route.ts`
- `src/app/api/suppliers/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/lib/finance-server.ts`
- `src/lib/health.ts`
- `src/lib/sales-server.ts`

These were not changed in this batch.

## 15. Remaining Production defects

Within batch 2 scope, no new confirmed Production-specific failures remain after `test:production` and `npm run build`.

Outside batch 2 scope:
- broader Production findings from the earlier audit remain tracked in `PRODUCTION_MODULE_AUDIT.md`
- repo-wide typecheck debt still blocks a clean global `tsc --noEmit`

## 16. Migration deployment instructions, but do not deploy

When deployment is approved:

1. Review `migrations/042_production_reopen_and_relationship_links.sql`
2. Apply it through the normal migration process for the `icecream_erp` schema
3. Verify PostgREST schema reload occurred
4. Smoke test:
   - reverse issue
   - reverse receipt
   - reopen closed order
   - relationship map visibility for posted and reversed documents

Not performed here:
- no migration execution
- no remote database session
- no VPS command

## 17. Rollback considerations

If rollback is needed before deployment:
- revert the code changes in this batch
- remove migration `042_production_reopen_and_relationship_links.sql`

If rollback is needed after deployment:
- drop `icecream_erp.reopen_production_order(...)`
- restore the prior `production_order_relationship_map` definition from migration `039`
- keep historical data untouched; do not delete links, issues, receipts, stock movements, or audit rows

## 18. Confirmation that no VPS action occurred

Confirmed:
- no VPS login
- no deployment
- no migration run
- no database mutation outside local source changes
