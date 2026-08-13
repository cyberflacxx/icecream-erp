do $$
declare
  v_signature text := 'icecream_erp.post_sales_invoice_transaction(uuid, uuid, jsonb)';
  v_definition text;
begin
  select pg_get_functiondef(to_regprocedure(v_signature))
  into v_definition;

  if v_definition is null then
    raise exception 'Function % was not found.', v_signature;
  end if;

  v_definition := replace(
    v_definition,
    'v_invoice_status text := ''SENT'';',
    'v_invoice_status text := ''DRAFT'';'
  );

  v_definition := replace(
    v_definition,
    $old_stock$
      update icecream_erp.stock_balances
      set quantity = quantity - (v_line ->> 'quantity')::numeric,
          quantity_on_hand = quantity_on_hand - (v_line ->> 'quantity')::numeric,
          quantity_available = quantity_available - (v_line ->> 'quantity')::numeric,
          last_updated = now(),
          updated_at = now()
      where id = v_stock_balance.id
        and quantity_available >= (v_line ->> 'quantity')::numeric;

      if not found then
        raise exception 'Insufficient stock for item %.', v_line ->> 'itemId'
          using errcode = 'P0001';
      end if;

      insert into icecream_erp.stock_movements (
        organization_id, item_id, warehouse_id, movement_type, quantity, unit_cost, total_cost, total_value,
        reference_type, reference_id, source_document_type, source_document_id, reference_number, created_by
      )
      values (
        p_organization_id,
        (v_line ->> 'itemId')::uuid,
        v_warehouse_id,
        'SALES_ISSUE',
        (v_line ->> 'quantity')::numeric,
        coalesce(v_stock_balance.avg_cost, 0),
        coalesce(v_stock_balance.avg_cost, 0) * (v_line ->> 'quantity')::numeric,
        coalesce(v_stock_balance.avg_cost, 0) * (v_line ->> 'quantity')::numeric,
        'sales_invoice',
        v_invoice_id,
        'sales_invoice',
        v_invoice_id,
        v_invoice_number,
        v_actor_user_account_id
      )
      on conflict (reference_type, reference_id, movement_type, warehouse_id, item_id)
      where reference_type is not null and reference_id is not null
      do update
      set quantity = icecream_erp.stock_movements.quantity + excluded.quantity,
          total_cost = coalesce(icecream_erp.stock_movements.total_cost, 0) + coalesce(excluded.total_cost, 0);

      v_stock_cost_total := v_stock_cost_total + coalesce(v_stock_balance.avg_cost, 0) * (v_line ->> 'quantity')::numeric;
$old_stock$,
    $new_stock$
      -- Stock is reserved on invoice approval and issued on dispatch posting.
      null;
$new_stock$
  );

  v_definition := replace(
    v_definition,
    'v_total + v_stock_cost_total, v_total + v_stock_cost_total',
    'v_total, v_total'
  );

  v_definition := replace(
    v_definition,
    'v_idempotency_payload_hash, nullif(p_invoice_payload ->> ''notes'', ''''), v_actor_user_account_id, v_actor_user_account_id, now()',
    'v_idempotency_payload_hash, nullif(p_invoice_payload ->> ''notes'', ''''), v_actor_user_account_id, null, null'
  );

  v_definition := replace(
    v_definition,
    $old_cogs$
  if v_stock_cost_total > 0 then
    v_cogs_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id, 'sales_invoice', 'COST_OF_GOODS_SOLD', v_branch_id
    );
    v_inventory_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id, 'sales_invoice', 'FINISHED_GOODS_INVENTORY', v_branch_id
    );
  end if;
$old_cogs$,
    ''
  );

  v_definition := replace(
    v_definition,
    $old_cogs_lines$
  if v_stock_cost_total > 0 then
    insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
    values
      (v_journal_id, v_cogs_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Cost of goods sold for invoice ' || v_invoice_number, v_stock_cost_total, 0),
      (v_journal_id, v_inventory_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Inventory issue for invoice ' || v_invoice_number, 0, v_stock_cost_total);
  end if;
$old_cogs_lines$,
    ''
  );

  execute v_definition;
end
$$;
