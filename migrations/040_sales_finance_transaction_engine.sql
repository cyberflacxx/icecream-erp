-- Sales finance transaction engine
-- Additive only. Do not run destructive DDL. All objects stay inside icecream_erp.

create extension if not exists pgcrypto;

alter table if exists icecream_erp.journal_entries
  add column if not exists reference_type text null,
  add column if not exists reference_id text null,
  add column if not exists is_posted boolean not null default false,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null,
  add column if not exists branch_id uuid null,
  add column if not exists department_id uuid null,
  add column if not exists cost_center_code text null,
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1;

alter table if exists icecream_erp.invoices
  add column if not exists branch_id uuid null,
  add column if not exists department_id uuid null,
  add column if not exists cost_center_code text null,
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists total numeric(18,2) not null default 0,
  add column if not exists amount_paid numeric(18,2) not null default 0,
  add column if not exists posted_by uuid null,
  add column if not exists posted_at timestamptz null,
  add column if not exists idempotency_key text null,
  add column if not exists idempotency_payload_hash text null;

update icecream_erp.invoices
set total = coalesce(nullif(total, 0), total_amount, 0),
    amount_paid = coalesce(nullif(amount_paid, 0), paid_amount, 0)
where total = 0
   or amount_paid = 0;

alter table if exists icecream_erp.customers
  add column if not exists current_balance numeric(18,2) not null default 0;

update icecream_erp.customers
set current_balance = coalesce(nullif(current_balance, 0), outstanding_balance, 0)
where current_balance = 0;

create table if not exists icecream_erp.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references icecream_erp.invoices(id) on delete cascade,
  item_id uuid not null,
  quantity numeric(18,3) not null default 0,
  unit_price numeric(18,2) not null default 0,
  discount_percent numeric(18,2) null,
  total_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.settings_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  code text not null,
  name text not null,
  payment_type text not null default 'CASH',
  requires_reference boolean not null default false,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists icecream_erp.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references icecream_erp.organizations(id),
  payment_number text not null,
  customer_id uuid not null references icecream_erp.customers(id),
  invoice_id uuid null references icecream_erp.invoices(id),
  payment_date date not null,
  amount numeric(18,2) not null default 0,
  payment_method text not null,
  reference_number text null,
  notes text null,
  status text not null default 'PENDING',
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

alter table if exists icecream_erp.payments
  add column if not exists organization_id uuid null references icecream_erp.organizations(id),
  add column if not exists branch_id uuid null,
  add column if not exists department_id uuid null,
  add column if not exists cost_center_code text null,
  add column if not exists currency_code text null,
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists idempotency_key text null,
  add column if not exists idempotency_payload_hash text null;

update icecream_erp.payments payment
set organization_id = invoice.organization_id
from icecream_erp.invoices invoice
where payment.invoice_id = invoice.id
  and payment.organization_id is null;

alter table if exists icecream_erp.settings_payment_methods
  add column if not exists gl_account_id uuid null references icecream_erp.accounts(id),
  add column if not exists posting_role text null;

alter table if exists icecream_erp.stock_movements
  add column if not exists total_value numeric(18,2) not null default 0,
  add column if not exists source_document_type text null,
  add column if not exists source_document_id uuid null,
  add column if not exists reference_number text null;

create table if not exists icecream_erp.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN',
  is_locked boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null
);

create table if not exists icecream_erp.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references icecream_erp.journal_entries(id) on delete cascade,
  account_id uuid not null references icecream_erp.accounts(id),
  branch_id uuid null,
  department_id uuid null,
  cost_center_code text null,
  description text null,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists icecream_erp.journal_entry_lines
  add column if not exists branch_id uuid null,
  add column if not exists department_id uuid null,
  add column if not exists cost_center_code text null;

