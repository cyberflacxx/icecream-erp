# Absolute ERP VPS Rebuild Runbook

Current live state verified on July 12, 2026:

- `icecream_erp` already exists on the shared VPS.
- `pgrst.db_schemas` already includes `icecream_erp`.
- The live shared schema list is larger than the older canonical list in `SHARED_DB_RULES.md`:
  `public,storage,graphql_public,robocore,robokorda,aura,smartschools,azim_motors,icecream_erp,parks_connect,stockmind,luckystar_garage,id_core,ufic_smart_seating`
- `icecream_erp.roles = 9`
- `icecream_erp.branches = 1`
- `icecream_erp.users = 0`
- `icecream_erp.user_accounts = 0`
- No ERP core tables were found in `public`.

This runbook rebuilds only `icecream_erp`. It does not touch `public`, `auth`, `storage`, or any other project schema.

## Backup

Run on the VPS:

```bash
mkdir -p /root/migrations
BACKUP_TS="$(date +%Y%m%d_%H%M%S)"
docker exec supabase-db pg_dump -U supabase_admin -Fc --schema=icecream_erp postgres > "/root/migrations/icecream_erp_${BACKUP_TS}.dump"
docker exec supabase-db pg_dump -U supabase_admin --schema-only --schema=icecream_erp postgres > "/root/migrations/icecream_erp_${BACKUP_TS}_schema.sql"
```

## Rebuild

Copy the local rebuild assets to the VPS host:

```bash
mkdir -p /root/migrations/icecream-erp-rebuild
```

Copy these local files into `/root/migrations/icecream-erp-rebuild/`:

- `migrations/manual/icecream_erp_live_schema_20260712.sql`
- `migrations/manual/icecream_erp_live_seed_baseline_20260712.sql`
- `migrations/manual/rebuild_icecream_erp_safe.psql.sql`

Copy them into the database container:

```bash
docker exec supabase-db mkdir -p /tmp/icecream-erp-rebuild
docker cp /root/migrations/icecream-erp-rebuild/icecream_erp_live_schema_20260712.sql supabase-db:/tmp/icecream-erp-rebuild/icecream_erp_live_schema_20260712.sql
docker cp /root/migrations/icecream-erp-rebuild/icecream_erp_live_seed_baseline_20260712.sql supabase-db:/tmp/icecream-erp-rebuild/icecream_erp_live_seed_baseline_20260712.sql
docker cp /root/migrations/icecream-erp-rebuild/rebuild_icecream_erp_safe.psql.sql supabase-db:/tmp/icecream-erp-rebuild/rebuild_icecream_erp_safe.psql.sql
```

Run the rebuild:

```bash
docker exec supabase-db psql -U supabase_admin -f /tmp/icecream-erp-rebuild/rebuild_icecream_erp_safe.psql.sql
```

## Rollback

Use the latest backup file created in the backup step:

```bash
docker exec supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists --schema=icecream_erp /dev/stdin < /root/migrations/icecream_erp_YYYYMMDD_HHMMSS.dump
docker exec supabase-db psql -U supabase_admin -c "NOTIFY pgrst;"
```

## Verification

Schema isolation:

```bash
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT nspname FROM pg_namespace WHERE nspname IN ('public','icecream_erp') ORDER BY 1;"
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users','branches','roles','organizations','warehouses','items','stock_movements');"
```

PostgREST registration:

```bash
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT rolconfig FROM pg_roles WHERE rolname = 'authenticator';"
```

Expected on July 12, 2026:

- The returned `rolconfig` must still include all current shared schemas and `icecream_erp`.
- Do not replace the live list with the older shorter list.

Baseline data:

```bash
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT count(*) FROM icecream_erp.roles;"
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT count(*) FROM icecream_erp.branches;"
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT count(*) FROM icecream_erp.users;"
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT count(*) FROM icecream_erp.user_accounts;"
docker exec supabase-db psql -U supabase_admin -Atqc "SELECT code, name, status FROM icecream_erp.branches ORDER BY created_at, name;"
```

Expected:

- `icecream_erp.roles = 9`
- `icecream_erp.branches = 1`
- `icecream_erp.users = 0` unless you intentionally re-seed users after the rebuild
- `icecream_erp.user_accounts = 0`
- Branch row: `BR-MAIN | Main Branch | ACTIVE`

Smoke checks:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Accept-Profile: icecream_erp' \
  -H 'apikey: <anon-key>' \
  'http://localhost:8000/rest/v1/roles?select=id&limit=1'
```

Expected:

- `200` or `401/403` depending on the key and policies
- Not `406 PGRST106`
