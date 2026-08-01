# Phase 1H Production Commands

These commands are for operator-controlled execution only.

Do not run them from Codex against production.

## 1. Isolated Rehearsal First

### Required environment

```bash
export PHASE_1G_DB_TESTS=1
export PHASE_1G_DB_ISOLATED=1
export DATABASE_URL='postgresql://<user>:<password>@<isolated-host>:5432/<isolated-db>'
export PHASE_1G_HEALTH_URL='https://<erp-host>/api/health'
```

### Confirm target is isolated and not production

```bash
python - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ['DATABASE_URL'])
print('database_host=', u.hostname)
print('database_name=', u.path.lstrip('/'))
print('production_target=', 'YES' if 'prod' in (u.hostname or '').lower() or 'prod' in u.path.lower() else 'NO')
PY
```

### Confirm PostgreSQL identity and schema

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select version();"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select current_schema();"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select filename, applied_at from public.schema_migrations order by filename;"
```

### Take isolated backup

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file "backups/icecream_erp_phase1h_isolated_$(date +%Y%m%d_%H%M%S).dump"
```

### Record checksums

```bash
sha256sum migrations/043_finance_chart_of_accounts_foundation.sql
sha256sum migrations/044_atomic_inventory_posting_and_stock_ledger.sql
sha256sum migrations/045_inventory_operational_reversals.sql
```

### Apply and verify in order

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/043_finance_chart_of_accounts_foundation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/044_atomic_inventory_posting_and_stock_ledger.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/045_inventory_operational_reversals.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.verify.sql
```

### Run real transaction and concurrency tests

```bash
npm run test:inventory:db
npm run test:inventory:concurrency
```

## 2. Production Window

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

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/043_finance_chart_of_accounts_foundation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/044_atomic_inventory_posting_and_stock_ledger.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/045_inventory_operational_reversals.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.verify.sql
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
