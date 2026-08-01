# ERP Phase 1H Isolated Database Test Report

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Current HEAD: `7da2a62bbd42cf4a04dd9177a82eb180db266991`
Status: blocked before migration execution

## Summary

Phase 1H isolated database execution could not start in this workspace because the required isolated PostgreSQL toolchain and connection gates are not configured locally.

No migrations were applied.
No isolated database was connected.
No destructive database test was executed.

## Required Gate Check

Required by the Phase 1H brief:

- `PHASE_1G_DB_TESTS=1`
- `PHASE_1G_DB_ISOLATED=1`
- explicit isolated `DATABASE_URL`
- explicit confirmation that the target database is not production
- `psql` available on `PATH`

Observed locally:

- `PHASE_1G_DB_TESTS`: unset
- `PHASE_1G_DB_ISOLATED`: unset
- `DATABASE_URL`: absent from `.env`
- `psql`: not installed on `PATH`
- `docker`: not installed on `PATH`

Result: isolated migration verification is blocked at the environment gate.

## Database Identity

Isolated database used: none

Because `DATABASE_URL` is not configured, the following mandatory checks could not be executed:

- database host
- database name
- PostgreSQL version
- current schema confirmation
- migration state confirmation
- test-database backup

## Migration Checksums

- `043_finance_chart_of_accounts_foundation.sql`
  - `E15F723E057777E0D7EAE2020AADCFEFC3B55534D1CD386F48F736BAC0933B72`
- `044_atomic_inventory_posting_and_stock_ledger.sql`
  - `665C1410B683F34A798EEB90BBE9CE101A7F9F269945B078BC604A7783A1E6AC`
- `045_inventory_operational_reversals.sql`
  - `DBFCAAFD8CA68B39C6E1C8F3506BD5DE19A7D27BCAECD98D8114031DDDEA5A91`

## Verification Assets Read

- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
- `migrations/045_inventory_operational_reversals.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
- `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql`
- `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.rollback.sql`
- `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.vps-transaction-test.sql`
- `migrations/manual/045_inventory_operational_reversals.verify.sql`
- `migrations/manual/045_inventory_operational_reversals.rollback.sql`
- `migrations/manual/045_inventory_operational_reversals.vps-transaction-test.sql`
- `migrations/manual/045_inventory_operational_reversals.vps-concurrency-test.sql`

## Commands Executed

### DB harness prerequisites

- `psql --version`
  - result: failed
  - message: `psql` not found on `PATH`

- `where.exe psql`
  - result: failed
  - message: no `psql` executable found

- `docker --version`
  - result: failed
  - message: `docker` not found on `PATH`

### Required DB test scripts

- `npm run test:inventory:db`
  - result: failed by design after release-gate correction
  - message:
    - `[phase-1g-db-tests] integration requires PHASE_1G_DB_TESTS=1, PHASE_1G_DB_ISOLATED=1, a dedicated non-production DATABASE_URL, and psql on PATH.`

- `npm run test:inventory:concurrency`
  - result: failed by design after release-gate correction
  - message:
    - `[phase-1g-db-tests] concurrency requires PHASE_1G_DB_TESTS=1, PHASE_1G_DB_ISOLATED=1, a dedicated non-production DATABASE_URL, and psql on PATH.`

## Defect Found and Corrected

### Defect

- description: release DB test scripts returned success when they safe-skipped, which could mask a missing isolated-database rehearsal during Phase 1H
- affected module: release validation / inventory DB test harness
- severity: high
- root cause: `scripts/run-phase-1g-reversal-db-tests.mjs` exited `0` when `PHASE_1G_DB_TESTS` was not set, and the package scripts invoked it without a strict mode

### Files Changed

- `package.json`
- `scripts/run-phase-1g-reversal-db-tests.mjs`
- `tests/inventory-helpers.test.ts`

### Database Impact

- none

### Test Added or Updated

- updated `tests/inventory-helpers.test.ts` to assert the package scripts use strict required mode and that the DB harness includes the new required-gate message

### Result

- `npm run test:inventory:db` now fails loudly when the isolated DB prerequisites are missing
- `npm run test:inventory:concurrency` now fails loudly when the isolated DB prerequisites are missing
- `npm run test:inventory` passes with the updated assertions

## Migration Execution Result

- `043`: not applied
- `044`: not applied
- `045`: not applied

Reason: isolated DB environment not available.

## Verdict

Phase 1H isolated database verification is not complete.

The next required step is operator provisioning of:

1. PostgreSQL 15 isolated test database
2. non-production `DATABASE_URL`
3. `PHASE_1G_DB_TESTS=1`
4. `PHASE_1G_DB_ISOLATED=1`
5. `psql` client on `PATH`
