-- Phase 1D finance foundation
-- Additive only. Do not apply destructive DDL. All objects stay inside icecream_erp.

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'icecream_erp'::regnamespace
      and typname = 'account_type'
  ) then
    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.account_type'::regtype
        and enumlabel = 'HEADER'
    ) then
      alter type icecream_erp.account_type add value 'HEADER';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.account_type'::regtype
        and enumlabel = 'CONTRA_ASSET'
    ) then
      alter type icecream_erp.account_type add value 'CONTRA_ASSET';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.account_type'::regtype
        and enumlabel = 'CONTRA_REVENUE'
    ) then
      alter type icecream_erp.account_type add value 'CONTRA_REVENUE';
    end if;

    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'icecream_erp.account_type'::regtype
        and enumlabel = 'OTHER_INCOME'
    ) then
      alter type icecream_erp.account_type add value 'OTHER_INCOME';
    end if;
  end if;
end $$;

alter table if exists icecream_erp.accounts
  add column if not exists allow_posting boolean,
  add column if not exists normal_balance text null;

update icecream_erp.accounts
set allow_posting = coalesce(allow_posting, case when upper(type::text) = 'HEADER' then false else true end),
    normal_balance = coalesce(
      normal_balance,
      case
        when upper(type::text) in ('ASSET', 'EXPENSE', 'COST_OF_SALES', 'CONTRA_REVENUE') then 'DEBIT'
        when upper(type::text) in ('LIABILITY', 'EQUITY', 'REVENUE', 'OTHER_INCOME', 'CONTRA_ASSET') then 'CREDIT'
        else null
      end
    ),
    updated_at = now()
where allow_posting is null
   or normal_balance is null;

alter table if exists icecream_erp.accounts
  alter column allow_posting set default true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'icecream_erp'
      and table_name = 'accounts'
      and column_name = 'allow_posting'
  ) then
    alter table icecream_erp.accounts
      alter column allow_posting set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'icecream_erp'::regnamespace
      and conname = 'accounts_normal_balance_check'
  ) then
    alter table icecream_erp.accounts
      add constraint accounts_normal_balance_check
      check (normal_balance in ('DEBIT', 'CREDIT') or normal_balance is null);
  end if;
end $$;

create unique index if not exists idx_accounts_org_code_unique
  on icecream_erp.accounts (organization_id, code);

create table if not exists icecream_erp.cost_centres (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  code text not null,
  name text not null,
  branch_id uuid null references icecream_erp.branches(id),
  parent_id uuid null references icecream_erp.cost_centres(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_cost_centres_org_code
  on icecream_erp.cost_centres (organization_id, code);

create unique index if not exists idx_cost_centres_org_branch
  on icecream_erp.cost_centres (organization_id, branch_id)
  where branch_id is not null;

create table if not exists icecream_erp.erp_account_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references icecream_erp.organizations(id),
  mapping_key text not null,
  account_id uuid not null references icecream_erp.accounts(id),
  branch_id uuid null references icecream_erp.branches(id),
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists idx_erp_account_mappings_org_default
  on icecream_erp.erp_account_mappings (organization_id, mapping_key)
  where branch_id is null;

create unique index if not exists idx_erp_account_mappings_org_branch
  on icecream_erp.erp_account_mappings (organization_id, mapping_key, branch_id)
  where branch_id is not null;

alter table if exists icecream_erp.opening_account_balances
  add column if not exists branch_id uuid null references icecream_erp.branches(id),
  add column if not exists cost_center_code text null,
  add column if not exists currency_code text null default 'USD',
  add column if not exists exchange_rate numeric(18,6) not null default 1,
  add column if not exists effective_date date null default current_date,
  add column if not exists fiscal_period_id uuid null references icecream_erp.fiscal_periods(id),
  add column if not exists notes text null;

create index if not exists idx_opening_account_balances_effective_date
  on icecream_erp.opening_account_balances (organization_id, effective_date, posting_status);

create index if not exists idx_opening_account_balances_cost_center
  on icecream_erp.opening_account_balances (organization_id, cost_center_code);

alter table if exists icecream_erp.cost_centres enable row level security;
alter table if exists icecream_erp.erp_account_mappings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'cost_centres'
      and policyname = 'cost_centres_service_role_full_access'
  ) then
    create policy cost_centres_service_role_full_access
      on icecream_erp.cost_centres
      for all to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'cost_centres'
      and policyname = 'cost_centres_deny_anon'
  ) then
    create policy cost_centres_deny_anon
      on icecream_erp.cost_centres
      for all to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'cost_centres'
      and policyname = 'cost_centres_deny_authenticated'
  ) then
    create policy cost_centres_deny_authenticated
      on icecream_erp.cost_centres
      for all to authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'erp_account_mappings'
      and policyname = 'erp_account_mappings_service_role_full_access'
  ) then
    create policy erp_account_mappings_service_role_full_access
      on icecream_erp.erp_account_mappings
      for all to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'erp_account_mappings'
      and policyname = 'erp_account_mappings_deny_anon'
  ) then
    create policy erp_account_mappings_deny_anon
      on icecream_erp.erp_account_mappings
      for all to anon
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'icecream_erp'
      and tablename = 'erp_account_mappings'
      and policyname = 'erp_account_mappings_deny_authenticated'
  ) then
    create policy erp_account_mappings_deny_authenticated
      on icecream_erp.erp_account_mappings
      for all to authenticated
      using (false)
      with check (false);
  end if;
