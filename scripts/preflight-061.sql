-- Read-only preflight for migration 061.
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preflight-061.sql

set search_path = icecream_erp, public;

\echo '061_PREFLIGHT required_tables'
select table_name, to_regclass(format('icecream_erp.%I', table_name)) is not null as exists
from (values
  ('organizations'),
  ('users'),
  ('items'),
  ('units_of_measure'),
  ('purchase_order_items'),
  ('goods_received_note_items'),
  ('stock_movements'),
  ('production_issue_lines'),
  ('recipes'),
  ('production_orders'),
  ('production_batches')
) as required(table_name)
order by table_name;

\echo '061_PREFLIGHT affected_table_row_counts'
select relname as table_name, n_live_tup::bigint as estimated_rows
from pg_stat_user_tables
where schemaname = 'icecream_erp'
  and relname in (
    'units_of_measure',
    'item_uom_conversions',
    'purchase_order_items',
    'goods_received_note_items',
    'stock_movements',
    'production_issue_lines',
    'recipes',
    'recipe_version_history',
    'production_orders',
    'production_batches'
  )
order by relname;

\echo '061_PREFLIGHT required_columns'
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'icecream_erp'
  and table_name in (
    'units_of_measure',
    'items',
    'purchase_order_items',
    'goods_received_note_items',
    'stock_movements',
    'production_issue_lines',
    'recipes',
    'production_orders',
    'production_batches'
  )
  and column_name in (
    'id',
    'organization_id',
    'unit_type',
    'dimension',
    'symbol',
    'unit_of_measure_id',
    'unit_id',
    'uom_id',
    'transaction_quantity',
    'transaction_uom_id',
    'base_quantity',
    'base_uom_id',
    'uom_conversion_factor',
    'recipe_id',
    'bom_id',
    'status',
    'created_at'
  )
order by table_name, column_name;

\echo '061_PREFLIGHT existing_indexes'
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'icecream_erp'
  and (
    tablename in ('item_uom_conversions', 'recipe_version_history')
    or indexname in (
      'item_uom_conversions_unique_active',
      'item_uom_conversions_item_idx',
      'item_uom_conversions_unit_pair_idx',
      'recipe_version_history_recipe_idx'
    )
  )
order by tablename, indexname;

\echo '061_PREFLIGHT existing_constraints'
select
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'icecream_erp'::regnamespace
  and conrelid::regclass::text in (
    'icecream_erp.item_uom_conversions',
    'icecream_erp.recipe_version_history',
    'icecream_erp.purchase_order_items',
    'icecream_erp.goods_received_note_items',
    'icecream_erp.stock_movements',
    'icecream_erp.production_issue_lines'
  )
order by table_name, constraint_name;

\echo '061_PREFLIGHT duplicate_item_uom_conversion_candidates'
select (to_regclass('icecream_erp.item_uom_conversions') is not null) as item_uom_conversions_exists \gset
\if :item_uom_conversions_exists
select
  organization_id,
  item_id,
  from_uom_id,
  to_uom_id,
  count(*) as active_count
from icecream_erp.item_uom_conversions
where is_active is true
group by organization_id, item_id, from_uom_id, to_uom_id
having count(*) > 1;
\else
select 'item_uom_conversions table does not exist yet' as note;
\endif

\echo '061_PREFLIGHT existing_legacy_unit_conversion_duplicates'
select (to_regclass('icecream_erp.unit_conversions') is not null) as unit_conversions_exists \gset
\if :unit_conversions_exists
select
  organization_id,
  from_unit_id,
  to_unit_id,
  count(*) as row_count
from icecream_erp.unit_conversions
where is_active is true
group by organization_id, from_unit_id, to_unit_id
having count(*) > 1;
\else
select 'unit_conversions table does not exist' as note;
\endif

\echo '061_PREFLIGHT production_recipe_bom_counts'
select 'recipes_total' as metric, count(*)::bigint as value from icecream_erp.recipes
union all
select 'recipes_active', count(*)::bigint from icecream_erp.recipes where coalesce(status::text, '') in ('ACTIVE', 'active')
union all
select 'production_orders_active', count(*)::bigint from icecream_erp.production_orders where coalesce(status::text, '') not in ('COMPLETED', 'CANCELLED', 'CLOSED')
union all
select 'production_orders_historical', count(*)::bigint from icecream_erp.production_orders where coalesce(status::text, '') in ('COMPLETED', 'CANCELLED', 'CLOSED')
union all
select 'production_batches_total', count(*)::bigint from icecream_erp.production_batches;

\echo '061_PREFLIGHT nullable_compatibility'
select
  table_name,
  column_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'icecream_erp'
  and table_name in ('organizations', 'users', 'items', 'units_of_measure', 'recipes')
  and column_name = 'id'
order by table_name;

\echo '061_PREFLIGHT blocking_conditions'
select 'missing_units_of_measure_table' as condition, to_regclass('icecream_erp.units_of_measure') is null as blocks_migration
union all
select 'missing_items_table', to_regclass('icecream_erp.items') is null
union all
select 'missing_recipes_table', to_regclass('icecream_erp.recipes') is null
union all
select 'missing_organizations_table', to_regclass('icecream_erp.organizations') is null
union all
select 'missing_users_table', to_regclass('icecream_erp.users') is null;