create table if not exists icecream_erp.sales_posting_account_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  module_name text not null default 'sales',
  document_type text not null,
  posting_role text not null,
  account_id uuid not null references icecream_erp.accounts(id),
  branch_id uuid null references icecream_erp.branches(id),
  payment_method_code text null,
  item_category_id uuid null,
  tax_code text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists icecream_erp.sales_payment_tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  payment_id uuid not null references icecream_erp.payments(id) on delete cascade,
  payment_method text not null,
  amount numeric(18,2) not null,
  reference_number text null,
  gl_account_id uuid not null references icecream_erp.accounts(id),
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.sales_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  payment_id uuid not null references icecream_erp.payments(id) on delete cascade,
  invoice_id uuid not null references icecream_erp.invoices(id),
  allocated_amount numeric(18,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists icecream_erp.sales_document_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  source_document_type text not null,
  source_document_id uuid not null,
  related_document_type text not null,
  related_document_id uuid not null,
  relationship_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_source_document
  on icecream_erp.journal_entries (organization_id, reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

create unique index if not exists idx_invoices_idempotency_key
  on icecream_erp.invoices (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_payments_idempotency_key
  on icecream_erp.payments (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_payments_organization_date
  on icecream_erp.payments (organization_id, payment_date desc);

create unique index if not exists idx_fiscal_periods_name
  on icecream_erp.fiscal_periods (organization_id, period_name);

create index if not exists idx_fiscal_periods_dates
  on icecream_erp.fiscal_periods (organization_id, start_date, end_date);

create index if not exists idx_fiscal_periods_status
  on icecream_erp.fiscal_periods (organization_id, status, is_locked);

create index if not exists idx_settings_payment_methods_active
  on icecream_erp.settings_payment_methods (organization_id, is_active, code);
create index if not exists idx_invoice_items_invoice
  on icecream_erp.invoice_items (invoice_id);
create index if not exists idx_invoice_items_item
  on icecream_erp.invoice_items (item_id);

create index if not exists idx_journal_entry_lines_entry
  on icecream_erp.journal_entry_lines (journal_entry_id);

create index if not exists idx_journal_entry_lines_account
  on icecream_erp.journal_entry_lines (account_id);

create index if not exists idx_sales_posting_account_mappings_lookup
  on icecream_erp.sales_posting_account_mappings (
    organization_id,
    module_name,
    document_type,
    posting_role,
    is_active,
    branch_id,
    payment_method_code,
    item_category_id,
    tax_code
  );

create unique index if not exists idx_sales_posting_account_mappings_unique_default
  on icecream_erp.sales_posting_account_mappings (organization_id, module_name, document_type, posting_role)
  where branch_id is null
    and payment_method_code is null
    and item_category_id is null
    and tax_code is null;

create unique index if not exists idx_sales_payment_tenders_payment_method
  on icecream_erp.sales_payment_tenders (payment_id, payment_method, coalesce(reference_number, ''));

create unique index if not exists idx_sales_payment_allocations_invoice
  on icecream_erp.sales_payment_allocations (payment_id, invoice_id);

create unique index if not exists idx_sales_document_relationships_unique
  on icecream_erp.sales_document_relationships (
    organization_id,
    source_document_type,
    source_document_id,
    related_document_type,
    related_document_id,
    relationship_type
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'icecream_erp'::regnamespace
      and conname = 'sales_payment_tenders_amount_positive'
  ) then
    alter table icecream_erp.sales_payment_tenders
      add constraint sales_payment_tenders_amount_positive check (amount > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'icecream_erp'::regnamespace
      and conname = 'sales_payment_allocations_amount_positive'
  ) then
    alter table icecream_erp.sales_payment_allocations
      add constraint sales_payment_allocations_amount_positive check (allocated_amount > 0);
  end if;
end $$;

alter table icecream_erp.journal_entry_lines enable row level security;
alter table icecream_erp.fiscal_periods enable row level security;
alter table icecream_erp.payments enable row level security;
alter table icecream_erp.settings_payment_methods enable row level security;
alter table icecream_erp.sales_posting_account_mappings enable row level security;
alter table icecream_erp.sales_payment_tenders enable row level security;
alter table icecream_erp.sales_payment_allocations enable row level security;
alter table icecream_erp.sales_document_relationships enable row level security;

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'journal_entry_lines',
    'payments',
    'sales_posting_account_mappings',
    'sales_payment_tenders',
    'sales_payment_allocations',
    'sales_document_relationships'
  ]
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = v_table_name
        and policyname = v_table_name || '_service_role_full_access'
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to service_role using (true) with check (true)',
        v_table_name || '_service_role_full_access',
        v_table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = v_table_name
        and policyname = v_table_name || '_deny_anon'
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to anon using (false) with check (false)',
        v_table_name || '_deny_anon',
        v_table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'icecream_erp'
        and tablename = v_table_name
        and policyname = v_table_name || '_deny_authenticated'
    ) then
      execute format(
        'create policy %I on icecream_erp.%I for all to authenticated using (false) with check (false)',
        v_table_name || '_deny_authenticated',
        v_table_name
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'fiscal_periods'
      and policyname = 'fiscal_periods_service_role_full_access'
  ) then
    create policy fiscal_periods_service_role_full_access
      on icecream_erp.fiscal_periods
      for all to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'fiscal_periods'
      and policyname = 'fiscal_periods_deny_anon'
  ) then
    create policy fiscal_periods_deny_anon
      on icecream_erp.fiscal_periods
      for all to anon
      using (false)
      with check (false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'settings_payment_methods'
      and policyname = 'settings_payment_methods_service_role_full_access'
  ) then
    create policy settings_payment_methods_service_role_full_access
      on icecream_erp.settings_payment_methods
      for all to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'settings_payment_methods'
      and policyname = 'settings_payment_methods_deny_anon'
  ) then
    create policy settings_payment_methods_deny_anon
      on icecream_erp.settings_payment_methods
      for all to anon
      using (false)
      with check (false);
  end if;
end $$;

revoke all on table icecream_erp.journal_entry_lines from anon, authenticated;
revoke all on table icecream_erp.payments from anon, authenticated;
revoke all on table icecream_erp.sales_posting_account_mappings from anon, authenticated;
revoke all on table icecream_erp.sales_payment_tenders from anon, authenticated;
revoke all on table icecream_erp.sales_payment_allocations from anon, authenticated;
revoke all on table icecream_erp.sales_document_relationships from anon, authenticated;

grant all on table icecream_erp.journal_entry_lines to service_role;
grant all on table icecream_erp.fiscal_periods to service_role;
grant all on table icecream_erp.payments to service_role;
grant all on table icecream_erp.settings_payment_methods to service_role;
grant all on table icecream_erp.sales_posting_account_mappings to service_role;
grant all on table icecream_erp.sales_payment_tenders to service_role;
grant all on table icecream_erp.sales_payment_allocations to service_role;
grant all on table icecream_erp.sales_document_relationships to service_role;

insert into icecream_erp.sales_posting_account_mappings (
  organization_id, document_type, posting_role, account_id
)
select organization_id, mapping.document_type, mapping.posting_role, account.id
from icecream_erp.accounts account
join (
  values
    ('sales_invoice', 'ACCOUNTS_RECEIVABLE', '1100'),
    ('sales_invoice', 'SALES_REVENUE', '4000'),
    ('sales_invoice', 'VAT_OUTPUT', '2100'),
    ('sales_invoice', 'COST_OF_GOODS_SOLD', '5000'),
    ('sales_invoice', 'FINISHED_GOODS_INVENTORY', '1200'),
    ('invoice_payment', 'BANK_ACCOUNT', '1000'),
    ('invoice_payment', 'CASH_ON_HAND', '1010')
) as mapping(document_type, posting_role, account_code)
  on account.code = mapping.account_code
where account.is_active = true
on conflict do nothing;

