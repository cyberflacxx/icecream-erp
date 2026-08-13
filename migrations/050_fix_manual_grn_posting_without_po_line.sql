do $$
declare
  v_signature text := 'icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text)';
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(to_regprocedure(v_signature))
  into v_definition;

  if v_definition is null then
    raise exception 'Function % was not found.', v_signature;
  end if;

  v_updated_definition := replace(
    v_definition,
    '    v_po_line record;',
    E'    v_po_line record;\n    v_has_po_line boolean := false;'
  );

  v_updated_definition := replace(
    v_updated_definition,
    E'      if v_line.purchase_order_item_id is not null then\n        select *\n        into v_po_line\n        from icecream_erp.purchase_order_items\n        where id = v_line.purchase_order_item_id\n        for update;\n\n        if v_item_id is null then\n          v_item_id := v_po_line.item_id;\n        end if;\n      end if;',
    E'      v_has_po_line := false;\n      if v_line.purchase_order_item_id is not null then\n        select *\n        into v_po_line\n        from icecream_erp.purchase_order_items\n        where id = v_line.purchase_order_item_id\n        for update;\n\n        v_has_po_line := found;\n\n        if v_item_id is null and v_has_po_line then\n          v_item_id := v_po_line.item_id;\n        end if;\n      end if;'
  );

  v_updated_definition := replace(
    v_updated_definition,
    'if v_po_line.id is not null then',
    'if v_has_po_line then'
  );

  if v_updated_definition <> v_definition then
    execute v_updated_definition;
  end if;
end
$$;
