-- Read-only readiness report for migration 067. No statements below mutate data.
set search_path = icecream_erp, public;

with production_items as (
  select i.id, i.organization_id, i.code, i.name, coalesce(i.unit_of_measure_id, i.unit_id) as base_uom_id
  from icecream_erp.items i join icecream_erp.item_categories c on c.id = i.category_id
  where c.code = 'RAW_MATERIAL_PRODUCTION'
)
select pi.code, pi.name, pi.base_uom_id, u.name as base_uom_name, u.abbreviation as base_uom_abbreviation,
       x.from_uom_id, x.to_uom_id, x.conversion_factor, x.is_active
from production_items pi
left join icecream_erp.units_of_measure u on u.id = pi.base_uom_id
left join icecream_erp.item_uom_conversions x on x.item_id = pi.id and x.organization_id = pi.organization_id
order by pi.name, x.created_at;

select organization_id, item_id, from_uom_id, to_uom_id, count(*) as active_pair_count
from icecream_erp.item_uom_conversions where is_active
group by organization_id, item_id, from_uom_id, to_uom_id having count(*) > 1;

select i.id, i.code, i.name, coalesce(i.unit_of_measure_id, i.unit_id) as missing_base_uom_id
from icecream_erp.items i join icecream_erp.item_categories c on c.id = i.category_id
where c.code = 'RAW_MATERIAL_PRODUCTION'
  and (coalesce(i.unit_of_measure_id, i.unit_id) is null or not exists (select 1 from icecream_erp.item_uom_conversions x where x.item_id = i.id and x.is_active));

select i.id, i.code, i.name,
  exists(select 1 from icecream_erp.recipe_ingredients ri where ri.item_id = i.id) as used_in_bom,
  exists(select 1 from icecream_erp.stock_balances sb where sb.item_id = i.id and coalesce(sb.quantity_on_hand, sb.quantity, 0) <> 0) as has_active_stock,
  exists(select 1 from icecream_erp.purchase_order_items poi where poi.item_id = i.id) as has_po_history,
  exists(select 1 from icecream_erp.goods_received_note_items gi where gi.item_id = i.id) as has_grn_history
from icecream_erp.items i join icecream_erp.item_categories c on c.id = i.category_id
where c.code = 'RAW_MATERIAL_PRODUCTION' order by i.name;

-- Migration 067 object-state report. Safe before migration because it does not query the new table.
select
  to_regclass('icecream_erp.production_raw_material_conversions') as production_raw_material_conversions_table,
  case
    when to_regclass('icecream_erp.production_raw_material_conversions') is null then 'NOT_APPLIED'
    else 'TABLE_PRESENT'
  end as migration_067_state;

-- Verify the existing source columns required by the 067 snapshot trigger are present.
with required_source_columns(table_name, column_name) as (
  values
    ('goods_received_note_items', 'item_id'),
    ('stock_movements', 'item_id'),
    ('production_issue_lines', 'component_item_id')
)
select
  r.table_name,
  r.column_name,
  case when c.column_name is null then 'MISSING' else 'PRESENT' end as status
from required_source_columns r
left join information_schema.columns c
  on c.table_schema = 'icecream_erp'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- Report whether 067 snapshot target columns already exist. Missing is expected before migration 067.
with required_snapshot_columns(table_name, column_name) as (
  values
    ('goods_received_note_items', 'production_profile_id'),
    ('goods_received_note_items', 'production_output_uom_id'),
    ('goods_received_note_items', 'production_output_quantity_per_profile'),
    ('goods_received_note_items', 'production_profile_purchase_quantity'),
    ('goods_received_note_items', 'production_profile_conversion_quantity'),
    ('stock_movements', 'production_profile_id'),
    ('stock_movements', 'production_output_uom_id'),
    ('stock_movements', 'production_output_quantity_per_profile'),
    ('stock_movements', 'production_profile_purchase_quantity'),
    ('stock_movements', 'production_profile_conversion_quantity'),
    ('production_issue_lines', 'production_profile_id'),
    ('production_issue_lines', 'production_output_uom_id'),
    ('production_issue_lines', 'production_output_quantity_per_profile'),
    ('production_issue_lines', 'production_profile_purchase_quantity'),
    ('production_issue_lines', 'production_profile_conversion_quantity')
)
select
  r.table_name,
  r.column_name,
  case when c.column_name is null then 'MISSING_BEFORE_067' else 'PRESENT_ALREADY' end as status
from required_snapshot_columns r
left join information_schema.columns c
  on c.table_schema = 'icecream_erp'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;