create or replace function icecream_erp.sales_assert_open_period(
  p_organization_id uuid,
  p_transaction_date date
)
returns void
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
begin
  if not exists (
    select 1
    from icecream_erp.fiscal_periods
    where organization_id = p_organization_id
      and p_transaction_date between start_date and end_date
      and upper(status) = 'OPEN'
      and is_locked = false
  ) then
    raise exception 'No open fiscal period exists for %.', p_transaction_date
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function icecream_erp.sales_resolve_posting_account_id(
  p_organization_id uuid,
  p_document_type text,
  p_posting_role text,
  p_branch_id uuid default null,
  p_payment_method_code text default null,
  p_item_category_id uuid default null,
  p_tax_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_account_id uuid;
begin
  if p_payment_method_code is not null then
    select gl_account_id
      into v_account_id
    from icecream_erp.settings_payment_methods
    where organization_id = p_organization_id
      and upper(code) = upper(p_payment_method_code)
      and is_active = true
      and gl_account_id is not null
    limit 1;

    if v_account_id is not null then
      if exists (
        select 1
        from icecream_erp.accounts
        where id = v_account_id
          and organization_id = p_organization_id
          and is_active = true
      ) then
        return v_account_id;
      end if;

      raise exception 'Payment method % is mapped to an inactive or cross-organization GL account.', p_payment_method_code
        using errcode = 'P0001';
    end if;
  end if;

  select id
    into v_account_id
  from (
    select mapping.account_id as id,
           case when mapping.branch_id is not null then 0 else 1 end
             + case when mapping.payment_method_code is not null then 0 else 1 end
             + case when mapping.item_category_id is not null then 0 else 1 end
             + case when mapping.tax_code is not null then 0 else 1 end as specificity
    from icecream_erp.sales_posting_account_mappings mapping
    join icecream_erp.accounts account
      on account.id = mapping.account_id
     and account.organization_id = p_organization_id
     and account.is_active = true
    where mapping.organization_id = p_organization_id
      and mapping.module_name = 'sales'
      and mapping.document_type = p_document_type
      and mapping.posting_role = p_posting_role
      and mapping.is_active = true
      and (mapping.branch_id is null or mapping.branch_id = p_branch_id)
      and (mapping.payment_method_code is null or upper(mapping.payment_method_code) = upper(coalesce(p_payment_method_code, '')))
      and (mapping.item_category_id is null or mapping.item_category_id = p_item_category_id)
      and (mapping.tax_code is null or upper(mapping.tax_code) = upper(coalesce(p_tax_code, '')))
    order by specificity
    limit 1
  ) resolved;

  if v_account_id is null then
    raise exception 'Missing active GL mapping for posting role % on %.', p_posting_role, p_document_type
      using errcode = 'P0001';
  end if;

  return v_account_id;
end;
$$;

create or replace function icecream_erp.sales_next_document_number(
  p_organization_id uuid,
  p_series_type text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_document_prefix text;
  v_series record;
  v_next integer;
begin
  if p_series_type not in ('SALES_INVOICE', 'SALES_PAYMENT', 'JOURNAL_ENTRY') then
    raise exception 'Unsupported sales document series %.', p_series_type
      using errcode = 'P0001';
  end if;

  select id, prefix, last_number, padding
    into v_series
  from icecream_erp.number_series
  where organization_id = p_organization_id
    and series_type = p_series_type
    and is_active = true
  for update;

  if found then
    v_next := coalesce(v_series.last_number, 0) + 1;
    update icecream_erp.number_series
    set last_number = v_next,
        updated_at = now()
    where id = v_series.id;

    v_document_prefix := coalesce(v_series.prefix, p_prefix);
    if p_series_type = 'SALES_PAYMENT' then
      v_document_prefix := v_document_prefix || '-' || left(replace(p_organization_id::text, '-', ''), 8);
    end if;

    return concat(v_document_prefix, '-', lpad(v_next::text, coalesce(v_series.padding, 5), '0'));
  end if;

  insert into icecream_erp.number_series (organization_id, series_type, prefix, last_number, padding, is_active)
  values (p_organization_id, p_series_type, p_prefix, 1, 5, true)
  on conflict (organization_id, series_type) do update
    set last_number = icecream_erp.number_series.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  v_document_prefix := p_prefix;
  if p_series_type = 'SALES_PAYMENT' then
    v_document_prefix := v_document_prefix || '-' || left(replace(p_organization_id::text, '-', ''), 8);
  end if;

  return concat(v_document_prefix, '-', lpad(v_next::text, 5, '0'));
end;
$$;

create or replace function icecream_erp.post_sales_invoice_transaction(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_invoice_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_allow_credit_override boolean := coalesce((p_invoice_payload ->> 'allowCreditOverride')::boolean, false);
  v_ar_account_id uuid;
  v_branch_id uuid := nullif(p_invoice_payload ->> 'branchId', '')::uuid;
  v_cash_account_id uuid;
  v_cogs_account_id uuid;
  v_cost_center_code text := nullif(p_invoice_payload ->> 'costCenterCode', '');
  v_currency_code text := coalesce(nullif(p_invoice_payload ->> 'currencyCode', ''), 'USD');
  v_customer record;
  v_department_id uuid := nullif(p_invoice_payload ->> 'departmentId', '')::uuid;
  v_discount_amount numeric(18,2) := coalesce((p_invoice_payload ->> 'discountAmount')::numeric, 0);
  v_due_date date := nullif(p_invoice_payload ->> 'dueDate', '')::date;
  v_existing_invoice record;
  v_exchange_rate numeric(18,6) := coalesce((p_invoice_payload ->> 'exchangeRate')::numeric, 1);
  v_idempotency_key text := nullif(p_invoice_payload ->> 'idempotencyKey', '');
  v_idempotency_payload_hash text := null;
  v_inventory_account_id uuid;
  v_invoice_date date := coalesce(nullif(p_invoice_payload ->> 'invoiceDate', '')::date, current_date);
  v_invoice_id uuid := gen_random_uuid();
  v_invoice_number text;
  v_invoice_status text := 'SENT';
  v_journal_id uuid;
  v_journal_number text;
  v_line jsonb;
  v_line_discount numeric(18,2);
  v_line_total numeric(18,2);
  v_net_sales numeric(18,2);
  v_order record;
  v_paid_amount numeric(18,2) := 0;
  v_payment jsonb := coalesce(p_invoice_payload -> 'payment', '{}'::jsonb);
  v_payment_date date;
  v_payment_id uuid := null;
  v_payment_journal_id uuid := null;
  v_payment_journal_number text := null;
  v_payment_method text := upper(coalesce(v_payment ->> 'paymentMethod', ''));
  v_payment_number text := null;
  v_post_inventory boolean := coalesce((p_invoice_payload ->> 'postInventory')::boolean, false);
  v_revenue_account_id uuid;
  v_stock_balance record;
  v_stock_cost_total numeric(18,2) := 0;
  v_subtotal numeric(18,2) := 0;
  v_tax_amount numeric(18,2) := coalesce((p_invoice_payload ->> 'taxAmount')::numeric, 0);
  v_total numeric(18,2) := 0;
  v_vat_account_id uuid := null;
  v_warehouse_id uuid := nullif(p_invoice_payload ->> 'warehouseId', '')::uuid;
begin
  if p_organization_id is null or p_actor_user_profile_id is null then
    raise exception 'Organization and actor are required.' using errcode = 'P0001';
  end if;

  select user_account_id
    into v_actor_user_account_id
  from icecream_erp.users
  where id = p_actor_user_profile_id
    and status = 'active'
  limit 1;

  if v_actor_user_account_id is null
     and exists (select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;

  if v_actor_user_account_id is null then
    raise exception 'Active actor account was not found.' using errcode = 'P0001';
  end if;

  if nullif(p_invoice_payload ->> 'customerId', '') is null then
    raise exception 'customerId is required.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(coalesce(p_invoice_payload -> 'items', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_invoice_payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Invoice requires at least one line item.' using errcode = 'P0001';
  end if;

  if v_exchange_rate <= 0 then
    raise exception 'exchangeRate must be greater than zero.' using errcode = 'P0001';
  end if;

  if v_idempotency_key is not null then
    v_idempotency_payload_hash := encode(extensions.digest(convert_to(p_invoice_payload::text, 'UTF8'), 'sha256'), 'hex');

    select inv.id, inv.invoice_number, inv.idempotency_payload_hash, journal.id as journal_id, journal.entry_number as journal_number
      into v_existing_invoice
    from icecream_erp.invoices inv
    left join icecream_erp.journal_entries journal
      on journal.organization_id = inv.organization_id
     and journal.reference_type = 'sales_invoice'
     and journal.reference_id = inv.id::text
    where inv.organization_id = p_organization_id
      and inv.idempotency_key = v_idempotency_key
    limit 1;

    if v_existing_invoice.id is not null then
      if v_existing_invoice.idempotency_payload_hash is distinct from v_idempotency_payload_hash then
        raise exception 'Idempotency key was already used with a different invoice payload.' using errcode = 'P0001';
      end if;

      return jsonb_build_object(
        'success', true,
        'idempotentReplay', true,
        'invoiceId', v_existing_invoice.id,
        'invoiceNumber', v_existing_invoice.invoice_number,
        'journalId', v_existing_invoice.journal_id,
        'journalNumber', v_existing_invoice.journal_number,
        'sourceReference', 'sales:sales_invoice:' || v_existing_invoice.id::text
      );
    end if;
  end if;

  perform icecream_erp.sales_assert_open_period(p_organization_id, v_invoice_date);

  select *
    into v_customer
  from icecream_erp.customers
  where id = (p_invoice_payload ->> 'customerId')::uuid
    and organization_id = p_organization_id
  for update;

  if v_customer.id is null then
    raise exception 'Customer not found.' using errcode = 'P0001';
  end if;

  if upper(v_customer.status::text) = 'INACTIVE' then
    raise exception 'Inactive customers cannot be used on new invoices.' using errcode = 'P0001';
  end if;

  if nullif(p_invoice_payload ->> 'salesOrderId', '') is not null then
    select *
      into v_order
    from icecream_erp.sales_orders
    where id = (p_invoice_payload ->> 'salesOrderId')::uuid
      and organization_id = p_organization_id
    for update;

    if v_order.id is null then
      raise exception 'Sales order not found.' using errcode = 'P0001';
    end if;

    v_warehouse_id := coalesce(v_order.warehouse_id, v_warehouse_id);
    v_branch_id := coalesce(v_order.branch_id, v_branch_id);
  end if;

  if v_warehouse_id is not null and v_branch_id is null then
    select branch_id
      into v_branch_id
    from icecream_erp.warehouses
    where id = v_warehouse_id
      and organization_id = p_organization_id;
  end if;

  v_invoice_number := icecream_erp.sales_next_document_number(p_organization_id, 'SALES_INVOICE', 'INV');

  for v_line in
    select value from jsonb_array_elements(p_invoice_payload -> 'items')
  loop
    if coalesce((v_line ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Invoice quantities must be positive.' using errcode = 'P0001';
    end if;
    if coalesce((v_line ->> 'unitPrice')::numeric, 0) < 0 then
      raise exception 'Invoice unit prices cannot be negative.' using errcode = 'P0001';
    end if;

    v_line_discount :=
      coalesce((v_line ->> 'quantity')::numeric, 0)
      * coalesce((v_line ->> 'unitPrice')::numeric, 0)
      * (coalesce((v_line ->> 'discountPercent')::numeric, 0) / 100);
    v_line_total :=
      coalesce((v_line ->> 'quantity')::numeric, 0)
      * coalesce((v_line ->> 'unitPrice')::numeric, 0)
      - v_line_discount;
    v_subtotal := v_subtotal + v_line_total;

    if v_post_inventory then
      if v_warehouse_id is null then
        raise exception 'warehouseId is required when postInventory is true.' using errcode = 'P0001';
      end if;

      select *
        into v_stock_balance
      from icecream_erp.stock_balances
      where organization_id = p_organization_id
        and item_id = (v_line ->> 'itemId')::uuid
        and warehouse_id = v_warehouse_id
      for update;

      if v_stock_balance.id is null then
        raise exception 'Stock balance was not found for item %.', v_line ->> 'itemId'
          using errcode = 'P0001';
      end if;

      if coalesce(v_stock_balance.quantity_available, v_stock_balance.quantity, 0) < (v_line ->> 'quantity')::numeric then
        raise exception 'Insufficient stock for item %.', v_line ->> 'itemId'
          using errcode = 'P0001';
      end if;

      if coalesce(v_stock_balance.avg_cost, 0) <= 0 and coalesce((v_line ->> 'allowZeroCost')::boolean, false) = false then
        raise exception 'Missing inventory cost for item %. Configure cost before posting COGS.', v_line ->> 'itemId'
          using errcode = 'P0001';
      end if;

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
    end if;
  end loop;

  v_total := greatest(0, v_subtotal + v_tax_amount - v_discount_amount);
  if v_total <= 0 then
    raise exception 'Invoice total must be positive.' using errcode = 'P0001';
  end if;

  v_paid_amount := least(v_total, greatest(0, coalesce((v_payment ->> 'amount')::numeric, 0)));
  if v_paid_amount >= v_total then
    v_invoice_status := 'PAID';
  elsif v_paid_amount > 0 then
    v_invoice_status := 'PARTIAL_PAID';
  end if;

  if coalesce(v_customer.credit_limit, 0) > 0
     and coalesce(v_customer.current_balance, v_customer.outstanding_balance, 0) + (v_total - v_paid_amount) > v_customer.credit_limit
     and not v_allow_credit_override then
    raise exception 'Customer credit limit exceeded. Authorization is required.'
      using errcode = 'P0001';
  end if;

  insert into icecream_erp.invoices (
    id, organization_id, invoice_number, order_id, sales_order_id, customer_id, invoice_date, due_date,
    status, subtotal, tax_amount, total_amount, total, paid_amount, amount_paid, balance_due,
    warehouse_id, branch_id, department_id, cost_center_code, currency_code, exchange_rate, idempotency_key,
    idempotency_payload_hash, notes, created_by, posted_by, posted_at
  )
  values (
    v_invoice_id, p_organization_id, v_invoice_number, nullif(p_invoice_payload ->> 'salesOrderId', '')::uuid,
    nullif(p_invoice_payload ->> 'salesOrderId', '')::uuid, v_customer.id, v_invoice_date, v_due_date,
    v_invoice_status::icecream_erp.invoice_status, v_subtotal, v_tax_amount, v_total, v_total,
    v_paid_amount, v_paid_amount, v_total - v_paid_amount, v_warehouse_id,
    v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate, v_idempotency_key,
    v_idempotency_payload_hash, nullif(p_invoice_payload ->> 'notes', ''), v_actor_user_account_id, v_actor_user_account_id, now()
  );

  for v_line in
    select value from jsonb_array_elements(p_invoice_payload -> 'items')
  loop
    v_line_discount :=
      coalesce((v_line ->> 'quantity')::numeric, 0)
      * coalesce((v_line ->> 'unitPrice')::numeric, 0)
      * (coalesce((v_line ->> 'discountPercent')::numeric, 0) / 100);

    insert into icecream_erp.invoice_items (
      invoice_id, item_id, quantity, unit_price, discount_percent, total_price
    )
    values (
      v_invoice_id,
      (v_line ->> 'itemId')::uuid,
      (v_line ->> 'quantity')::numeric,
      (v_line ->> 'unitPrice')::numeric,
      coalesce((v_line ->> 'discountPercent')::numeric, 0),
      (v_line ->> 'quantity')::numeric * (v_line ->> 'unitPrice')::numeric - v_line_discount
    );
  end loop;

  update icecream_erp.customers
  set current_balance = coalesce(current_balance, outstanding_balance, 0) + (v_total - v_paid_amount),
      outstanding_balance = coalesce(outstanding_balance, current_balance, 0) + (v_total - v_paid_amount),
      updated_at = now()
  where id = v_customer.id;

  if nullif(p_invoice_payload ->> 'salesOrderId', '') is not null then
    update icecream_erp.sales_orders
    set status = 'INVOICED',
        updated_at = now()
    where id = nullif(p_invoice_payload ->> 'salesOrderId', '')::uuid;
  end if;

  v_ar_account_id := icecream_erp.sales_resolve_posting_account_id(
    p_organization_id, 'sales_invoice', 'ACCOUNTS_RECEIVABLE', v_branch_id
  );
  v_revenue_account_id := icecream_erp.sales_resolve_posting_account_id(
    p_organization_id, 'sales_invoice', 'SALES_REVENUE', v_branch_id
  );
  if v_tax_amount > 0 then
    v_vat_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id, 'sales_invoice', 'VAT_OUTPUT', v_branch_id, null, null, nullif(p_invoice_payload ->> 'taxCode', '')
    );
  end if;
  if v_stock_cost_total > 0 then
    v_cogs_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id, 'sales_invoice', 'COST_OF_GOODS_SOLD', v_branch_id
    );
    v_inventory_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id, 'sales_invoice', 'FINISHED_GOODS_INVENTORY', v_branch_id
    );
  end if;

  v_net_sales := v_total - v_tax_amount;
  v_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
  insert into icecream_erp.journal_entries (
    organization_id, entry_number, entry_date, description, reference, reference_type, reference_id,
    branch_id, department_id, cost_center_code, currency_code, exchange_rate,
    status, is_posted, posted_by, posted_at, created_by, approved_by,
    total_debit, total_credit
  )
  values (
    p_organization_id, v_journal_number, v_invoice_date, 'Sales invoice ' || v_invoice_number,
    'sales:sales_invoice:' || v_invoice_id::text, 'sales_invoice', v_invoice_id::text,
    v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate,
    'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id,
    v_total + v_stock_cost_total, v_total + v_stock_cost_total
  )
  returning id into v_journal_id;

  insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
  values
    (v_journal_id, v_ar_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Accounts receivable for invoice ' || v_invoice_number, v_total, 0),
    (v_journal_id, v_revenue_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Sales revenue for invoice ' || v_invoice_number, 0, v_net_sales);

  if v_tax_amount > 0 then
    insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
    values (v_journal_id, v_vat_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Output VAT for invoice ' || v_invoice_number, 0, v_tax_amount);
  end if;

  if v_stock_cost_total > 0 then
    insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
    values
      (v_journal_id, v_cogs_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Cost of goods sold for invoice ' || v_invoice_number, v_stock_cost_total, 0),
      (v_journal_id, v_inventory_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Inventory issue for invoice ' || v_invoice_number, 0, v_stock_cost_total);
  end if;

  if v_paid_amount > 0 then
    v_payment_date := coalesce(nullif(v_payment ->> 'paymentDate', '')::date, v_invoice_date);
    perform icecream_erp.sales_assert_open_period(p_organization_id, v_payment_date);
    v_payment_number := icecream_erp.sales_next_document_number(p_organization_id, 'SALES_PAYMENT', 'PAY');
    insert into icecream_erp.payments (
      organization_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method,
      reference_number, notes, status, branch_id, department_id, cost_center_code, currency_code, exchange_rate,
      idempotency_key, idempotency_payload_hash, created_by
    )
    values (
      p_organization_id, v_payment_number, v_customer.id, v_invoice_id, v_payment_date,
      v_paid_amount, coalesce(nullif(v_payment_method, ''), 'CASH'), nullif(v_payment ->> 'referenceNumber', ''),
      coalesce(nullif(v_payment ->> 'notes', ''), 'Receipt for invoice ' || v_invoice_number), 'PAID',
      v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate,
      nullif(v_payment ->> 'idempotencyKey', ''),
      case when nullif(v_payment ->> 'idempotencyKey', '') is not null then encode(extensions.digest(convert_to(v_payment::text, 'UTF8'), 'sha256'), 'hex') else null end,
      v_actor_user_account_id
    )
    returning id into v_payment_id;

    v_cash_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id,
      'invoice_payment',
      case
        when v_payment_method in ('BANK', 'BANK_TRANSFER', 'CARD', 'POS') then 'BANK_ACCOUNT'
        when v_payment_method in ('ECOCASH', 'ONEMONEY', 'MUKURU', 'MOBILE_MONEY') then 'MOBILE_MONEY'
        else 'CASH_ON_HAND'
      end,
      v_branch_id,
      coalesce(nullif(v_payment_method, ''), 'CASH')
    );
    insert into icecream_erp.sales_payment_tenders (
      organization_id, payment_id, payment_method, amount, reference_number, gl_account_id
    )
    values (
      p_organization_id, v_payment_id, coalesce(nullif(v_payment_method, ''), 'CASH'), v_paid_amount,
      nullif(v_payment ->> 'referenceNumber', ''), v_cash_account_id
    );
    insert into icecream_erp.sales_payment_allocations (
      organization_id, payment_id, invoice_id, allocated_amount
    )
    values (p_organization_id, v_payment_id, v_invoice_id, v_paid_amount);

    v_payment_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
    insert into icecream_erp.journal_entries (
      organization_id, entry_number, entry_date, description, reference, reference_type, reference_id,
      branch_id, department_id, cost_center_code, currency_code, exchange_rate,
      status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
    )
    values (
      p_organization_id, v_payment_journal_number, v_payment_date,
      'Customer receipt ' || v_payment_number, 'sales:invoice_payment:' || v_payment_id::text,
      'invoice_payment', v_payment_id::text,
      v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate,
      'POSTED', true, v_actor_user_account_id, now(),
      v_actor_user_account_id, v_actor_user_account_id, v_paid_amount, v_paid_amount
    )
    returning id into v_payment_journal_id;

    insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
    values
      (v_payment_journal_id, v_cash_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Customer receipt ' || v_payment_number, v_paid_amount, 0),
      (v_payment_journal_id, v_ar_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Reduce accounts receivable for ' || v_invoice_number, 0, v_paid_amount);
  end if;

  insert into icecream_erp.sales_document_relationships (
    organization_id, source_document_type, source_document_id, related_document_type, related_document_id, relationship_type
  )
  values (p_organization_id, 'sales_invoice', v_invoice_id, 'journal_entry', v_journal_id, 'GL_POSTING')
  on conflict do nothing;

  if v_payment_id is not null then
    insert into icecream_erp.sales_document_relationships (
      organization_id, source_document_type, source_document_id, related_document_type, related_document_id, relationship_type
    )
    values
      (p_organization_id, 'sales_invoice', v_invoice_id, 'payment', v_payment_id, 'PAYMENT'),
      (p_organization_id, 'payment', v_payment_id, 'journal_entry', v_payment_journal_id, 'GL_POSTING')
    on conflict do nothing;
  end if;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id, 'SALES_INVOICE_TRANSACTION_POSTED',
    'invoices', v_invoice_id, 'sales_invoice', v_invoice_id,
    jsonb_build_object('invoiceNumber', v_invoice_number, 'journalId', v_journal_id, 'paymentId', v_payment_id)
  );

  return jsonb_build_object(
    'success', true,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'journalId', v_journal_id,
    'journalNumber', v_journal_number,
    'paymentId', v_payment_id,
    'paymentNumber', v_payment_number,
    'paymentJournalId', v_payment_journal_id,
    'paymentJournalNumber', v_payment_journal_number,
    'sourceReference', 'sales:sales_invoice:' || v_invoice_id::text
  );
end;
$$;

create or replace function icecream_erp.post_sales_payment_transaction(
  p_organization_id uuid,
  p_actor_user_profile_id uuid,
  p_payment_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = icecream_erp, pg_temp
as $$
declare
  v_actor_user_account_id uuid;
  v_account_id uuid;
  v_amount numeric(18,2) := coalesce((p_payment_payload ->> 'amount')::numeric, 0);
  v_balance_due numeric(18,2);
  v_branch_id uuid := nullif(p_payment_payload ->> 'branchId', '')::uuid;
  v_cost_center_code text := nullif(p_payment_payload ->> 'costCenterCode', '');
  v_currency_code text := coalesce(nullif(p_payment_payload ->> 'currencyCode', ''), 'USD');
  v_customer record;
  v_department_id uuid := nullif(p_payment_payload ->> 'departmentId', '')::uuid;
  v_exchange_rate numeric(18,6) := coalesce((p_payment_payload ->> 'exchangeRate')::numeric, 1);
  v_existing_payment record;
  v_idempotency_key text := nullif(p_payment_payload ->> 'idempotencyKey', '');
  v_idempotency_payload_hash text := null;
  v_invoice record;
  v_journal_id uuid;
  v_journal_number text;
  v_next_amount_paid numeric(18,2);
  v_next_balance_due numeric(18,2);
  v_next_status text;
  v_payment_date date := coalesce(nullif(p_payment_payload ->> 'paymentDate', '')::date, current_date);
  v_payment_id uuid;
  v_payment_method text := upper(coalesce(p_payment_payload ->> 'paymentMethod', 'CASH'));
  v_payment_number text;
  v_receivable_account_id uuid;
  v_tender jsonb;
  v_tenders jsonb := coalesce(p_payment_payload -> 'tenders', '[]'::jsonb);
  v_tender_account_id uuid;
  v_tender_method text;
  v_tender_total numeric(18,2) := 0;
begin
  if v_exchange_rate <= 0 then
    raise exception 'exchangeRate must be greater than zero.' using errcode = 'P0001';
  end if;

  select user_account_id
    into v_actor_user_account_id
  from icecream_erp.users
  where id = p_actor_user_profile_id
    and status = 'active'
  limit 1;

  if v_actor_user_account_id is null
     and exists (select 1 from icecream_erp.user_accounts where id = p_actor_user_profile_id and organization_id = p_organization_id) then
    v_actor_user_account_id := p_actor_user_profile_id;
  end if;

  if v_actor_user_account_id is null then
    raise exception 'Active actor account was not found.' using errcode = 'P0001';
  end if;

  if v_idempotency_key is not null then
    v_idempotency_payload_hash := encode(extensions.digest(convert_to(p_payment_payload::text, 'UTF8'), 'sha256'), 'hex');

    select pay.id, pay.payment_number, pay.invoice_id, pay.idempotency_payload_hash, journal.id as journal_id, journal.entry_number as journal_number
      into v_existing_payment
    from icecream_erp.payments pay
    left join icecream_erp.journal_entries journal
      on journal.organization_id = pay.organization_id
     and journal.reference_type = 'invoice_payment'
     and journal.reference_id = pay.id::text
    where pay.organization_id = p_organization_id
      and pay.idempotency_key = v_idempotency_key
    limit 1;

    if v_existing_payment.id is not null then
      if v_existing_payment.idempotency_payload_hash is distinct from v_idempotency_payload_hash then
        raise exception 'Idempotency key was already used with a different payment payload.' using errcode = 'P0001';
      end if;

      return jsonb_build_object(
        'success', true,
        'idempotentReplay', true,
        'invoiceId', v_existing_payment.invoice_id,
        'paymentId', v_existing_payment.id,
        'paymentNumber', v_existing_payment.payment_number,
        'journalId', v_existing_payment.journal_id,
        'journalNumber', v_existing_payment.journal_number,
        'sourceReference', 'sales:invoice_payment:' || v_existing_payment.id::text
      );
    end if;
  end if;

  if jsonb_typeof(v_tenders) = 'array' and jsonb_array_length(v_tenders) > 0 then
    for v_tender in select value from jsonb_array_elements(v_tenders)
    loop
      if coalesce((v_tender ->> 'amount')::numeric, 0) <= 0 then
        raise exception 'Tender amounts must be positive.' using errcode = 'P0001';
      end if;
      v_tender_total := v_tender_total + (v_tender ->> 'amount')::numeric;
    end loop;

    if v_amount <= 0 then
      v_amount := v_tender_total;
    elsif round(v_amount, 2) <> round(v_tender_total, 2) then
      raise exception 'Tender totals must equal payment amount.' using errcode = 'P0001';
    end if;
  else
    if v_amount <= 0 then
      raise exception 'Payment amount must be positive.' using errcode = 'P0001';
    end if;
    v_tenders := jsonb_build_array(jsonb_build_object(
      'paymentMethod', v_payment_method,
      'amount', v_amount,
      'referenceNumber', nullif(p_payment_payload ->> 'referenceNumber', '')
    ));
  end if;

  perform icecream_erp.sales_assert_open_period(p_organization_id, v_payment_date);

  select *
    into v_invoice
  from icecream_erp.invoices
  where id = (p_payment_payload ->> 'invoiceId')::uuid
    and organization_id = p_organization_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice not found.' using errcode = 'P0001';
  end if;

  if upper(v_invoice.status::text) = 'CANCELLED' then
    raise exception 'Cannot record payment on cancelled invoice.' using errcode = 'P0001';
  end if;

  if nullif(p_payment_payload ->> 'customerId', '') is not null
     and (p_payment_payload ->> 'customerId')::uuid <> v_invoice.customer_id then
    raise exception 'Payment customer does not match invoice customer.' using errcode = 'P0001';
  end if;

  v_branch_id := coalesce(v_branch_id, v_invoice.branch_id);

  v_balance_due := coalesce(v_invoice.balance_due, 0);
  if v_amount > v_balance_due then
    raise exception 'Payment amount exceeds invoice balance.' using errcode = 'P0001';
  end if;

  select *
    into v_customer
  from icecream_erp.customers
  where id = v_invoice.customer_id
    and organization_id = p_organization_id
  for update;

  if v_customer.id is null then
    raise exception 'Customer not found.' using errcode = 'P0001';
  end if;

  v_payment_number := icecream_erp.sales_next_document_number(p_organization_id, 'SALES_PAYMENT', 'PAY');
  insert into icecream_erp.payments (
    organization_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method,
    reference_number, notes, status, branch_id, department_id, cost_center_code, currency_code, exchange_rate,
    idempotency_key, idempotency_payload_hash, created_by
  )
  values (
    p_organization_id, v_payment_number, v_customer.id, v_invoice.id, v_payment_date, v_amount,
    case when v_payment_method = 'BANK_TRANSFER' then 'BANK' else v_payment_method end,
    nullif(p_payment_payload ->> 'referenceNumber', ''),
    coalesce(nullif(p_payment_payload ->> 'notes', ''), 'Invoice payment for ' || v_invoice.invoice_number),
    'PAID', v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate,
    v_idempotency_key, v_idempotency_payload_hash, v_actor_user_account_id
  )
  returning id into v_payment_id;

  insert into icecream_erp.sales_payment_allocations (
    organization_id, payment_id, invoice_id, allocated_amount
  )
  values (p_organization_id, v_payment_id, v_invoice.id, v_amount);

  v_next_amount_paid := coalesce(v_invoice.amount_paid, v_invoice.paid_amount, 0) + v_amount;
  v_next_balance_due := greatest(0, coalesce(v_invoice.total, v_invoice.total_amount, 0) - v_next_amount_paid);
  v_next_status := case when v_next_balance_due = 0 then 'PAID' else 'PARTIAL_PAID' end;

  update icecream_erp.invoices
  set amount_paid = v_next_amount_paid,
      paid_amount = v_next_amount_paid,
      balance_due = v_next_balance_due,
      status = v_next_status::icecream_erp.invoice_status,
      updated_at = now()
  where id = v_invoice.id;

  update icecream_erp.customers
  set current_balance = greatest(0, coalesce(current_balance, outstanding_balance, 0) - v_amount),
      outstanding_balance = greatest(0, coalesce(outstanding_balance, current_balance, 0) - v_amount),
      updated_at = now()
  where id = v_customer.id;

  v_receivable_account_id := icecream_erp.sales_resolve_posting_account_id(
    p_organization_id, 'sales_invoice', 'ACCOUNTS_RECEIVABLE', v_branch_id
  );

  v_journal_number := icecream_erp.sales_next_document_number(p_organization_id, 'JOURNAL_ENTRY', 'JE');
  insert into icecream_erp.journal_entries (
    organization_id, entry_number, entry_date, description, reference, reference_type, reference_id,
    branch_id, department_id, cost_center_code, currency_code, exchange_rate,
    status, is_posted, posted_by, posted_at, created_by, approved_by, total_debit, total_credit
  )
  values (
    p_organization_id, v_journal_number, v_payment_date, 'Customer payment ' || v_payment_number,
    'sales:invoice_payment:' || v_payment_id::text, 'invoice_payment', v_payment_id::text,
    v_branch_id, v_department_id, v_cost_center_code, v_currency_code, v_exchange_rate,
    'POSTED', true, v_actor_user_account_id, now(), v_actor_user_account_id, v_actor_user_account_id,
    v_amount, v_amount
  )
  returning id into v_journal_id;

  for v_tender in select value from jsonb_array_elements(v_tenders)
  loop
    v_tender_method := upper(coalesce(v_tender ->> 'paymentMethod', v_payment_method, 'CASH'));
    v_tender_account_id := icecream_erp.sales_resolve_posting_account_id(
      p_organization_id,
      'invoice_payment',
      case
        when v_tender_method in ('BANK', 'BANK_TRANSFER', 'CARD', 'POS') then 'BANK_ACCOUNT'
        when v_tender_method in ('ECOCASH', 'ONEMONEY', 'MUKURU', 'MOBILE_MONEY') then 'MOBILE_MONEY'
        else 'CASH_ON_HAND'
      end,
      v_branch_id,
      v_tender_method
    );

    insert into icecream_erp.sales_payment_tenders (
      organization_id, payment_id, payment_method, amount, reference_number, gl_account_id
    )
    values (
      p_organization_id, v_payment_id, v_tender_method, (v_tender ->> 'amount')::numeric,
      coalesce(nullif(v_tender ->> 'referenceNumber', ''), nullif(p_payment_payload ->> 'referenceNumber', '')),
      v_tender_account_id
    );

    insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
    values (
      v_journal_id, v_tender_account_id, v_branch_id, v_department_id, v_cost_center_code,
      'Customer payment ' || v_payment_number || ' via ' || v_tender_method,
      (v_tender ->> 'amount')::numeric, 0
    );
  end loop;

  insert into icecream_erp.journal_entry_lines (journal_entry_id, account_id, branch_id, department_id, cost_center_code, description, debit_amount, credit_amount)
  values (v_journal_id, v_receivable_account_id, v_branch_id, v_department_id, v_cost_center_code, 'Reduce accounts receivable for invoice ' || v_invoice.invoice_number, 0, v_amount);

  insert into icecream_erp.sales_document_relationships (
    organization_id, source_document_type, source_document_id, related_document_type, related_document_id, relationship_type
  )
  values
    (p_organization_id, 'payment', v_payment_id, 'invoice', v_invoice.id, 'ALLOCATION'),
    (p_organization_id, 'payment', v_payment_id, 'journal_entry', v_journal_id, 'GL_POSTING')
  on conflict do nothing;

  insert into icecream_erp.audit_logs (
    organization_id, user_id, user_profile_id, action, table_name, record_id, entity_type, entity_id, new_values
  )
  values (
    p_organization_id, v_actor_user_account_id, p_actor_user_profile_id, 'SALES_PAYMENT_TRANSACTION_POSTED',
    'payments', v_payment_id, 'payment', v_payment_id,
    jsonb_build_object('invoiceId', v_invoice.id, 'paymentNumber', v_payment_number, 'journalId', v_journal_id)
  );

  return jsonb_build_object(
    'success', true,
    'invoiceId', v_invoice.id,
    'invoiceNumber', v_invoice.invoice_number,
    'paymentId', v_payment_id,
    'paymentNumber', v_payment_number,
    'journalId', v_journal_id,
    'journalNumber', v_journal_number,
    'sourceReference', 'sales:invoice_payment:' || v_payment_id::text
  );
end;
$$;

revoke all on function icecream_erp.post_sales_invoice_transaction(uuid, uuid, jsonb) from public;
revoke all on function icecream_erp.post_sales_payment_transaction(uuid, uuid, jsonb) from public;
revoke all on function icecream_erp.sales_assert_open_period(uuid, date) from public;
revoke all on function icecream_erp.sales_resolve_posting_account_id(uuid, text, text, uuid, text, uuid, text) from public;
revoke all on function icecream_erp.sales_next_document_number(uuid, text, text) from public;

grant execute on function icecream_erp.post_sales_invoice_transaction(uuid, uuid, jsonb) to service_role;
grant execute on function icecream_erp.post_sales_payment_transaction(uuid, uuid, jsonb) to service_role;
grant execute on function icecream_erp.sales_assert_open_period(uuid, date) to service_role;
grant execute on function icecream_erp.sales_resolve_posting_account_id(uuid, text, text, uuid, text, uuid, text) to service_role;
grant execute on function icecream_erp.sales_next_document_number(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
