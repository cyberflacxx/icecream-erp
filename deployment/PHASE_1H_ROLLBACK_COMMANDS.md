# Phase 1H Rollback Commands

These commands are for operator-controlled rollback only.

Do not run them from Codex against production.

## 1. Immediate Stop Conditions

Rollback must be prepared or executed when any of these occur:

- migration apply failure after partial execution
- verification SQL failure
- PostgREST health failure after migration
- failed transaction or concurrency rehearsal
- failed production smoke tests
- unbalanced Trial Balance
- unexplained inventory reconciliation variance

## 2. Application Rollback

```bash
git checkout <last-known-good-release-tag-or-commit>
npm ci
npm run build
sudo systemctl restart <erp-service>
```

## 3. Database Rollback SQL

Run only in a controlled maintenance window, newest layer first:

```bash
export DATABASE_URL='postgresql://<user>:<password>@<host>:5432/<db>'

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.rollback.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.rollback.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql
```

## 4. Restore From Backup

If rollback SQL is not sufficient:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" "backups/<captured-backup>.dump"
```

## 5. Post-Rollback Verification

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select filename, applied_at from public.schema_migrations order by filename;"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select current_schema();"
curl --fail --silent --show-error "https://<erp-host>/api/health"
```

## 6. Manual Checks After Rollback

- confirm ERP service restarted successfully
- confirm API health
- confirm PostgREST health
- confirm users remain blocked until reconciliation is complete
- confirm Trial Balance is balanced
- confirm inventory reconciliation is acceptable
- confirm no partial posting or reversal jobs remain open
