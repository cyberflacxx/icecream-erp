# ERP Phase 1H Migration Rehearsal Fix Report

## Scope

- Repository: `icecream erp`
- Branch: `hotfix/phase-1h-rehearsal-fix-2`
- Base production commit: `d8bb567f2385693645e5251e8df1c61f9a2d62db`
- Report date: `2026-08-01`
- No migration was executed.
- No deployment or VPS action was performed.

## Remaining rehearsal defects addressed

### 1. PostgreSQL 15 enum-in-transaction failure in 043

Observed failure:

```text
ERROR: unsafe use of new value "HEADER" of enum type icecream_erp.account_type
HINT: New enum values must be committed before they can be used.
```

Fix:

- Added a committed prerequisite migration: `migrations/042a_finance_account_type_enum_prerequisites.sql`
- The prerequisite adds all enum labels that `043` uses:
  - `HEADER`
  - `CONTRA_ASSET`
  - `CONTRA_REVENUE`
  - `OTHER_INCOME`
- Added `migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql`
- Removed enum-label creation from `043`
- Added an explicit prerequisite assertion inside `043` so it fails with a directed message if `042a` was not applied first

Result:

- `043` no longer depends on adding and using enum labels in the same transaction.
- The deployment contract is now explicit: `042a` must be applied and committed before `043`.

### 2. `stock_movements.updated_at` assumption in 044

Observed failure:

```text
ERROR: column "updated_at" of relation "stock_movements" does not exist
```

Static schema audit:

- The restored compatibility migrations add many `stock_movements` columns, but they do not establish `stock_movements.updated_at` as a guaranteed column.
- The top-level backfill in `044` was still assigning `updated_at = now()` unconditionally.

Fix:

- Replaced the top-level `stock_movements` backfill with a guarded `DO` block and dynamic SQL
- `044` now:
  - asserts the required legacy source columns exist before the backfill runs
  - checks whether `stock_movements.updated_at` exists
  - includes `updated_at = now()` only when that column is present
- No new `updated_at` column was added to `stock_movements`

Result:

- `044` is safe on restored production snapshots where `stock_movements.updated_at` is absent.
- `044` remains safe on fresher schemas where `updated_at` does exist.

### 3. 045 dependency refusal

`045` already had the correct protective behavior: it refused to proceed if `044` had not created `inventory_posting_runs`.

Status:

- Preserved.
- No change to the dependency intent.

## Verification hardening

### Added

- `migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql`

### Updated

- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
  - now raises if `icecream_erp.account_type` is missing
  - now raises if the prerequisite enum labels are missing
- `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql`
  - preserved fail-loud behavior
  - continues to treat `stock_movements.updated_at` as optional, not required

## Rehearsal runner

Added:

- `deployment/run-phase1h-isolated-rehearsal.sh`

Runner behavior:

- requires `PHASE_1H_DB_ISOLATED=1`
- requires `DATABASE_URL`
- parses the target database from `DATABASE_URL`
- refuses database name `postgres`
- refuses production-like host or database names containing `prod`, `production`, or `live`
- runs `042a` without `--single-transaction`
- runs `043`, `044`, `045`, and all verify files with `--single-transaction`
- stops immediately on the first failed migration or verify file
- prints `PASSED` only when every step succeeds
- does not use `( ... ) || echo`

## Deployment order

Exact order:

1. `migrations/042a_finance_account_type_enum_prerequisites.sql`
2. `migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql`
3. `migrations/043_finance_chart_of_accounts_foundation.sql`
4. `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
5. `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
6. `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql`
7. `migrations/045_inventory_operational_reversals.sql`
8. `migrations/manual/045_inventory_operational_reversals.verify.sql`

## Files changed

- `migrations/042a_finance_account_type_enum_prerequisites.sql`
- `migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql`
- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
- `deployment/run-phase1h-isolated-rehearsal.sh`
- `deployment/PHASE_1H_PRODUCTION_COMMANDS.md`
- `tests/finance-helpers.test.ts`
- `tests/inventory-helpers.test.ts`

## Commands executed and results

| Command | Result |
| --- | --- |
| `git checkout -b hotfix/phase-1h-rehearsal-fix-2 d8bb567` | PASS |
| `npm run test:finance` | PASS |
| `npm run test:inventory` | PASS |
| `npm run test:procurement` | PASS |
| `npm run test:production` | PASS |
| `npm run test:sales` | PASS |
| `npm run test:branches` | PASS |
| `npm run lint` | PASS with pre-existing React Hooks warnings in `src/app/(dashboard)/maintenance/machines/page.tsx:150` and `src/app/(dashboard)/sales/customers/page.tsx:97` |
| `npm run build` | PASS |
| `git diff --check` | PASS; Git reported only LF-to-CRLF working-tree warnings, not patch-format defects |

## Current readiness verdict

`NOT READY TO CLAIM`

Reason:

- The migration assets are corrected for the observed PostgreSQL 15 rehearsal failures.
- A fresh isolated rehearsal still needs to apply `042a`, `043`, `044`, and `045` in order, with all verify SQL succeeding, before this can be called production-ready.
