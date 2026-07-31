# PRODUCTION_RELEASE_MANIFEST

Date: July 31, 2026
Scope: Icecream ERP Production module batches 1 through 4

## 1. Feature summary

The Production Orders workflow is now the primary Production execution path. The changeset includes planned-order creation and editing, release, issue posting, receipt posting, close, reopen, issue reversal, receipt reversal, a modern order-based dashboard, relationship-map sourcing from `production_document_links`, and server-side authorization around every Production-order write path.

## 2. Batches completed

- Batch 1: organization and branch authorization for Production-order write routes
- Batch 2: issue reversal, receipt reversal, reopen workflow, relationship-map migration
- Batch 3: Production Orders primary workflow, planned-order pages, modern dashboard, legacy batch demotion
- Batch 4: full verification, defect correction, VPS rollback-test script, VPS readiness script, release packaging

## 3. Files changed

- `package.json`
- `src/app/(dashboard)/production/batches/page.tsx`
- `src/app/(dashboard)/production/orders/[id]/page.tsx`
- `src/app/(dashboard)/production/orders/page.tsx`
- `src/app/(dashboard)/production/recipes/page.tsx`
- `src/app/api/production/dashboard/route.ts`
- `src/app/api/production/meta/route.ts`
- `src/app/api/production/orders/[id]/close/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/release/route.ts`
- `src/app/api/production/orders/[id]/route.ts`
- `src/app/api/production/orders/products/route.ts`
- `src/app/api/production/orders/route.ts`
- `src/components/production/production-dashboard.tsx`
- `src/components/production/production-nav.tsx`
- `src/components/ui-library/confirm-dialog.tsx`
- `src/hooks/production/useProduction.ts`
- `src/hooks/production/useProductionMeta.ts`
- `src/lib/permission-access.ts`
- `src/lib/production-orders-server.ts`
- `src/lib/production-server.ts`
- `src/lib/production.ts`
- `src/lib/shared/api-routes.ts`
- `tests/production-helpers.test.ts`

## 4. New files

