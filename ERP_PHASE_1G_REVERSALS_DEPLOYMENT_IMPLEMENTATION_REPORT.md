## ERP Phase 1G Reversals and Deployment Implementation Report

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Status: implemented in code, validated locally without applying migrations or deploying

### Executive Summary

Phase 1G completes the application-side operational reversal surface for posted GRNs, inventory adjustments, inventory write-offs, and stock transfers, and adds a database migration for atomic reversal processing and audit capture.

The branch now includes:

- migration `045_inventory_operational_reversals.sql`
- server-side reversal RPC wrappers
- secured reversal API routes
- reversal metadata exposure in procurement and inventory APIs
- UI reversal actions for GRNs, adjustments, write-offs, and transfers
- gated real-database integration and concurrency test harness scripts
- deployment and rollback assets for the 043 to 045 migration chain
- a controlled end-to-end validation plan

No migration was executed. No deployment was performed. No shared Supabase or authenticator configuration was changed.

### Reversal RPCs

Implemented in `migrations/045_inventory_operational_reversals.sql`:

- `icecream_erp.reverse_goods_received_note_atomic`
- `icecream_erp.reverse_inventory_adjustment_atomic`
- `icecream_erp.reverse_inventory_write_off_atomic`
- `icecream_erp.reverse_stock_transfer_dispatch_atomic`
- `icecream_erp.reverse_stock_transfer_receipt_atomic`

Supporting helpers:

- `icecream_erp.inventory_assert_open_fiscal_period`
- `icecream_erp.inventory_reverse_posted_journal`

Key behavior implemented:

- posted-only reversal checks
- mandatory reason checks
- duplicate reversal blocking
- idempotency capture
- journal reversal linking
- stock movement reversal linking
- stock and PO quantity restoration where applicable
- transfer unwind order enforcement
- service-role-only execute grants
- schema reload notification after migration

### Reversal Routes

Added:

- `src/app/api/procurement/grns/[id]/reverse/route.ts`
- `src/app/api/inventory/adjustments/[id]/reverse/route.ts`
- `src/app/api/inventory/write-off/[id]/reverse/route.ts`
- `src/app/api/inventory/transfers/[id]/reverse-dispatch/route.ts`
- `src/app/api/inventory/transfers/[id]/reverse-receipt/route.ts`

Route characteristics:

- authenticate via `getAuthContext`
- enforce permission checks
- enforce branch and warehouse access
- require reversal reason input
- call server-side wrappers only
- map operational errors to safe API responses

### UI Actions

Implemented across procurement and inventory dashboards:

- Reverse GRN action
- Reverse Adjustment action
- Reverse Write-Off action
- Reverse Transfer Dispatch action
- Reverse Transfer Receipt action

UI behavior:

- actions are permission-gated
- actions are hidden or disabled when documents are not posted or already reversed
- transfer reversal action gating distinguishes dispatch reversal from receipt reversal
- list and detail payloads expose reversal metadata for display

Current limitation:

- API payloads are richer than some current page render blocks. Transfer and GRN pages expose reversal state and actions correctly, but some display sections still summarize reversal data more generically than the API now allows.

### Audit Behavior

Implemented via `icecream_erp.inventory_reversal_runs` and API shaping:

- reversal id
- original document id
- original document type
- original and reversal journal ids
- original and reversal movement ids
- reason
- requested, approved, and posted user ids where available
- branch and organization context
- fiscal period reference
- created and posted timestamps
- idempotency key

API enrichment implemented in:

- `src/app/api/procurement/grns/route.ts`
- `src/app/api/procurement/grns/[id]/route.ts`
- `src/app/api/inventory/adjustments/route.ts`
- `src/app/api/inventory/write-off/route.ts`
- `src/app/api/inventory/transfers/route.ts`
- `src/app/api/inventory/transfers/[id]/route.ts`

### Integration Tests

Added:

- `scripts/run-phase-1g-reversal-db-tests.mjs`
- `migrations/manual/045_inventory_operational_reversals.vps-transaction-test.sql`

Package script:

- `npm run test:inventory:db`

Local result:

- PASS as a safe skip because isolated DB execution is gated behind `PHASE_1G_DB_TESTS=1` and `PHASE_1G_DB_ISOLATED=1`

Reason for skip:

- no isolated database target was configured for this local run
- `psql`-driven destructive verification is intentionally blocked unless explicitly enabled

### Concurrency Tests

Added:

- `migrations/manual/045_inventory_operational_reversals.vps-concurrency-test.sql`

Package script:

- `npm run test:inventory:concurrency`

Local result:

- PASS as a safe skip because isolated DB execution is gated behind `PHASE_1G_DB_TESTS=1` and `PHASE_1G_DB_ISOLATED=1`

Covered scenarios in the harness:

- GRN duplicate and conflicting retry behavior
- concurrent over-receipt blocking
- concurrent write-off blocking
- transfer receipt race protection

### Deployment Assets

Added:

