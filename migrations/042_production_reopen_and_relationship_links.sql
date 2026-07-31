-- 042_production_reopen_and_relationship_links.sql
-- Safe closed-order reopening and relationship-map source-of-truth correction.
-- Rollback approach: drop the reopen function and restore the prior view definition from migration 039.

create or replace function icecream_erp.reopen_production_order(
  p_order_id uuid,
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_actor_user_account_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_order record;
  v_reason text;
  v_target_status text := 'RELEASED';
begin
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Reopen reason is required.' using errcode = '22023';
  end if;

  select *
  into v_order
  from icecream_erp.production_orders
  where id = p_order_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'CLOSED' then
    raise exception 'Only CLOSED production orders can be reopened.' using errcode = '23514';
  end if;

  update icecream_erp.production_orders
  set
    status = v_target_status,
    is_locked = false,
    updated_at = now(),
    version_number = version_number + 1
  where id = p_order_id;

  insert into icecream_erp.production_order_status_history (
    organization_id, production_order_id, previous_status, new_status, source_action, reason, notes, changed_by
  )
  values (
    p_organization_id,
    p_order_id,
    'CLOSED',
    v_target_status,
    'REOPEN',
    v_reason,
    'Reopened to RELEASED to preserve posted issue and receipt history.',
    p_actor_user_profile_id
  );

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id,
    p_actor_user_account_id,
    p_actor_user_profile_id,
    'PRODUCTION_ORDER_REOPENED',
    'production_orders',
    p_order_id,
    'production_order',
    p_order_id,
    jsonb_build_object(
      'previousStatus', 'CLOSED',
      'newStatus', v_target_status,
      'reason', v_reason,
      'releasedQuantity', v_order.released_quantity,
      'completedQuantity', v_order.completed_quantity,
      'actualCost', v_order.actual_cost
    )
  );

  return jsonb_build_object('success', true, 'productionOrderId', p_order_id, 'status', v_target_status);
end;
$$;

create or replace view icecream_erp.production_order_relationship_map as
with normalized_links as (
  select
    l.id as link_id,
    l.organization_id,
    l.production_order_id,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.from_document_type
      else l.to_document_type
    end as source_document_type,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.from_document_id
      else l.to_document_id
    end as source_document_id,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.to_document_type
      else l.from_document_type
    end as related_document_type,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.to_document_id
      else l.from_document_id
    end as related_document_id,
    l.relationship_type,
    l.created_by,
    l.created_at,
    row_number() over (
      partition by
        l.organization_id,
        l.production_order_id,
        case
          when l.from_document_type = 'production_order'
            and l.from_document_id = l.production_order_id
            then l.to_document_type
          else l.from_document_type
        end,
        case
          when l.from_document_type = 'production_order'
            and l.from_document_id = l.production_order_id
            then l.to_document_id
          else l.from_document_id
        end
      order by l.created_at desc, l.id desc
    ) as rn
  from icecream_erp.production_document_links l
  where (
    l.from_document_type = 'production_order'
    and l.from_document_id = l.production_order_id
  ) or (
    l.to_document_type = 'production_order'
    and l.to_document_id = l.production_order_id
  )
),
dedup_links as (
  select *
  from normalized_links
  where rn = 1
)
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
  0 as sort_order,
  po.status as document_status,
  null::text as posting_status,
  'production_order'::text as source_document_type,
  po.id as source_document_id,
  null::text as related_document_type
from icecream_erp.production_orders po
union all
select
  pi.organization_id,
  dl.production_order_id,
  'production_issue'::text,
  pi.id,
  pi.issue_number,
  pi.issue_date,
  pi.posting_status,
  pi.total_quantity,
  pi.total_cost,
  pi.issued_by,
  dl.related_document_id,
  dl.relationship_type,
  10,
  null::text as document_status,
  pi.posting_status,
  dl.source_document_type,
  dl.source_document_id,
  dl.related_document_type
from dedup_links dl
join icecream_erp.production_issues pi
  on pi.organization_id = dl.organization_id
 and pi.production_order_id = dl.production_order_id
 and pi.id = dl.related_document_id
where dl.related_document_type = 'production_issue'
union all
select
  pr.organization_id,
  dl.production_order_id,
  'production_receipt'::text,
  pr.id,
  pr.receipt_number,
  pr.receipt_date,
  pr.posting_status,
  pr.total_completed_quantity,
  pr.total_cost,
  pr.received_by,
  dl.related_document_id,
  dl.relationship_type,
  20,
  null::text as document_status,
  pr.posting_status,
  dl.source_document_type,
  dl.source_document_id,
  dl.related_document_type
from dedup_links dl
join icecream_erp.production_receipts pr
  on pr.organization_id = dl.organization_id
 and pr.production_order_id = dl.production_order_id
 and pr.id = dl.related_document_id
where dl.related_document_type = 'production_receipt';

revoke all on function icecream_erp.reopen_production_order(uuid, uuid, uuid, uuid, text) from public;
revoke all on function icecream_erp.reopen_production_order(uuid, uuid, uuid, uuid, text) from anon;
revoke all on function icecream_erp.reopen_production_order(uuid, uuid, uuid, uuid, text) from authenticated;

grant execute on function icecream_erp.reopen_production_order(uuid, uuid, uuid, uuid, text) to service_role;
grant select on icecream_erp.production_order_relationship_map to service_role;

notify pgrst, 'reload schema';