- `migrations/041_revoke_browser_posting_internal_grants.sql`
- `migrations/042_production_reopen_and_relationship_links.sql`
- `scripts/verify-production-vps-readiness.sh`
- `scripts/vps-test-production-order-workflow.sql`
- `src/app/(dashboard)/production/orders/new/page.tsx`
- `src/app/(dashboard)/production/orders/[id]/edit/page.tsx`
- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/reopen/route.ts`
- `src/components/production/production-order-planning-form.tsx`
- `src/lib/production-order-authorization.ts`
- `PRODUCTION_RELEASE_MANIFEST.md`
- `PRODUCTION_FINAL_VERIFICATION_REPORT.md`

## 5. Migration

- `migrations/042_production_reopen_and_relationship_links.sql`

## 6. Migration dependency order

`034_atomic_inventory_approval_processing.sql`
`035_production_order_workflow_foundation.sql`
`036_production_issue_and_receipt_documents.sql`
`037_production_order_planning_release_rpcs.sql`
`038_production_order_transaction_rpcs.sql`
`039_production_relationship_map_and_reporting.sql`
`040_sales_finance_transaction_engine.sql`
`041_revoke_browser_posting_internal_grants.sql`
`042_production_reopen_and_relationship_links.sql`

## 7. Database objects affected

- Tables read or written by Production routes: `production_orders`, `production_order_components`, `production_order_status_history`, `production_issues`, `production_issue_lines`, `production_receipts`, `production_receipt_lines`, `production_document_links`
- Reporting/view objects: `production_order_cost_summary`, `production_order_relationship_map`
- RPCs: `save_planned_production_order`, `release_production_order`, `post_production_issue`, `post_production_receipt`, `close_production_order`, `reverse_production_issue`, `reverse_production_receipt`, `reopen_production_order`

## 8. New or replaced RPCs/views

- New RPC exposed in this changeset: `reopen_production_order`
- Existing RPC wrappers aligned and verified: all seven previously exposed Production RPCs plus `reopen_production_order`
- Replaced view definition: `production_order_relationship_map`, now sourced from `production_document_links`

## 9. API routes added

- `src/app/api/production/orders/[id]/issues/[issueId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/receipts/[receiptId]/reverse/route.ts`
- `src/app/api/production/orders/[id]/reopen/route.ts`

## 10. UI routes added or changed

- Added: `/production/orders/new`
- Added: `/production/orders/[id]/edit`
- Changed: `/production/orders`
- Changed: `/production/orders/[id]`
- Changed: `/production/dashboard`
- Changed: `/production/recipes`
- Changed: `/production/batches` to explicit legacy-only messaging

## 11. Permission changes

- Production route layer now enforces organization scoping and branch scoping before service-role RPC invocation.
- UI visibility remains advisory; route authorization is the actual security boundary.
- Migration `041_revoke_browser_posting_internal_grants.sql` restricts direct browser-role access to posting internals and grants access only to `service_role`.
- Migration `042_production_reopen_and_relationship_links.sql` revokes execute from `public`, `anon`, and `authenticated`, then grants execute only to `service_role` for `reopen_production_order`.

## 12. Test inventory

- `npm run test:production` now executes 59 tests.
- Coverage groups:
  - SQL-contract tests
  - authorization-policy tests
  - route-contract tests
  - UI-contract tests
  - business-logic helper tests
  - migration package checks
- New Batch 4 emphasis:
  - all eight RPC wrapper/SQL parameter-set checks
  - issue/receipt payload date and idempotency propagation
  - no modern UI targets legacy batch posting screens
  - migration duplicate-prefix check

## 13. Validation results

- `npm run test:production`: PASS, 59/59
- `npm run lint`: PASS with unrelated warnings only
- `npm run typecheck`: FAIL, unrelated repo-wide `.next/types/**/*.ts` include drift
- Production-path typecheck inspection: PASS, no Production-path errors found in the `npm run typecheck` output
- `npm run build`: PASS
- `git diff --check`: PASS, CRLF warnings only
- duplicate migration-prefix check: PASS
- search for `041_production_reopen_and_relationship_links.sql`: PASS, no references remain
- search for modern Production actions targeting legacy batch posting screens: PASS
- Git Bash syntax check for `scripts/verify-production-vps-readiness.sh`: PASS

## 14. Known unrelated repository failures

- `npm run lint` warnings:
  - `src/app/(dashboard)/maintenance/machines/page.tsx`
  - `src/app/(dashboard)/sales/customers/page.tsx`
- `npm run typecheck` fails because `tsconfig.json` includes `.next/types/**/*.ts` and the current generated `.next/types` tree does not contain many referenced pages and API route stubs. No Production-path error lines were present in that output.

## 15. Deployment prerequisites

- Current branch contains both migrations `041` and `042`
- Shared database already has migrations `034` through `041` deployed
- PostgREST exposes `icecream_erp`
- Service-role credentials available in deployment environment
- Required Production master data exists for validation: active recipes, warehouses, active users with accounts, finished goods

## 16. Backup requirements

- Take a database backup or verified snapshot before applying `042`
- Preserve current PostgREST and app environment configuration
- Preserve the release commit hash and migration inventory before running deployment commands

## 17. Deployment command sequence

1. Confirm clean target release branch and target commit.
2. Verify migration inventory includes `041` and `042` with no duplicate numeric prefixes.
3. Run `scripts/verify-production-vps-readiness.sh` in the VPS environment.
4. Apply `migrations/042_production_reopen_and_relationship_links.sql` using the established deployment process.
5. Refresh or verify PostgREST schema reload according to repository convention.
6. Run targeted Production verification on the deployed environment.

## 18. Post-deployment verification sequence

1. Confirm `reopen_production_order` exists and is executable only by `service_role`.
2. Confirm `production_order_relationship_map` reads from `production_document_links`.
3. Run `scripts/vps-test-production-order-workflow.sql` inside a transaction and end with `ROLLBACK`.
4. Verify no duplicate issue or receipt posting occurs with reused idempotency keys.
5. Verify reopened orders preserve stock and document history.
6. Verify modern UI routes still target `/production/orders` workflows.

## 19. Rollback strategy

- If `042` must be rolled back before dependent work, drop `reopen_production_order` and restore the prior `production_order_relationship_map` definition from migration `039`.
- Do not roll back `041`; it is an earlier hardening migration already deployed on the shared environment.
- Use the rollback-only SQL workflow script only for verification, not for structural rollback.

## 20. Exact files that must be committed

- All files listed in sections 3 and 4
- Existing Production reports also present in the worktree and expected in the release package:
  - `PRODUCTION_MODULE_AUDIT.md`
  - `PRODUCTION_SECURITY_IMPLEMENTATION_REPORT.md`
  - `PRODUCTION_REVERSAL_RELATIONSHIP_IMPLEMENTATION_REPORT.md`
  - `PRODUCTION_WORKFLOW_ALIGNMENT_IMPLEMENTATION_REPORT.md`

## 21. Confirmation that migration 041 hardening remains untouched

`migrations/041_revoke_browser_posting_internal_grants.sql` was restored into the worktree from repository history with the exact historical content from commit `3ba9180b706388b2011f7441b9d4e0c8ade88d61`. No content change was made to that migration.

## 22. Confirmation that no VPS action occurred

No VPS deployment, migration execution, commit, or push was performed in this batch.
