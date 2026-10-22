-- Normalize GRN commercial quantities into an item's base inventory UOM.
-- This changes only the atomic GRN posting RPC and intentionally preserves
-- its existing locking, finance, audit, idempotency, and status behavior.

do $$
declare
  v_signature text := 'icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text)';
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;

  if v_definition is null then
    raise exception 'Function % was not found.', v_signature;
  end if;

  -- Guard each transformation so a future RPC change cannot be partially replaced.
  v_old := E'  v_quantity numeric;\n  v_unit_cost numeric;\n  v_amount numeric;';
  v_new := E'  v_quantity numeric;\n  v_transaction_quantity numeric;\n  v_base_quantity numeric;\n  v_transaction_uom_id uuid;\n  v_base_uom_id uuid;\n  v_item_base_uom_id uuid;\n  v_conversion_factor numeric := 1;\n  v_unit_cost numeric;\n  v_amount numeric;';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: GRN RPC declaration block has changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'      coalesce(g.quantity_received, g.quantity_expected, 0)::numeric as quantity_received,\n      coalesce(g.unit_cost, 0)::numeric as unit_cost';
  v_new := E'      coalesce(g.quantity_received, g.quantity_expected, 0)::numeric as quantity_received,\n      g.transaction_uom_id as transaction_uom_id,\n      g.unit_of_measure_id as unit_of_measure_id,\n      coalesce(g.unit_cost, 0)::numeric as unit_cost';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: GRN line projection has changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'    v_quantity := greatest(coalesce(v_line.quantity_received, 0), 0);\n    v_unit_cost := greatest(coalesce(v_line.unit_cost, 0), 0);\n    v_amount := round(v_quantity * v_unit_cost, 4);\n\n    if v_quantity <= 0 then\n      continue;\n    end if;';
  v_new := E'    -- PO receipt quantity remains in the commercial transaction UOM.\n    v_transaction_quantity := greatest(coalesce(v_line.quantity_received, 0), 0);\n    v_unit_cost := greatest(coalesce(v_line.unit_cost, 0), 0);\n    v_amount := round(v_transaction_quantity * v_unit_cost, 4);\n\n    if v_transaction_quantity <= 0 then\n      continue;\n    end if;\n\n    select coalesce(item.unit_of_measure_id, item.unit_id)\n    into v_item_base_uom_id\n    from icecream_erp.items item\n    where item.id = v_item_id\n      and item.organization_id = p_organization_id;\n\n    if not found then\n      raise exception ''GRN line % item does not belong to the organization.'', v_line.id using errcode = ''23514'';\n    end if;\n\n    v_transaction_uom_id := case\n      when v_has_po_line then coalesce(\n        v_po_line.transaction_uom_id,\n        v_line.transaction_uom_id,\n        v_po_line.unit_of_measure_id,\n        v_line.unit_of_measure_id,\n        v_item_base_uom_id\n      )\n      else coalesce(v_line.transaction_uom_id, v_line.unit_of_measure_id, v_item_base_uom_id)\n    end;\n    v_base_uom_id := case\n      when v_has_po_line then coalesce(v_po_line.base_uom_id, v_item_base_uom_id, v_transaction_uom_id)\n      else coalesce(v_item_base_uom_id, v_transaction_uom_id)\n    end;\n\n    if v_transaction_uom_id is null or v_base_uom_id is null then\n      raise exception ''GRN line % cannot resolve transaction and base UOMs.'', v_line.id using errcode = ''23514'';\n    end if;\n\n    if v_transaction_uom_id = v_base_uom_id then\n      v_conversion_factor := 1;\n    else\n      select conversion.conversion_factor\n      into v_conversion_factor\n      from icecream_erp.item_uom_conversions conversion\n      where conversion.organization_id = p_organization_id\n        and conversion.item_id = v_item_id\n        and conversion.from_uom_id = v_transaction_uom_id\n        and conversion.to_uom_id = v_base_uom_id\n        and conversion.is_active = true;\n\n      if v_conversion_factor is null or v_conversion_factor <= 0 then\n        raise exception ''No active UOM conversion exists for GRN line % from transaction UOM % to base UOM %.'', v_line.id, v_transaction_uom_id, v_base_uom_id using errcode = ''23514'';\n      end if;\n    end if;\n\n    v_base_quantity := round(v_transaction_quantity * v_conversion_factor, 8);\n    v_quantity := v_base_quantity;\n    v_unit_cost := case when v_quantity > 0 then v_amount / v_quantity else 0 end;';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: GRN quantity block has changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := ' + v_quantity > coalesce(v_po_line.quantity_ordered, v_po_line.quantity, 0) then';
  v_new := ' + v_transaction_quantity > coalesce(v_po_line.quantity_ordered, v_po_line.quantity, 0) then';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: PO over-receipt check has changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'      journal_entry_id,\n      created_by,\n      created_at';
  v_new := E'      journal_entry_id,\n      transaction_quantity,\n      transaction_uom_id,\n      base_quantity,\n      base_uom_id,\n      uom_conversion_factor,\n      created_by,\n      created_at';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: stock movement insert columns have changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'      v_journal.journal_id,\n      p_actor_user_id,\n      v_posted_at';
  v_new := E'      v_journal.journal_id,\n      v_transaction_quantity,\n      v_transaction_uom_id,\n      v_base_quantity,\n      v_base_uom_id,\n      v_conversion_factor,\n      p_actor_user_id,\n      v_posted_at';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: stock movement insert values have changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'      set quantity_received = coalesce(quantity_received, 0) + v_quantity,\n          received_qty = coalesce(received_qty, coalesce(quantity_received, 0)) + v_quantity';
  v_new := E'      set quantity_received = coalesce(quantity_received, 0) + v_transaction_quantity,\n          received_qty = coalesce(received_qty, coalesce(quantity_received, 0)) + v_transaction_quantity';
  if position(v_old in v_definition) = 0 then
    raise exception '068 precondition failed: PO receipt update has changed.';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  execute v_definition;
end
$$;

revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from public;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from anon;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from authenticated;
grant execute on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
