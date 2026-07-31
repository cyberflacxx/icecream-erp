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

require_cmd git
require_cmd rg
require_cmd sort
require_cmd uniq
require_cmd awk
require_cmd docker
require_cmd psql

psql_readonly() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt "$@"
  else
    psql -X -v ON_ERROR_STOP=1 -qAt "$@"
  fi
}

echo "== Repository =="
echo "branch: $(git rev-parse --abbrev-ref HEAD)"
echo "commit: $(git rev-parse HEAD)"

[[ -f migrations/042_production_reopen_and_relationship_links.sql ]] || {
  echo "Missing migrations/042_production_reopen_and_relationship_links.sql" >&2
  exit 1
}
[[ -f migrations/041_revoke_browser_posting_internal_grants.sql ]] || {
  echo "Missing migrations/041_revoke_browser_posting_internal_grants.sql" >&2
  exit 1
}

duplicate_prefixes="$(
  find migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' -printf '%f\n' |
    cut -c1-3 |
    sort |
    uniq -d
)"
if [[ -n "$duplicate_prefixes" ]]; then
  echo "Duplicate migration prefixes detected:" >&2
  echo "$duplicate_prefixes" >&2
  exit 1
fi

if rg -n "041_production_reopen_and_relationship_links\.sql" .; then
  echo "Old migration 041 Production filename reference still exists." >&2
  exit 1
fi

echo "== Containers =="
PG_CONTAINER="${PG_CONTAINER:-$(docker ps --format '{{.Names}} {{.Image}}' | awk 'BEGIN{IGNORECASE=1} /postgres|supabase-db|db/ {print $1; exit}')}"
POSTGREST_CONTAINER="${POSTGREST_CONTAINER:-$(docker ps --format '{{.Names}} {{.Image}}' | awk 'BEGIN{IGNORECASE=1} /postgrest/ {print $1; exit}')}"

[[ -n "$PG_CONTAINER" ]] || {
  echo "Could not detect a running PostgreSQL container. Set PG_CONTAINER explicitly." >&2
  exit 1
}
[[ -n "$POSTGREST_CONTAINER" ]] || {
  echo "Could not detect a running PostgREST container. Set POSTGREST_CONTAINER explicitly." >&2
  exit 1
}

echo "postgres container: $PG_CONTAINER"
echo "postgrest container: $POSTGREST_CONTAINER"
docker exec "$PG_CONTAINER" psql --version

echo "== PostgREST schemas =="
POSTGREST_SCHEMAS="$(docker exec "$POSTGREST_CONTAINER" /bin/sh -lc 'printf "%s" "${PGRST_DB_SCHEMAS:-${DB_SCHEMAS:-}}"' 2>/dev/null || true)"
[[ "$POSTGREST_SCHEMAS" == *icecream_erp* ]] || {
  echo "PostgREST schema configuration does not include icecream_erp." >&2
  exit 1
}
echo "PGRST_DB_SCHEMAS=$POSTGREST_SCHEMAS"

echo "== Database checks =="
psql_readonly <<'SQL'
select 'postgres_version=' || version();

select 'schema_owner=' || n.nspname || ':' || pg_get_userbyid(n.nspowner)
from pg_namespace n
where n.nspname = 'icecream_erp';

select 'production_tables=' || string_agg(table_name, ',')
from information_schema.tables
where table_schema = 'icecream_erp'
  and table_name in (
    'production_orders',
    'production_order_components',
    'production_order_status_history',
    'production_issues',
    'production_issue_lines',
    'production_receipts',
    'production_receipt_lines',
    'production_document_links'
  );

select 'production_rpcs=' || string_agg(proname || '(' || oidvectortypes(proargtypes) || ')', ';')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'icecream_erp'
  and proname in (
    'save_planned_production_order',
    'release_production_order',
    'post_production_issue',
    'post_production_receipt',
    'close_production_order',
    'reverse_production_issue',
    'reverse_production_receipt',
    'reopen_production_order'
  );

select 'service_role_exec=' || string_agg(routine_name, ',')
from information_schema.role_routine_grants
where routine_schema = 'icecream_erp'
  and grantee = 'service_role'
  and privilege_type = 'EXECUTE'
  and routine_name in (
    'save_planned_production_order',
    'release_production_order',
    'post_production_issue',
    'post_production_receipt',
    'close_production_order',
    'reverse_production_issue',
    'reverse_production_receipt',
    'reopen_production_order'
  );

select 'posting_rpc_non_service_grants=' || coalesce(string_agg(routine_name || ':' || grantee, ','), 'none')
from information_schema.role_routine_grants
where routine_schema = 'icecream_erp'
  and grantee in ('public', 'anon', 'authenticated')
  and privilege_type = 'EXECUTE'
  and routine_name in (
    'save_planned_production_order',
    'release_production_order',
    'post_production_issue',
    'post_production_receipt',
    'close_production_order',
    'reverse_production_issue',
    'reverse_production_receipt',
    'reopen_production_order'
  );

select 'required_master_data=' || json_build_object(
  'active_recipes', (
    select count(*)
    from icecream_erp.recipes
    where deleted_at is null
      and upper(coalesce(status::text, '')) = 'ACTIVE'
  )::text,
  'finished_goods', (
    select count(*)
    from icecream_erp.items
    where upper(coalesce(item_type, type::text, '')) = 'FINISHED_GOOD'
      and coalesce(is_active, true) = true
  )::text,
  'active_users_with_accounts', (
    select count(*)
    from icecream_erp.users
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and coalesce(user_account_id, id) is not null
  )::text,
  'warehouses', (
    select count(*)
    from icecream_erp.warehouses
  )::text
)::text;

select 'production_row_counts=' || json_build_object(
  'production_orders', (select count(*) from icecream_erp.production_orders)::text,
  'production_order_components', (select count(*) from icecream_erp.production_order_components)::text,
  'production_order_status_history', (select count(*) from icecream_erp.production_order_status_history)::text,
  'production_issues', (select count(*) from icecream_erp.production_issues)::text,
  'production_receipts', (select count(*) from icecream_erp.production_receipts)::text,
  'production_document_links', (select count(*) from icecream_erp.production_document_links)::text
)::text;
SQL

echo "verify-production-vps-readiness.sh completed without modifying the database."
