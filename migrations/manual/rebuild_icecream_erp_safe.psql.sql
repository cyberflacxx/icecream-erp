\set ON_ERROR_STOP on

-- Safe full rebuild wrapper for the Absolute Ice Cream ERP schema only.
-- This file intentionally touches only the icecream_erp schema and the shared
-- PostgREST authenticator schema list via an additive read-modify-write block.
--
-- Before running:
-- 1. Back up only icecream_erp.
-- 2. Copy this repo's manual rebuild files into the container, for example:
--    /tmp/icecream-erp-rebuild/icecream_erp_live_schema_20260712.sql
--    /tmp/icecream-erp-rebuild/icecream_erp_live_seed_baseline_20260712.sql

DROP SCHEMA IF EXISTS "icecream_erp" CASCADE;

\i /tmp/icecream-erp-rebuild/icecream_erp_live_schema_20260712.sql
\i /tmp/icecream-erp-rebuild/icecream_erp_live_seed_baseline_20260712.sql

DO $$
DECLARE
  v_current text;
  v_schema text := 'icecream_erp';
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
  END IF;

  NOTIFY pgrst;
END $$;
