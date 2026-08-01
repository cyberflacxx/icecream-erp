# Phase 1H Production Commands

These commands are for operator-controlled execution only.

Do not run them from Codex against production.

## 1. Exact migration order

Phase 1H must be applied in this order:

1. `migrations/042a_finance_account_type_enum_prerequisites.sql`
2. `migrations/043_finance_chart_of_accounts_foundation.sql`
3. `migrations/044_atomic_inventory_posting_and_stock_ledger.sql`
4. `migrations/045_inventory_operational_reversals.sql`

Reason: PostgreSQL 15 requires the new `icecream_erp.account_type` labels to be committed before `043` uses them.

## 2. Isolated rehearsal first

### Required environment

```bash
export PHASE_1H_DB_ISOLATED=1
export PHASE_1G_DB_TESTS=1
export PHASE_1G_DB_ISOLATED=1
export DATABASE_URL='postgresql://<user>:<password>@<isolated-host>:5432/<isolated-db>'
export PHASE_1G_HEALTH_URL='https://<erp-host>/api/health'
```

### Confirm target is isolated and not production

```bash
node -e "const u=new URL(process.env.DATABASE_URL); const db=decodeURIComponent((u.pathname||'').replace(/^\\//,'')); console.log('database_host=', u.hostname || ''); console.log('database_name=', db); console.log('explicit_isolated_flag=', process.env.PHASE_1H_DB_ISOLATED || '0'); console.log('production_target=', /(prod|production|live)/i.test((u.hostname||'') + ' ' + db) ? 'YES' : 'NO');"
```

### Confirm PostgreSQL identity and schema

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select version();"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select current_database(), current_schema();"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select filename, applied_at from public.schema_migrations order by filename;"
```

### Take isolated backup

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file "backups/icecream_erp_phase1h_isolated_$(date +%Y%m%d_%H%M%S).dump"
```

### Record checksums

```bash
sha256sum migrations/042a_finance_account_type_enum_prerequisites.sql
sha256sum migrations/043_finance_chart_of_accounts_foundation.sql
sha256sum migrations/044_atomic_inventory_posting_and_stock_ledger.sql
sha256sum migrations/045_inventory_operational_reversals.sql
```

### Preferred isolated rehearsal runner

```bash
bash deployment/run-phase1h-isolated-rehearsal.sh
```

### Manual isolated rehearsal equivalent

`042a` must not be wrapped in `--single-transaction`.

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/042a_finance_account_type_enum_prerequisites.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/043_finance_chart_of_accounts_foundation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/044_atomic_inventory_posting_and_stock_ledger.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/045_inventory_operational_reversals.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/045_inventory_operational_reversals.verify.sql
```

### Run real transaction and concurrency tests

```bash
npm run test:inventory:db
npm run test:inventory:concurrency
```

## 3. Production window

### Enter maintenance mode and back up

```bash
export DATABASE_URL='postgresql://<user>:<password>@<prod-host>:5432/<prod-db>'
export PHASE_1G_HEALTH_URL='https://<erp-host>/api/health'
export APP_RESTART_CMD='sudo systemctl restart <erp-service>'

mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file "backups/icecream_erp_phase1h_prod_$(date +%Y%m%d_%H%M%S).dump"
git rev-parse HEAD
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select filename, applied_at from public.schema_migrations order by filename;"
```

### Predeploy inspection

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f deployment/phase-1g-predeploy.sql
```

### Apply migrations and verify

`042a` must be committed before `043`. Keep `043` through `045` transactional.

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/042a_finance_account_type_enum_prerequisites.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/043_finance_chart_of_accounts_foundation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/044_atomic_inventory_posting_and_stock_ledger.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/045_inventory_operational_reversals.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f migrations/manual/045_inventory_operational_reversals.verify.sql
```

### Rehearsal-only SQL tests on non-production data only

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.vps-transaction-test.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.vps-transaction-test.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.vps-concurrency-test.sql
```

### Deploy application code and restart ERP service only

```bash
git fetch origin
git checkout fix/sales-invoice-production
git pull --ff-only origin fix/sales-invoice-production
npm ci
npm run build
bash -lc "$APP_RESTART_CMD"
```

### Postdeploy verification

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f deployment/phase-1g-postdeploy.sql
powershell -ExecutionPolicy Bypass -File deployment/phase-1g-smoke-test.ps1 -DatabaseUrl "$DATABASE_URL" -HealthUrl "$PHASE_1G_HEALTH_URL"
curl --fail --silent --show-error "$PHASE_1G_HEALTH_URL"
```

### Final reopen gate

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select count(*) from icecream_erp.inventory_posting_runs;"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select count(*) from icecream_erp.inventory_reversal_runs;"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select sum(total_debit) - sum(total_credit) as journal_variance from icecream_erp.journal_entries where coalesce(is_posted, false) = true;"
```

Only reopen users after Procurement, Production, Inventory, Sales, reversal, Trial Balance, and inventory reconciliation checks all pass.
