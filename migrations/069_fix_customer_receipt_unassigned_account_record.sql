-- Keep the customer-receipt account records field-addressable when only one
-- tender type is selected. This migration intentionally replaces only the
-- existing icecream_erp receipt RPC and makes no table or data changes.
do $$
declare
  v_function_oid regprocedure := to_regprocedure('icecream_erp.post_sales_payment_transaction_v2(uuid,uuid,jsonb)');
  v_definition text;
  v_expected_declarations text := E'  v_bank_account record;\n  v_bank_account_id uuid := nullif(p_payment_payload ->> ''bankAccountId'', '''')::uuid;\n  v_cash_account record;\n  v_cash_account_id uuid := nullif(p_payment_payload ->> ''cashAccountId'', '''')::uuid;';
  v_safe_declarations text := E'  v_bank_account icecream_erp.bank_accounts%rowtype;\n  v_bank_account_id uuid := nullif(p_payment_payload ->> ''bankAccountId'', '''')::uuid;\n  v_cash_account icecream_erp.cash_accounts%rowtype;\n  v_cash_account_id uuid := nullif(p_payment_payload ->> ''cashAccountId'', '''')::uuid;';
begin
  if v_function_oid is null then
    raise exception 'Required function icecream_erp.post_sales_payment_transaction_v2(uuid,uuid,jsonb) does not exist';
  end if;

  select pg_get_functiondef(v_function_oid) into v_definition;
  if position(v_expected_declarations in v_definition) = 0 then
    raise exception 'Receipt RPC declaration block is not the expected migration-065 version; aborting without replacement';
  end if;

  execute replace(v_definition, v_expected_declarations, v_safe_declarations);
end;
$$;

revoke all on function icecream_erp.post_sales_payment_transaction_v2(uuid, uuid, jsonb) from public;
grant execute on function icecream_erp.post_sales_payment_transaction_v2(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
