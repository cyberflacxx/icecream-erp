# ERP Phase 1H Migration Rehearsal Fix Report

## Scope

- Repository: `icecream erp`
- Branch: `hotfix/phase-1h-branch-cost-centre-filter`
- Base production commit: `1c12ce130c2a68908043a32d2324695e7a6fe5a6`
- Report date: `2026-08-01`
- No migration was executed.
- No deployment or VPS action was performed.

## Defect addressed in this hotfix

Observed isolated rehearsal failure in `043_finance_chart_of_accounts_foundation.sql`:

```text
where branch.is_active = true
```

Actual restored production schema for `icecream_erp.branches` does not contain `is_active`. The production-safe branch filter is:

```sql
branch.status = 'ACTIVE'::icecream_erp.branch_status
and branch.deleted_at is null
```

## Migration 043 correction

Updated `migrations/043_finance_chart_of_accounts_foundation.sql` so branch cost-centre seeding:

- removes every `branch.is_active` reference
- uses `branch.status = 'ACTIVE'::icecream_erp.branch_status`
- uses `branch.deleted_at is null`
- keeps branch rows scoped by `branch.organization_id`
- preserves idempotent insertion by checking existing `cost_centres` rows on:
  - `existing.organization_id = centre.organization_id`
  - `existing.branch_id = centre.branch_id`

Result:

- one branch cost centre is seeded per active, non-deleted branch
- inactive and deleted branches are excluded from required seeding
- the migration does not alter `icecream_erp.branches`

## Verification hardening for 043

Updated `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql` to raise exceptions when:

- an active, non-deleted branch lacks a branch cost centre
- duplicate branch cost centres exist for the same branch
- a branch cost centre references a missing branch
- a branch cost centre belongs to a different organization than its branch
- a deleted branch has been seeded as a branch cost centre

The verification logic now only requires branch cost centres for:

- `branch.status = 'ACTIVE'::icecream_erp.branch_status`
- `branch.deleted_at is null`

That means inactive branches are not treated as required by verification.

## Files changed

- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `tests/finance-helpers.test.ts`
- `ERP_PHASE_1H_MIGRATION_REHEARSAL_FIX_REPORT.md`

## Deployment commands document

`deployment/PHASE_1H_PRODUCTION_COMMANDS.md` was reviewed and did not require changes for this hotfix.

The Phase 1H execution order remains:

1. `042a_finance_account_type_enum_prerequisites.sql`
2. `042a_finance_account_type_enum_prerequisites.verify.sql`
3. `043_finance_chart_of_accounts_foundation.sql`
4. `043_finance_chart_of_accounts_foundation.verify.sql`
5. `044_atomic_inventory_posting_and_stock_ledger.sql`
6. `044_atomic_inventory_posting_and_stock_ledger.verify.sql`
7. `045_inventory_operational_reversals.sql`
8. `045_inventory_operational_reversals.verify.sql`

## Commands executed and results

| Command | Result |
| --- | --- |
| `git worktree add -b hotfix/phase-1h-branch-cost-centre-filter "<worktree>" 1c12ce1` | PASS |
| `npm ci` | PASS with existing engine warning (`package.json` requires Node `22.x`, local runtime was Node `20.19.6`) |
| `npm run test:finance` | PASS |
| `npm run test:inventory` | PASS |
| `npm run test:procurement` | PASS |
| `npm run test:production` | PASS |
| `npm run test:sales` | PASS |
| `npm run test:branches` | PASS |
| `npm run lint` | PASS with pre-existing React Hooks warnings in `src/app/(dashboard)/maintenance/machines/page.tsx:150` and `src/app/(dashboard)/sales/customers/page.tsx:97` |
| `npm run build` | PASS with existing Next.js lockfile patch and Edge-runtime warnings; no build failure |
| `git diff --check` | PASS; Git reported only LF-to-CRLF working-tree warnings, not patch-format defects |

## Current readiness verdict

`NO`

Reason:

- `043` now matches the restored production `branches` schema and the strengthened verification covers the branch cost-centre failure mode.
- Production readiness remains `NO` until a fresh isolated rehearsal passes in this exact order:
  - `042a -> verify -> 043 -> verify -> 044 -> verify -> 045 -> verify`
