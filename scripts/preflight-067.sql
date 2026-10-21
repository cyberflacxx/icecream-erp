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

-- Run this final query only after migration 067 has been applied; it must return zero rows.
select p.id, p.item_id, p.organization_id
from icecream_erp.production_raw_material_conversions p
join icecream_erp.items i on i.id = p.item_id
join icecream_erp.item_categories c on c.id = i.category_id
where p.is_active and c.code is distinct from 'RAW_MATERIAL_PRODUCTION';
