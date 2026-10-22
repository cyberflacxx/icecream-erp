-- Read-only preflight for 068 GRN UOM normalization.
\pset pager off
\echo '068 RPC and UOM readiness'
select to_regprocedure('icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text)') is not null as atomic_grn_rpc_present;

select table_name, column_name
from information_schema.columns
where table_schema = 'icecream_erp'
  and ((table_name = 'purchase_order_items' and column_name in ('transaction_uom_id', 'base_uom_id', 'unit_of_measure_id', 'quantity_received', 'received_qty'))
    or (table_name = 'goods_received_note_items' and column_name in ('transaction_uom_id', 'unit_of_measure_id', 'quantity_received'))
    or (table_name = 'items' and column_name in ('unit_of_measure_id', 'unit_id'))
    or (table_name = 'stock_movements' and column_name in ('transaction_quantity', 'transaction_uom_id', 'base_quantity', 'base_uom_id', 'uom_conversion_factor')))
order by table_name, column_name;

\echo 'Active item conversions must be positive and unambiguous'
select organization_id, item_id, from_uom_id, to_uom_id, count(*) as active_rows
from icecream_erp.item_uom_conversions
where is_active
group by organization_id, item_id, from_uom_id, to_uom_id
having count(*) > 1;

select count(*) as invalid_active_conversion_rows
from icecream_erp.item_uom_conversions
where is_active and coalesce(conversion_factor, 0) <= 0;
