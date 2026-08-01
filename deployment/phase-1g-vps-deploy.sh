#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd psql
require_cmd pg_dump
require_cmd sha256sum
require_cmd docker
require_cmd git

: "${DATABASE_URL:?DATABASE_URL is required}"

APP_RESTART_CMD="${APP_RESTART_CMD:-}"
HEALTH_URL="${PHASE_1G_HEALTH_URL:-}"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"

echo "== Phase 1G deployment =="
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
echo "commit: $(git rev-parse HEAD)"

echo "== Container check =="
docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'supabase-db|postgres|postgrest|supabase-rest' || {
  echo "Required database or PostgREST containers were not detected." >&2
  exit 1
}

echo "== Backup =="
BACKUP_FILE="$BACKUP_DIR/icecream_erp_phase1g_${STAMP}.dump"
pg_dump "$DATABASE_URL" --format=custom --file "$BACKUP_FILE"
echo "backup_file=$BACKUP_FILE"

echo "== Checksums =="
sha256sum migrations/043_finance_chart_of_accounts_foundation.sql
sha256sum migrations/044_atomic_inventory_posting_and_stock_ledger.sql
sha256sum migrations/045_inventory_operational_reversals.sql

echo "== Predeploy SQL =="
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f deployment/phase-1g-predeploy.sql

echo "== Apply 043 =="
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/043_finance_chart_of_accounts_foundation.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql

echo "== Apply 044 =="
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/044_atomic_inventory_posting_and_stock_ledger.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql

echo "== Apply 045 =="
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/045_inventory_operational_reversals.sql
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/manual/045_inventory_operational_reversals.verify.sql

if [[ -n "$APP_RESTART_CMD" ]]; then
  echo "== Restart application service =="
  bash -lc "$APP_RESTART_CMD"
fi

echo "== Postdeploy SQL =="
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f deployment/phase-1g-postdeploy.sql

if [[ -n "$HEALTH_URL" ]]; then
  echo "== Health check =="
  curl --fail --silent --show-error "$HEALTH_URL" >/dev/null
fi

echo "Phase 1G deployment script completed."
