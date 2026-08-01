# Phase 1G Production Deployment Checklist

Date: 2026-08-01
Branch: `fix/sales-invoice-production`

## Scope

Phase 1G deployment includes:

- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
- `migrations/045_inventory_operational_reversals.sql`
- corresponding manual verification SQL
- application code for inventory posting and reversal workflows

`045` is included even though the original deployment request named `043` and `044`, because the new reversal APIs depend on the `045` database objects.

## Hard stops

- Do not run against production without a verified backup.
- Do not run `docker compose down -v`.
- Do not alter shared PostgREST schema configuration.
- Do not alter `authenticator.rolconfig`.
- Do not proceed if any verification step fails.

## Required order

1. Confirm the working tree and release artifact are the intended revision.
2. Confirm `supabase-db` and `supabase-rest` containers are healthy.
3. Capture the current migration inventory.
4. Capture database backup and rollback point.
5. Record SHA-256 checksums for `043`, `044`, and `045`.
6. Run `deployment/phase-1g-predeploy.sql`.
7. Apply `043`.
8. Run `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`.
9. Apply `044`.
10. Run `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql`.
11. Run `migrations/manual/044_atomic_inventory_posting_and_stock_ledger.vps-transaction-test.sql` only on isolated rehearsal data.
12. Apply `045`.
13. Run `migrations/manual/045_inventory_operational_reversals.verify.sql`.
14. Run `migrations/manual/045_inventory_operational_reversals.vps-transaction-test.sql` only on isolated rehearsal data.
15. Deploy application code.
16. Restart only the required application service.
17. Run `deployment/phase-1g-postdeploy.sql`.
18. Run `deployment/phase-1g-smoke-test.ps1`.
19. Verify API health, PostgREST RPC exposure, and financial reconciliation.
20. Reopen users.

## Backup commands

Preferred:

```bash
pg_dump "$DATABASE_URL" --format=custom --file "backups/icecream_erp_phase1g_$(date +%Y%m%d_%H%M%S).dump"
```

Fallback schema snapshot:

```bash
pg_dump "$DATABASE_URL" --schema=icecream_erp --schema-only > "backups/icecream_erp_phase1g_schema_$(date +%Y%m%d_%H%M%S).sql"
```

## Rollback decision guide

Rollback is required when any of these occur:

- migration apply failure after partial execution
- verification SQL missing expected functions, columns, or grants
- PostgREST fails to expose required RPCs after schema reload
- smoke tests show broken GRN posting, transfer posting, or reversal behavior
- finance reconciliation shows unexplained journal imbalance

## Rollback commands

Application first:

```bash
git checkout <last-known-good-release>
```

Database, only in a controlled maintenance window:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.rollback.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.rollback.sql
```

Restore from backup if rollback SQL is not sufficient:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" "backups/<captured-file>.dump"
```

## Production health checks

- `journal_entries` still balance
- `inventory_posting_runs` and `inventory_reversal_runs` are writable
- GRN post route returns journal IDs
- transfer receipt route supports partial receipt
- reversal routes reject duplicate requests
- stock movement ledger shows reversal references
- General Ledger reflects reversal journals
- branch-scoped users remain branch-limited