end $$;

revoke all on table icecream_erp.cost_centres from anon, authenticated;
revoke all on table icecream_erp.erp_account_mappings from anon, authenticated;

grant all on table icecream_erp.cost_centres to service_role;
grant all on table icecream_erp.erp_account_mappings to service_role;

with account_definitions(code, name, type, parent_code, allow_posting, normal_balance, description) as (
  values
    ('1000', 'Assets', 'HEADER', null, false, null, null),
    ('1100', 'Current Assets', 'HEADER', '1000', false, null, null),
    ('1110', 'Cash on Hand', 'ASSET', '1100', true, 'DEBIT', null),
    ('1120', 'Bank Account', 'ASSET', '1100', true, 'DEBIT', null),
    ('1130', 'Petty Cash', 'ASSET', '1100', true, 'DEBIT', null),
    ('1140', 'Accounts Receivable', 'ASSET', '1100', true, 'DEBIT', null),
    ('1150', 'Vendor Receivables', 'ASSET', '1100', true, 'DEBIT', null),
    ('1160', 'Employee Advances', 'ASSET', '1100', true, 'DEBIT', null),
    ('1170', 'VAT Input', 'ASSET', '1100', true, 'DEBIT', null),
    ('1180', 'Prepaid Expenses', 'ASSET', '1100', true, 'DEBIT', null),
    ('1200', 'Inventory Control', 'HEADER', '1100', false, null, null),
    ('1210', 'Raw Materials Inventory', 'ASSET', '1200', true, 'DEBIT', null),
    ('1211', 'Ice Cream Mix', 'ASSET', '1210', true, 'DEBIT', null),
    ('1212', 'UHT Milk', 'ASSET', '1210', true, 'DEBIT', null),
    ('1213', 'Chocolate', 'ASSET', '1210', true, 'DEBIT', null),
    ('1214', 'Sugar', 'ASSET', '1210', true, 'DEBIT', null),
    ('1215', 'Flavours', 'ASSET', '1210', true, 'DEBIT', null),
    ('1216', 'Colouring', 'ASSET', '1210', true, 'DEBIT', null),
    ('1217', 'Packaging Materials', 'ASSET', '1210', true, 'DEBIT', null),
    ('1218', 'Cones', 'ASSET', '1217', true, 'DEBIT', null),
    ('1219', 'Cups', 'ASSET', '1217', true, 'DEBIT', null),
    ('1220', 'Lids', 'ASSET', '1217', true, 'DEBIT', null),
    ('1221', 'Cheese', 'ASSET', '1210', true, 'DEBIT', null),
    ('1222', 'Yoghurt', 'ASSET', '1210', true, 'DEBIT', null),
    ('1230', 'Work In Progress', 'ASSET', '1200', true, 'DEBIT', null),
    ('1240', 'Finished Goods Inventory', 'ASSET', '1200', true, 'DEBIT', null),
    ('1250', 'Branch Inventory', 'ASSET', '1200', true, 'DEBIT', null),
    ('1260', 'Goods In Transit', 'ASSET', '1200', true, 'DEBIT', null),
    ('1270', 'Inventory Variance', 'ASSET', '1200', true, 'DEBIT', null),
    ('1300', 'Property Plant and Equipment', 'HEADER', '1000', false, null, null),
    ('1310', 'Buildings', 'ASSET', '1300', true, 'DEBIT', null),
    ('1320', 'Machinery', 'ASSET', '1300', true, 'DEBIT', null),
    ('1330', 'Freezers', 'ASSET', '1300', true, 'DEBIT', null),
    ('1340', 'Vehicles', 'ASSET', '1300', true, 'DEBIT', null),
    ('1350', 'Office Equipment', 'ASSET', '1300', true, 'DEBIT', null),
    ('1360', 'Computers', 'ASSET', '1300', true, 'DEBIT', null),
    ('1370', 'Accumulated Depreciation', 'CONTRA_ASSET', '1300', true, 'CREDIT', null),
    ('2000', 'Current Liabilities', 'HEADER', null, false, null, null),
    ('2100', 'Accounts Payable', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2110', 'Supplier Payables', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2120', 'Accrued Expenses', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2130', 'PAYE Payable', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2140', 'NSSA Payable', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2150', 'Pension Payable', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2160', 'VAT Output', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2170', 'VAT Payable', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2180', 'Loans', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('2190', 'Customer Deposits', 'LIABILITY', '2000', true, 'CREDIT', null),
    ('3000', 'Owner''s Capital', 'EQUITY', null, true, 'CREDIT', null),
    ('3100', 'Retained Earnings', 'EQUITY', null, true, 'CREDIT', null),
    ('3200', 'Current Year Profit', 'EQUITY', null, true, 'CREDIT', null),
    ('4000', 'Sales Revenue', 'HEADER', null, false, null, null),
    ('4010', 'Ice Cream Cone Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4020', 'Cups Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4030', '5L Ice Cream Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4040', '2L Ice Cream Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4050', 'Yoghurt Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4060', 'Cheese Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4070', 'Branch Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4080', 'Wholesale Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4090', 'Retail Sales', 'REVENUE', '4000', true, 'CREDIT', null),
    ('4100', 'Discount Allowed', 'CONTRA_REVENUE', '4000', true, 'DEBIT', null),
    ('4110', 'Sales Returns', 'CONTRA_REVENUE', '4000', true, 'DEBIT', null),
    ('4120', 'Default Sales Revenue', 'REVENUE', '4000', true, 'CREDIT', 'Compatibility child for generic sales postings.'),
    ('5000', 'Cost of Goods Sold', 'HEADER', null, false, null, null),
    ('5010', 'Raw Materials Consumed', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5020', 'Packaging Cost', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5030', 'Chocolate Consumption', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5040', 'Ice Cream Mix Consumption', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5050', 'UHT Consumption', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5060', 'Production Labour', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5070', 'Production Overheads', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5080', 'Factory Utilities', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5090', 'Inventory Write Off', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5100', 'Production Variance', 'EXPENSE', '5000', true, 'DEBIT', null),
    ('5110', 'Default Cost of Goods Sold', 'EXPENSE', '5000', true, 'DEBIT', 'Compatibility child for generic cost-of-sales postings.'),
    ('6000', 'Administrative Expenses', 'HEADER', null, false, null, null),
    ('6010', 'Salaries and Wages', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6020', 'Rent', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6030', 'Electricity', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6040', 'Water', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6050', 'Fuel', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6060', 'Vehicle Expenses', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6070', 'Repairs and Maintenance', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6080', 'Internet', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6090', 'Telephone', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6100', 'Office Expenses', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6110', 'Printing and Stationery', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6120', 'Cleaning', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6130', 'Security', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6140', 'Marketing', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6150', 'Advertising', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6160', 'Bank Charges', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6170', 'Insurance', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6180', 'Legal and Professional Fees', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6190', 'Depreciation', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6200', 'Training', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6210', 'Travel', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6220', 'Staff Welfare', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6230', 'Uniforms', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('6240', 'Licences and Permits', 'EXPENSE', '6000', true, 'DEBIT', null),
    ('7000', 'Other Income', 'HEADER', null, false, null, null),
    ('7010', 'Interest Income', 'OTHER_INCOME', '7000', true, 'CREDIT', null),
    ('7020', 'Rental Income', 'OTHER_INCOME', '7000', true, 'CREDIT', null),
    ('7030', 'Profit on Asset Disposal', 'OTHER_INCOME', '7000', true, 'CREDIT', null),
    ('7040', 'Exchange Gain', 'OTHER_INCOME', '7000', true, 'CREDIT', null),
    ('8000', 'Finance Costs', 'HEADER', null, false, null, null),
    ('8010', 'Interest Expense', 'EXPENSE', '8000', true, 'DEBIT', null),
    ('8020', 'Exchange Loss', 'EXPENSE', '8000', true, 'DEBIT', null),
    ('8030', 'Tax Expense', 'EXPENSE', '8000', true, 'DEBIT', null)
)
insert into icecream_erp.accounts (
  organization_id,
  code,
  name,
  type,
  parent_id,
  is_active,
  balance,
  description,
  allow_posting,
  normal_balance,
  created_at,
  updated_at
)
select
  org.id,
  definition.code,
  definition.name,
  definition.type::icecream_erp.account_type,
  null,
  true,
  0,
  definition.description,
  definition.allow_posting,
  definition.normal_balance,
  now(),
  now()
from icecream_erp.organizations org
cross join account_definitions definition
on conflict (organization_id, code) do update
set name = excluded.name,
    type = excluded.type,
    is_active = true,
    description = excluded.description,
    allow_posting = excluded.allow_posting,
    normal_balance = excluded.normal_balance,
    updated_at = now();

with account_definitions(code, parent_code) as (
  values
    ('1000', null), ('1100', '1000'), ('1110', '1100'), ('1120', '1100'), ('1130', '1100'), ('1140', '1100'),
    ('1150', '1100'), ('1160', '1100'), ('1170', '1100'), ('1180', '1100'), ('1200', '1100'), ('1210', '1200'),
    ('1211', '1210'), ('1212', '1210'), ('1213', '1210'), ('1214', '1210'), ('1215', '1210'), ('1216', '1210'),
    ('1217', '1210'), ('1218', '1217'), ('1219', '1217'), ('1220', '1217'), ('1221', '1210'), ('1222', '1210'),
    ('1230', '1200'), ('1240', '1200'), ('1250', '1200'), ('1260', '1200'), ('1270', '1200'), ('1300', '1000'),
    ('1310', '1300'), ('1320', '1300'), ('1330', '1300'), ('1340', '1300'), ('1350', '1300'), ('1360', '1300'),
    ('1370', '1300'), ('2000', null), ('2100', '2000'), ('2110', '2000'), ('2120', '2000'), ('2130', '2000'),
    ('2140', '2000'), ('2150', '2000'), ('2160', '2000'), ('2170', '2000'), ('2180', '2000'), ('2190', '2000'),
    ('3000', null), ('3100', null), ('3200', null), ('4000', null), ('4010', '4000'), ('4020', '4000'),
    ('4030', '4000'), ('4040', '4000'), ('4050', '4000'), ('4060', '4000'), ('4070', '4000'), ('4080', '4000'),
    ('4090', '4000'), ('4100', '4000'), ('4110', '4000'), ('4120', '4000'), ('5000', null), ('5010', '5000'),
    ('5020', '5000'), ('5030', '5000'), ('5040', '5000'), ('5050', '5000'), ('5060', '5000'), ('5070', '5000'),
    ('5080', '5000'), ('5090', '5000'), ('5100', '5000'), ('5110', '5000'), ('6000', null), ('6010', '6000'),
    ('6020', '6000'), ('6030', '6000'), ('6040', '6000'), ('6050', '6000'), ('6060', '6000'), ('6070', '6000'),
    ('6080', '6000'), ('6090', '6000'), ('6100', '6000'), ('6110', '6000'), ('6120', '6000'), ('6130', '6000'),
    ('6140', '6000'), ('6150', '6000'), ('6160', '6000'), ('6170', '6000'), ('6180', '6000'), ('6190', '6000'),
    ('6200', '6000'), ('6210', '6000'), ('6220', '6000'), ('6230', '6000'), ('6240', '6000'), ('7000', null),
    ('7010', '7000'), ('7020', '7000'), ('7030', '7000'), ('7040', '7000'), ('8000', null), ('8010', '8000'),
    ('8020', '8000'), ('8030', '8000')
)
update icecream_erp.accounts child
set parent_id = parent.id,
    updated_at = now()
from account_definitions definition
left join icecream_erp.accounts parent
  on parent.organization_id = child.organization_id
 and parent.code = definition.parent_code
where child.code = definition.code
  and child.organization_id in (select id from icecream_erp.organizations)
  and child.parent_id is distinct from parent.id;

with base_cost_centres(code, name, parent_code) as (
  values
    ('FACTORY', 'Factory', null),
    ('PRODUCTION_DAY', 'Production Day Shift', 'FACTORY'),
    ('PRODUCTION_NIGHT', 'Production Night Shift', 'FACTORY'),
    ('STORES', 'Stores', null),
    ('DISPATCH', 'Dispatch', null),
    ('PROCUREMENT', 'Procurement', null),
    ('FINANCE', 'Finance', null),
    ('ADMIN', 'Administration', null),
    ('HR', 'HR', null),
    ('SALES', 'Sales', null),
    ('MARKETING', 'Marketing', null)
)
insert into icecream_erp.cost_centres (
  organization_id, code, name, branch_id, parent_id, is_active, created_at, updated_at
)
select org.id, centre.code, centre.name, null, null, true, now(), now()
from icecream_erp.organizations org
cross join base_cost_centres centre
where not exists (
  select 1
  from icecream_erp.cost_centres existing
  where existing.organization_id = org.id
    and existing.code = centre.code
);

with base_cost_centres(code, parent_code) as (
  values
    ('FACTORY', null),
    ('PRODUCTION_DAY', 'FACTORY'),
    ('PRODUCTION_NIGHT', 'FACTORY'),
    ('STORES', null),
    ('DISPATCH', null),
    ('PROCUREMENT', null),
    ('FINANCE', null),
    ('ADMIN', null),
    ('HR', null),
    ('SALES', null),
    ('MARKETING', null)
)
update icecream_erp.cost_centres child
set parent_id = parent.id,
    updated_at = now()
from base_cost_centres centre
left join icecream_erp.cost_centres parent
  on parent.organization_id = child.organization_id
 and parent.code = centre.parent_code
where child.code = centre.code
  and child.branch_id is null
  and child.parent_id is distinct from parent.id;

with branch_cost_centres as (
  select
    branch.organization_id,
    branch.id as branch_id,
    'BRANCH_' || left(
      trim(both '_' from regexp_replace(upper(coalesce(nullif(branch.code, ''), nullif(branch.name, ''), 'UNSPECIFIED')), '[^A-Z0-9]+', '_', 'g')),
      40
    ) as code,
    coalesce(nullif(branch.name, ''), branch.code, 'Unnamed Branch') as name
  from icecream_erp.branches branch
  where branch.is_active = true
)
insert into icecream_erp.cost_centres (
  organization_id, code, name, branch_id, parent_id, is_active, created_at, updated_at
)
select
  centre.organization_id,
  centre.code,
  centre.name,
  centre.branch_id,
  sales_parent.id,
  true,
  now(),
  now()
from branch_cost_centres centre
left join icecream_erp.cost_centres sales_parent
  on sales_parent.organization_id = centre.organization_id
 and sales_parent.code = 'SALES'
where not exists (
  select 1
  from icecream_erp.cost_centres existing
  where existing.organization_id = centre.organization_id
    and existing.branch_id = centre.branch_id
);

with mapping_definitions(mapping_key, account_code, notes) as (
  values
    ('CASH_ACCOUNT', '1110', null),
    ('BANK_ACCOUNT', '1120', null),
    ('PETTY_CASH_ACCOUNT', '1130', null),
    ('ACCOUNTS_RECEIVABLE', '1140', null),
    ('VAT_INPUT', '1170', null),
    ('RAW_MATERIAL_INVENTORY', '1210', null),
    ('PACKAGING_INVENTORY', '1217', null),
    ('WORK_IN_PROGRESS', '1230', null),
    ('FINISHED_GOODS_INVENTORY', '1240', null),
    ('BRANCH_INVENTORY', '1250', null),
    ('GOODS_IN_TRANSIT', '1260', null),
    ('INVENTORY_VARIANCE', '1270', null),
    ('ACCOUNTS_PAYABLE', '2100', null),
    ('SUPPLIER_PAYABLES', '2110', null),
    ('VAT_OUTPUT', '2160', null),
    ('VAT_PAYABLE', '2170', null),
    ('DEFAULT_SALES_REVENUE', '4120', 'Dedicated posting child used instead of header 4000.'),
    ('BRANCH_SALES_REVENUE', '4070', null),
    ('WHOLESALE_SALES_REVENUE', '4080', null),
    ('RETAIL_SALES_REVENUE', '4090', null),
    ('DISCOUNT_ALLOWED', '4100', null),
    ('SALES_RETURNS', '4110', null),
    ('COST_OF_GOODS_SOLD', '5110', 'Dedicated posting child used instead of header 5000.'),
    ('RAW_MATERIALS_CONSUMED', '5010', null),
    ('PACKAGING_COST', '5020', null),
    ('PRODUCTION_LABOUR', '5060', null),
    ('PRODUCTION_OVERHEAD', '5070', null),
    ('INVENTORY_WRITE_OFF', '5090', null),
    ('PRODUCTION_VARIANCE', '5100', null),
    ('EXCHANGE_GAIN', '7040', null),
    ('EXCHANGE_LOSS', '8020', null)
)
insert into icecream_erp.erp_account_mappings (
  organization_id, mapping_key, account_id, branch_id, notes, is_active, created_at, updated_at
)
select
  account.organization_id,
  definition.mapping_key,
  account.id,
  null,
  definition.notes,
  true,
  now(),
  now()
from mapping_definitions definition
join icecream_erp.accounts account
  on account.code = definition.account_code
where not exists (
  select 1
  from icecream_erp.erp_account_mappings existing
  where existing.organization_id = account.organization_id
    and existing.mapping_key = definition.mapping_key
    and existing.branch_id is null
);

with mapping_definitions(document_type, posting_role, account_code) as (
  values
    ('sales_invoice', 'ACCOUNTS_RECEIVABLE', '1140'),
    ('sales_invoice', 'SALES_REVENUE', '4120'),
    ('sales_invoice', 'VAT_OUTPUT', '2160'),
    ('sales_invoice', 'COST_OF_GOODS_SOLD', '5110'),
    ('sales_invoice', 'FINISHED_GOODS_INVENTORY', '1240'),
    ('invoice_payment', 'BANK_ACCOUNT', '1120'),
    ('invoice_payment', 'CASH_ON_HAND', '1110'),
    ('invoice_payment', 'MOBILE_MONEY', '1120')
)
insert into icecream_erp.sales_posting_account_mappings (
  organization_id, module_name, document_type, posting_role, account_id, is_active, created_at, updated_at
)
select
  account.organization_id,
  'sales',
  definition.document_type,
  definition.posting_role,
  account.id,
  true,
  now(),
  now()
from mapping_definitions definition
join icecream_erp.accounts account
  on account.code = definition.account_code
where not exists (
  select 1
  from icecream_erp.sales_posting_account_mappings existing
  where existing.organization_id = account.organization_id
    and existing.document_type = definition.document_type
    and existing.posting_role = definition.posting_role
    and existing.branch_id is null
    and existing.payment_method_code is null
    and existing.item_category_id is null
    and existing.tax_code is null
);

notify pgrst, 'reload schema';
