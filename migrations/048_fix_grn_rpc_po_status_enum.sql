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
    'v_po_status text := ''APPROVED'';',
    'v_po_status icecream_erp.po_status := ''APPROVED''::icecream_erp.po_status;'
  );

  if v_updated_definition <> v_definition then
    execute v_updated_definition;
  end if;
end
$$;

do $$
declare
  v_signature text := 'icecream_erp.reverse_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, text)';
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
    'v_po_status text := ''APPROVED'';',
    'v_po_status icecream_erp.po_status := ''APPROVED''::icecream_erp.po_status;'
  );

  if v_updated_definition <> v_definition then
    execute v_updated_definition;
  end if;
end
$$;
