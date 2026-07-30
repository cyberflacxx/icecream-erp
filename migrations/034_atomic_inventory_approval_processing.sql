create or replace function icecream_erp.process_inventory_approval(
  p_approval_id uuid,
  p_action text,
  p_comments text default null,
  p_actor_user_id uuid default null,
  p_organization_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_action text := upper(trim(coalesce(p_action, '')));
  v_action_status text;
  v_audit_action text;
  v_now timestamptz := now();
  v_old approval_requests%rowtype;
  v_pending_status text;
  v_updated approval_requests%rowtype;
begin
  if p_approval_id is null or p_organization_id is null or p_actor_user_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_input',
      'message', 'Approval ID, organization ID, and acting user ID are required.'
    );
  end if;

  if v_action in ('APPROVE', 'APPROVED') then
    v_action_status := 'APPROVED';
    v_audit_action := 'INVENTORY_APPROVAL_APPROVED';
  elsif v_action in ('REJECT', 'REJECTED') then
    if nullif(trim(coalesce(p_comments, '')), '') is null then
      return jsonb_build_object(
        'success', false,
        'code', 'invalid_input',
        'message', 'Comments are required when rejecting an approval request.'
      );
    end if;

    v_action_status := 'REJECTED';
    v_audit_action := 'INVENTORY_APPROVAL_REJECTED';
  else
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_action',
      'message', 'Action must be APPROVE or REJECT.'
    );
  end if;

  select *
  into v_old
  from icecream_erp.approval_requests
  where id = p_approval_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'not_found',
      'message', 'Approval request not found.'
    );
  end if;

  v_pending_status := regexp_replace(upper(trim(coalesce(v_old.status, ''))), '[^A-Z0-9]+', '_', 'g');
  if v_pending_status not in ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED', 'AWAITING_APPROVAL') then
    return jsonb_build_object(
      'success', false,
      'code', 'already_processed',
      'message', 'Approval request has already been processed.',
      'currentStatus', v_old.status
    );
  end if;

  if v_action_status = 'APPROVED' then
    update icecream_erp.approval_requests
    set
      approval_date = v_now,
      approver_user_id = p_actor_user_id,
      completed_at = v_now,
      status = 'APPROVED',
      updated_at = v_now
    where id = p_approval_id
      and organization_id = p_organization_id
    returning * into v_updated;
  else
    update icecream_erp.approval_requests
    set
      completed_at = v_now,
      rejected_at = v_now,
      rejected_by = p_actor_user_id,
      rejected_reason = p_comments,
      status = 'REJECTED',
      updated_at = v_now
    where id = p_approval_id
      and organization_id = p_organization_id
    returning * into v_updated;
  end if;

  insert into icecream_erp.approval_actions (
    approval_request_id,
    step_number,
    level,
    action_by,
    action,
    comments,
    acted_at,
    document_type,
    document_id,
    ip_address,
    action_status,
    action_comment
  )
  values (
    p_approval_id,
    v_old.current_step,
    'LEVEL2_MANAGER',
    p_actor_user_id,
    v_action_status,
    p_comments,
    v_now,
    v_old.document_type,
    v_old.entity_id,
    p_ip_address,
    v_action_status,
    p_comments
  );

  insert into icecream_erp.audit_logs (
    organization_id,
    user_profile_id,
    action,
    table_name,
    record_id,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    metadata
  )
  values (
    p_organization_id,
    p_actor_user_id,
    v_audit_action,
    coalesce(v_old.entity_type, 'approval_request'),
    p_approval_id,
    coalesce(v_old.entity_type, 'approval_request'),
    p_approval_id,
    to_jsonb(v_old),
    jsonb_build_object(
      'approvalRequestId', p_approval_id,
      'comments', p_comments,
      'documentId', v_old.entity_id,
      'processedAt', v_now,
      'processedBy', p_actor_user_id,
      'status', v_action_status
    ),
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'source', 'process_inventory_approval',
      'inventoryPostingApplied', false
    )
  );

  return jsonb_build_object(
    'success', true,
    'code', 'processed',
    'data', to_jsonb(v_updated)
  );
end;
$$;

revoke all on function icecream_erp.process_inventory_approval(uuid, text, text, uuid, uuid, text, text) from public;
grant execute on function icecream_erp.process_inventory_approval(uuid, text, text, uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
