-- 039_production_relationship_map_and_reporting.sql
-- Relationship-map and reporting views for the production-order workflow.
-- Rollback approach: drop views first; no data is mutated by this migration.

create or replace view icecream_erp.production_order_relationship_map as
select
  po.organization_id,
  po.id as production_order_id,
  'production_order'::text as document_type,
  po.id as document_id,
  po.production_order_number as document_number,
  po.created_at::date as document_date,
  po.status,
  po.planned_quantity as quantity,
  po.planned_cost as value,
  po.created_by,
  null::uuid as related_document_id,
  null::text as relationship_type,
  0 as sort_order
from icecream_erp.production_orders po
union all
select
  pi.organization_id,
  pi.production_order_id,
  'production_issue',
  pi.id,
  pi.issue_number,
  pi.issue_date,
  pi.posting_status,
  pi.total_quantity,
  pi.total_cost,
  pi.issued_by,
  pi.production_order_id,
  'ISSUES_MATERIAL_TO',
  10
from icecream_erp.production_issues pi
union all
select
  pr.organization_id,
  pr.production_order_id,
  'production_receipt',
  pr.id,
  pr.receipt_number,
  pr.receipt_date,
  pr.posting_status,
  pr.total_completed_quantity,
  pr.total_cost,
  pr.received_by,
  pr.production_order_id,
  'RECEIVES_OUTPUT_FROM',
  20
from icecream_erp.production_receipts pr;

create or replace view icecream_erp.production_order_cost_summary as
select
  po.organization_id,
  po.id as production_order_id,
  po.production_order_number,
  po.product_number,
  po.product_description_snapshot,
  po.status,
  po.planned_quantity,
  po.released_quantity,
  po.completed_quantity,
  po.rejected_quantity,
  po.wastage_quantity,
  po.remaining_quantity,
  po.planned_cost,
  coalesce(sum(pil.line_cost) filter (where pi.posting_status = 'POSTED'), 0) as posted_material_cost,
  po.actual_cost,
  po.cost_per_unit,
  po.actual_cost - po.planned_cost as cost_variance
from icecream_erp.production_orders po
left join icecream_erp.production_issues pi on pi.production_order_id = po.id
left join icecream_erp.production_issue_lines pil on pil.production_issue_id = pi.id
group by po.id;

grant select on icecream_erp.production_order_relationship_map to service_role;
grant select on icecream_erp.production_order_cost_summary to service_role;

insert into icecream_erp.permissions (code, name, module)
select seed.code, seed.name, 'production'
from (
  values
    ('production_order.create', 'Create production orders'),
    ('production_order.view', 'View production orders'),
    ('production_order.edit_planned', 'Edit planned production orders'),
    ('production_order.release', 'Release production orders'),
    ('production_issue.create', 'Create production issues'),
    ('production_issue.post', 'Post production issues'),
    ('production_issue.reverse', 'Reverse production issues'),
    ('production_receipt.create', 'Create production receipts'),
    ('production_receipt.post', 'Post production receipts'),
    ('production_receipt.reverse', 'Reverse production receipts'),
    ('production_order.close', 'Close production orders'),
    ('production_order.reopen', 'Reopen production orders'),
    ('production_order.view_cost', 'View production order costs'),
    ('production_order.view_relationship_map', 'View production order relationship map')
) as seed(code, name)
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'icecream_erp'
    and table_name = 'permissions'
)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
