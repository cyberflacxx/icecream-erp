# ERP Phase 1H Migration Rehearsal Fix Report

## Scope

- Repository: `icecream erp`
- Branch: `hotfix/phase-1h-rehearsal-fix`
- Base commit: `179f6679c03684c899b6f5addafce2506bfd7e04`
- Date: `2026-08-01`
- No migration was executed.
- No deployment or VPS action was performed.

## Fixed rehearsal blockers

1. `043_finance_chart_of_accounts_foundation.sql`
   - Fixed the PostgreSQL target-table alias violation in the accounts parent update at [migrations/043_finance_chart_of_accounts_foundation.sql](C:/Users/CyberFlacx/Desktop/desktttoop/icecream%20erp/migrations/043_finance_chart_of_accounts_foundation.sql:426).
   - Fixed the same pattern for cost centre parent updates at [migrations/043_finance_chart_of_accounts_foundation.sql](C:/Users/CyberFlacx/Desktop/desktttoop/icecream%20erp/migrations/043_finance_chart_of_accounts_foundation.sql:480).
   - Both statements now join through a non-target alias (`current_child`) so PostgreSQL 15 no longer sees invalid references in `JOIN ... ON`.

2. `044_atomic_inventory_posting_and_stock_ledger.sql`
   - Fixed the failing `stock_movements` backfill by moving warehouse branch lookups into `stock_movement_context` and joining that CTE back to the target table at [migrations/044_atomic_inventory_posting_and_stock_ledger.sql](C:/Users/CyberFlacx/Desktop/desktttoop/icecream%20erp/migrations/044_atomic_inventory_posting_and_stock_ledger.sql:104).
   - Qualified compile-time `%ROWTYPE` references for application tables such as `goods_received_notes`, `stock_balances`, `inventory_posting_runs`, `inventory_stock_takes`, `inventory_batches`, `stock_transfers`, and `stock_transfer_items` at lines `452`, `457`, `894`, `1243`, `1543`, `1774`, and `2027`.
   - This removes creation-time dependence on the session search path and keeps function compilation schema-local.

3. `045_inventory_operational_reversals.sql`
   - Added an explicit prerequisite guard so `045` fails immediately with a clear dependency message if `044` has not created `inventory_posting_runs`, `inventory_document_relationships`, `inventory_next_document_number(text)`, or `inventory_create_posted_journal(...)` yet at [migrations/045_inventory_operational_reversals.sql](C:/Users/CyberFlacx/Desktop/desktttoop/icecream%20erp/migrations/045_inventory_operational_reversals.sql:79).
   - This converts the previous downstream `relation does not exist` failure into a deterministic dependency error.

## Grant hardening

- `044` now explicitly revokes direct `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for:
  - `inventory_next_document_number`
  - `inventory_advisory_lock`
  - `inventory_create_posted_journal`
  - all five posting functions
  - both stock transfer atomic functions
- `045` now explicitly revokes direct `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for:
  - `inventory_assert_open_fiscal_period`
  - `inventory_reverse_posted_journal`
  - all five reversal RPCs
- Runtime grants remain limited to `service_role`.

## Verification script hardening

### `043_finance_chart_of_accounts_foundation.verify.sql`

Now fails loudly when any organization has:

- fewer than `110` seeded chart-of-accounts rows
- duplicate account codes
- `HEADER` accounts that still allow posting
- posting accounts without `normal_balance`
- fewer than `11` base cost centres
- fewer than `31` default ERP account mappings
- missing required mapping keys or mappings pointing to non-posting accounts

### `044_atomic_inventory_posting_and_stock_ledger.verify.sql`

Now fails loudly when any of the following is missing:

- required posting/helper functions
- `inventory_posting_runs`
- `inventory_document_relationships`
- required posting indexes
- required additive columns across stock balance, stock movement, stock take, stock adjustment, GRN, and transfer tables
- grant hygiene, if `PUBLIC`, `anon`, or `authenticated` still has direct `EXECUTE`

### `045_inventory_operational_reversals.verify.sql`

Now fails loudly when any of the following is missing:

- `inventory_document_relationships`
- `inventory_reversal_runs`
- required reversal functions
- required reversal indexes
- required GRN reversal columns
- grant hygiene, if `PUBLIC`, `anon`, or `authenticated` still has direct `EXECUTE`

## Files changed

- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
- `migrations/045_inventory_operational_reversals.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql`
- `migrations/manual/045_inventory_operational_reversals.verify.sql`
- `tests/finance-helpers.test.ts`
- `tests/inventory-helpers.test.ts`

## Commands executed and results

| Command | Result |
| --- | --- |
| `git status --short` | clean before changes; modified target files after hotfix work |
| `git branch --show-current` | `hotfix/phase-1h-rehearsal-fix` |
| `git rev-parse --verify 179f6679c03684c899b6f5addafce2506bfd7e04` | PASS |
| `npm run test:finance` | PASS |
| `npm run test:inventory` | PASS |
| `npm run test:procurement` | PASS |
| `npm run test:production` | PASS |
| `npm run test:sales` | PASS |
| `npm run test:branches` | PASS |
| `npm run lint` | PASS with two pre-existing warnings in `src/app/(dashboard)/maintenance/machines/page.tsx:150` and `src/app/(dashboard)/sales/customers/page.tsx:97` |
| `npm run build` | PASS |
| `git diff --check` | PASS; CRLF normalization warnings only |

## Outstanding limitations

- No isolated PostgreSQL rehearsal was run in this task.
- No `psql` migration application was performed.
- No verification SQL was executed against a restored production snapshot.
- Because of that, this hotfix is statically validated and repo-validated, but not yet database-rehearsal-validated.

## Production readiness verdict

`NOT READY TO CLAIM`

Reason: the code and verification assets are corrected and the repository checks passed, but a fresh isolated database rehearsal still needs to apply `043`, `044`, and `045` plus the manual verify SQL without errors before this can be called production-ready.
