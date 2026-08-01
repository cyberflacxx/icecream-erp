#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "FAILED: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_command psql
require_command node

DATABASE_URL="${DATABASE_URL:-}"
PHASE_1H_DB_ISOLATED="${PHASE_1H_DB_ISOLATED:-0}"

[[ -n "$DATABASE_URL" ]] || fail "DATABASE_URL is required."
[[ "$PHASE_1H_DB_ISOLATED" == "1" ]] || fail "Set PHASE_1H_DB_ISOLATED=1 to confirm an isolated non-production target."

read -r DB_HOST DB_NAME < <(
  node -e "const raw = process.env.DATABASE_URL; const url = new URL(raw); const dbName = decodeURIComponent((url.pathname || '').replace(/^\\//, '')); console.log((url.hostname || '') + ' ' + dbName);"
) || fail "Unable to parse DATABASE_URL."

[[ -n "$DB_NAME" ]] || fail "DATABASE_URL must include a database name."
[[ "$DB_NAME" != "postgres" ]] || fail "Refusing to run against database name postgres."

if [[ "$DB_HOST" =~ (^|[-.])(prod|production|live)([-.]|$) ]] || [[ "$DB_NAME" =~ (^|[-_])(prod|production|live)([-_]|$) ]]; then
  fail "Refusing to run against a production-like target: host=$DB_HOST database=$DB_NAME"
fi

run_sql_non_transaction() {
  local label="$1"
  local file="$2"
  echo "RUN: $label"
  echo "  file: $file"
  if ! psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$file"; then
    fail "$label failed"
  fi
}

run_sql_single_transaction() {
  local label="$1"
  local file="$2"
  echo "RUN: $label"
  echo "  file: $file"
  if ! psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$file"; then
    fail "$label failed"
  fi
}

echo "Phase 1H isolated rehearsal target"
echo "  host: $DB_HOST"
echo "  database: $DB_NAME"

CURRENT_DB="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select current_database();")" || fail "Could not read current database identity."
[[ "$CURRENT_DB" == "$DB_NAME" ]] || fail "Connected database $CURRENT_DB does not match DATABASE_URL database $DB_NAME."
[[ "$CURRENT_DB" != "postgres" ]] || fail "Refusing to run against database name postgres."

run_sql_non_transaction "042a enum prerequisite" "migrations/042a_finance_account_type_enum_prerequisites.sql"
run_sql_single_transaction "042a enum prerequisite verify" "migrations/manual/042a_finance_account_type_enum_prerequisites.verify.sql"

run_sql_single_transaction "043 finance foundation" "migrations/043_finance_chart_of_accounts_foundation.sql"
run_sql_single_transaction "043 finance foundation verify" "migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql"

run_sql_single_transaction "044 atomic inventory posting" "migrations/044_atomic_inventory_posting_and_stock_ledger.sql"
run_sql_single_transaction "044 atomic inventory posting verify" "migrations/manual/044_atomic_inventory_posting_and_stock_ledger.verify.sql"

run_sql_single_transaction "045 inventory reversals" "migrations/045_inventory_operational_reversals.sql"
run_sql_single_transaction "045 inventory reversals verify" "migrations/manual/045_inventory_operational_reversals.verify.sql"

echo "PASSED"
