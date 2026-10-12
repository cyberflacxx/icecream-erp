-- READ ONLY preflight for migration 062_production_uom_rpc_support.sql.
-- Run with psql before applying 062. This script does not modify data or schema.

\echo '== 062 production UOM RPC support preflight =='

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'icecream_erp'
  and p.proname in ('post_production_issue', 'resolve_item_uom_base_quantity')
order by p.proname, arguments;

select
  required.object_type,
  required.object_name,
  case
    when required.object_type = 'table' then to_regclass('icecream_erp.' || required.object_name)::text is not null
    when required.object_type = 'function' then exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'icecream_erp'
        and p.proname = required.object_name
    )
    else false
  end as exists
from (values
  ('table', 'production_orders'),
  ('table', 'production_order_components'),
  ('table', 'production_issues'),
  ('table', 'production_issue_lines'),
  ('table', 'stock_balances'),
  ('table', 'stock_movements'),
  ('table', 'items'),
  ('table', 'item_uom_conversions'),
  ('table', 'units_of_measure'),
  ('function', 'post_production_issue')
) as required(object_type, object_name)
order by required.object_type, required.object_name;

select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'icecream_erp'
  and (
    (c.table_name = 'items' and c.column_name in ('id', 'organization_id', 'unit_of_measure_id')) or
    (c.table_name = 'item_uom_conversions' and c.column_name in ('organization_id', 'item_id', 'from_uom_id', 'to_uom_id', 'conversion_factor', 'is_active')) or
    (c.table_name = 'stock_movements' and c.column_name in ('transaction_quantity', 'transaction_uom_id', 'base_quantity', 'base_uom_id', 'uom_conversion_factor')) or
    (c.table_name = 'production_issue_lines' and c.column_name in ('transaction_quantity', 'transaction_uom_id', 'base_quantity', 'base_uom_id', 'uom_conversion_factor'))
  )
order by c.table_name, c.column_name;

select 'production_orders' as table_name, count(*) as row_count from icecream_erp.production_orders
union all
select 'production_order_components', count(*) from icecream_erp.production_order_components
union all
select 'production_issues', count(*) from icecream_erp.production_issues
union all
select 'production_issue_lines', count(*) from icecream_erp.production_issue_lines
union all
select 'stock_balances', count(*) from icecream_erp.stock_balances
union all
select 'stock_movements', count(*) from icecream_erp.stock_movements
union all
select 'item_uom_conversions', count(*) from icecream_erp.item_uom_conversions;

select
  case when exists (
    select 1
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and table_name = 'items'
      and column_name = 'unit_of_measure_id'
  ) then 'PASS' else 'FAIL' end as items_base_uom_column_check;

select
  case when exists (
    select 1
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and table_name = 'production_issue_lines'
      and column_name = 'base_quantity'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and table_name = 'stock_movements'
      and column_name = 'base_quantity'
  ) then 'PASS' else 'FAIL' end as migration_061_columns_check;
