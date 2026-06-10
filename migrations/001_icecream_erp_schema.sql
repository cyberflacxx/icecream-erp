-- ============================================================
-- icecream_erp schema — run against the shared Supabase VPS
-- See SHARED_DB_RULES.md before executing.
--
-- Run via:
--   docker exec supabase-db psql -U postgres -f /path/to/001_icecream_erp_schema.sql
-- ============================================================

-- Step 1: Create schema
CREATE SCHEMA IF NOT EXISTS icecream_erp;

-- Step 2: Users table
CREATE TABLE IF NOT EXISTS icecream_erp.users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      UUID        UNIQUE,                         -- Supabase auth.users.id
  work_id      VARCHAR(20) UNIQUE NOT NULL,                -- AQI-YYYYNNNN
  email        VARCHAR(255) NOT NULL,                      -- real email for communication
  full_name    VARCHAR(255) NOT NULL,
  first_name   VARCHAR(100),
  last_name    VARCHAR(100),
  phone        VARCHAR(50),
  avatar_url   TEXT,
  role         VARCHAR(30) NOT NULL DEFAULT 'staff'
    CHECK (role IN ('super_admin', 'branch_manager', 'manager', 'staff')),
  branch_id    UUID,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  id_number    VARCHAR(100),                               -- used to derive initial password
  created_by   UUID        REFERENCES icecream_erp.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast auth_id lookups (used on every request)
CREATE INDEX IF NOT EXISTS idx_icecream_users_auth_id ON icecream_erp.users (auth_id);
CREATE INDEX IF NOT EXISTS idx_icecream_users_work_id ON icecream_erp.users (work_id);

-- Step 3: Enable Row Level Security
ALTER TABLE icecream_erp.users ENABLE ROW LEVEL SECURITY;

-- service_role has full access (used by Next.js API routes)
CREATE POLICY "service_role_full_access"
  ON icecream_erp.users FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- authenticated users can read their own profile row
CREATE POLICY "authenticated_read_own"
  ON icecream_erp.users FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

-- anon: no access
CREATE POLICY "deny_anon"
  ON icecream_erp.users FOR ALL TO anon
  USING (false);

-- Step 4: Grants
GRANT USAGE ON SCHEMA icecream_erp TO anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA icecream_erp TO service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA icecream_erp TO service_role;
GRANT SELECT ON icecream_erp.users TO authenticated;

-- Step 5: Register schema with PostgREST (additive — does NOT overwrite other projects)
DO $$
DECLARE
  v_current text;
  v_schema  text := 'icecream_erp';
BEGIN
  SELECT split_part(cfg, '=', 2) INTO v_current
  FROM pg_roles, unnest(rolconfig) AS cfg
  WHERE rolname = 'authenticator'
    AND cfg LIKE 'pgrst.db_schemas=%';

  IF v_current IS NULL OR v_current = '' THEN
    v_current := 'public,storage,graphql_public,robocore,robokorda,aura,smartschools,azim_motors';
  END IF;

  IF position(v_schema IN v_current) = 0 THEN
    EXECUTE format(
      'ALTER ROLE authenticator SET "pgrst.db_schemas" TO %L',
      v_current || ',' || v_schema
    );
    RAISE NOTICE 'pgrst.db_schemas updated to: %', v_current || ',' || v_schema;
    NOTIFY pgrst;
  ELSE
    RAISE NOTICE 'Schema % already in pgrst.db_schemas — no change needed', v_schema;
  END IF;
END $$;
