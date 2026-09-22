-- Review-only migration for final workflow hardening.
-- Scope: icecream_erp only. Do not run blindly in production without backup/rehearsal.

set search_path = icecream_erp, public;

alter table if exists icecream_erp.purchase_orders
  add column if not exists idempotency_key text;

alter table if exists icecream_erp.supplier_payments
  add column if not exists idempotency_key text;

create unique index if not exists purchase_orders_org_idempotency_key_uq
  on icecream_erp.purchase_orders (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists supplier_payments_org_idempotency_key_uq
  on icecream_erp.supplier_payments (organization_id, idempotency_key)
  where idempotency_key is not null;

comment on column icecream_erp.purchase_orders.idempotency_key is
  'Client/server idempotency key for one logical purchase order create request.';

comment on column icecream_erp.supplier_payments.idempotency_key is
  'Client/server idempotency key for one logical supplier payment post request.';

-- Increase scale for monetary numeric columns while excluding quantities,
-- percentages, physical measurements, counts, and other non-money fields.
do $$
declare
  r record;
begin
  for r in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and data_type = 'numeric'
      and coalesce(numeric_scale, 0) < 4
      and column_name ~* '(amount|cost|price|balance|total|subtotal|tax|discount|debit|credit|revenue|expense|pay|paid|payment|receivable|payable|valuation|value|budget|variance|salary|allowance|deduction|cash|bank|cogs|basic_rate|hourly_rate|shift_rate)'
      and column_name !~* '(quantity|qty|percent|percentage|hours|temperature|ph|capacity|workers|time|score|level)'
  loop
    execute format(
      'alter table %I.%I alter column %I type numeric(24,4) using %I::numeric(24,4)',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name
    );
    execute format(
      'comment on column %I.%I.%I is %L',
      r.table_schema,
      r.table_name,
      r.column_name,
      'Money precision reviewed by 059_workflow_idempotency_and_money_precision.sql; widened to numeric(24,4).'
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