- `deployment/PHASE_1G_PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `deployment/phase-1g-predeploy.sql`
- `deployment/phase-1g-postdeploy.sql`
- `deployment/phase-1g-smoke-test.ps1`
- `deployment/phase-1g-vps-deploy.sh`
- `migrations/manual/045_inventory_operational_reversals.verify.sql`
- `migrations/manual/045_inventory_operational_reversals.rollback.sql`

Deployment asset purpose:

- backup and readiness steps
- checksum verification checkpoints
- ordered application of migrations 043, 044, and 045
- schema verification gates
- smoke-test execution
- rollback command path
- health-check and reopen-user checklist

### Migration Order

Prepared deployment order:

1. back up database
2. verify current migration state
3. verify `043` checksum
4. apply `043`
5. run `043` verification
6. verify `044` checksum
7. apply `044`
8. run `044` verification
9. verify `045` checksum
10. apply `045`
11. run `045` verification
12. run atomic transaction smoke tests
13. deploy application code
14. restart only required application service
15. verify API and PostgREST health
16. run operational smoke tests
17. run financial reconciliation
18. reopen users

This order was documented only. It was not executed in this batch.

### Smoke-Test Plan

Prepared in deployment and manual SQL assets to validate:

- stock movement creation
- journal creation and balancing
- procurement posting
- transfer dispatch and receipt flow
- reversal route availability
- schema object presence after migration

The broader controlled business validation is documented in `ERP_PHASE_1G_END_TO_END_TEST_PLAN.md`.

### Rollback Plan

Rollback assets were added for `045` and documented for the `043` to `045` chain.

Rollback principles:

- back up before applying migrations
- stop on any verification failure
- preserve rollback point before app restart
- reverse application code only after database rollback plan is confirmed
- do not alter shared PostgREST schema configuration
- do not alter `authenticator.rolconfig`

### Files Changed

Phase 1G implementation touched these files directly:

- `ERP_PHASE_1G_END_TO_END_TEST_PLAN.md`
- `ERP_PHASE_1G_REVERSALS_DEPLOYMENT_IMPLEMENTATION_REPORT.md`
- `package.json`
- `scripts/run-phase-1g-reversal-db-tests.mjs`
- `migrations/045_inventory_operational_reversals.sql`
- `migrations/manual/045_inventory_operational_reversals.verify.sql`
- `migrations/manual/045_inventory_operational_reversals.rollback.sql`
- `migrations/manual/045_inventory_operational_reversals.vps-transaction-test.sql`
- `migrations/manual/045_inventory_operational_reversals.vps-concurrency-test.sql`
- `deployment/PHASE_1G_PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `deployment/phase-1g-predeploy.sql`
- `deployment/phase-1g-postdeploy.sql`
- `deployment/phase-1g-smoke-test.ps1`
- `deployment/phase-1g-vps-deploy.sh`
- `src/lib/inventory-reversal-server.ts`
- `src/lib/permission-access.ts`
- `src/lib/shared/api-routes.ts`
- `src/hooks/inventory/types.ts`
- `src/hooks/procurement/types.ts`
- `src/app/api/procurement/grns/route.ts`
- `src/app/api/procurement/grns/[id]/route.ts`
- `src/app/api/procurement/grns/[id]/reverse/route.ts`
- `src/app/api/inventory/adjustments/route.ts`
- `src/app/api/inventory/adjustments/[id]/reverse/route.ts`
- `src/app/api/inventory/write-off/route.ts`
- `src/app/api/inventory/write-off/[id]/reverse/route.ts`
- `src/app/api/inventory/transfers/route.ts`
- `src/app/api/inventory/transfers/[id]/route.ts`
- `src/app/api/inventory/transfers/[id]/reverse-dispatch/route.ts`
- `src/app/api/inventory/transfers/[id]/reverse-receipt/route.ts`
- `src/app/(dashboard)/inventory/stores/page.tsx`
- `src/app/(dashboard)/inventory/transfers/page.tsx`
- `src/app/(dashboard)/procurement/goods-received/page.tsx`
- `tests/inventory-helpers.test.ts`

### Validation Results

Executed locally:

- `npm run test:production` PASS
- `npm run test:procurement` PASS
- `npm run test:inventory` PASS
- `npm run test:finance` PASS
- `npm run test:sales` PASS
- `npm run test:branches` PASS
- `npm run test:inventory:db` PASS (safe skip, gated)
- `npm run test:inventory:concurrency` PASS (safe skip, gated)
- `npm run lint` PASS with pre-existing warnings only
- `npm run build` PASS
- `git diff --check` PASS apart from line-ending warnings only

### Known Risks

1. The real PostgreSQL integration and concurrency harness is present but still needs execution against an isolated database target before production use.
2. Reversal metadata exposure is broader in APIs than in some current UI display blocks, so some reversal detail panels can still be improved without changing backend behavior.
3. Deployment assets now cover 043 to 045 because Phase 1G required new reversal schema objects beyond the original 043 to 044 scope.

### Production Readiness Recommendation

Recommendation: ready for isolated database verification and controlled UAT, not yet ready for production deployment.

Reason:

- code, tests, lint, and build pass locally
- migration and deployment assets are prepared
- real destructive database validation has not yet been executed against an isolated PostgreSQL target
- production deployment should wait for successful isolated migration, transaction, concurrency, smoke, and reconciliation runs
