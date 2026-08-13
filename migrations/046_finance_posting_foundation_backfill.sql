-- Backfill the minimum finance posting foundation needed by live transactional
-- flows without rewriting legacy charts that already occupy overlapping header
-- codes such as 1000.

with required_accounts(code, name, type, allow_posting, normal_balance, description) as (
  values
    ('1110', 'Cash on Hand', 'ASSET', true, 'DEBIT', 'Backfilled posting account for ERP cash mappings.'),
    ('1120', 'Bank Account', 'ASSET', true, 'DEBIT', 'Backfilled posting account for ERP bank mappings.'),
    ('1130', 'Petty Cash', 'ASSET', true, 'DEBIT', 'Backfilled posting account for ERP petty cash mappings.'),
    ('1140', 'Accounts Receivable', 'ASSET', true, 'DEBIT', 'Backfilled posting account for ERP receivable mappings.'),
    ('1170', 'VAT Input', 'ASSET', true, 'DEBIT', 'Backfilled posting account for ERP VAT input mappings.'),
    ('1210', 'Raw Materials Inventory', 'ASSET', true, 'DEBIT', 'Backfilled posting account for raw material inventory postings.'),
    ('1217', 'Packaging Materials', 'ASSET', true, 'DEBIT', 'Backfilled posting account for packaging inventory postings.'),
    ('1230', 'Work In Progress', 'ASSET', true, 'DEBIT', 'Backfilled posting account for production WIP postings.'),
    ('1240', 'Finished Goods Inventory', 'ASSET', true, 'DEBIT', 'Backfilled posting account for finished-goods inventory postings.'),
    ('1250', 'Branch Inventory', 'ASSET', true, 'DEBIT', 'Backfilled posting account for branch inventory postings.'),
    ('1260', 'Goods In Transit', 'ASSET', true, 'DEBIT', 'Backfilled posting account for transfer-in-transit postings.'),
    ('1270', 'Inventory Variance', 'ASSET', true, 'DEBIT', 'Backfilled posting account for inventory variance postings.'),
    ('2100', 'Accounts Payable', 'LIABILITY', true, 'CREDIT', 'Backfilled posting account for ERP payable mappings.'),
    ('2110', 'Supplier Payables', 'LIABILITY', true, 'CREDIT', 'Backfilled posting account for supplier payable postings.'),
    ('2160', 'VAT Output', 'LIABILITY', true, 'CREDIT', 'Backfilled posting account for ERP VAT output mappings.'),
    ('2170', 'VAT Payable', 'LIABILITY', true, 'CREDIT', 'Backfilled posting account for ERP VAT payable mappings.'),
    ('4070', 'Branch Sales', 'REVENUE', true, 'CREDIT', 'Backfilled posting account for branch sales revenue mappings.'),
    ('4080', 'Wholesale Sales', 'REVENUE', true, 'CREDIT', 'Backfilled posting account for wholesale sales revenue mappings.'),
    ('4090', 'Retail Sales', 'REVENUE', true, 'CREDIT', 'Backfilled posting account for retail sales revenue mappings.'),
    ('4100', 'Discount Allowed', 'CONTRA_REVENUE', true, 'DEBIT', 'Backfilled posting account for discount postings.'),
    ('4110', 'Sales Returns', 'CONTRA_REVENUE', true, 'DEBIT', 'Backfilled posting account for sales return postings.'),
    ('4120', 'Default Sales Revenue', 'REVENUE', true, 'CREDIT', 'Backfilled posting account for generic sales revenue postings.'),
    ('5010', 'Raw Materials Consumed', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for raw material consumption postings.'),
    ('5020', 'Packaging Cost', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for packaging consumption postings.'),
    ('5060', 'Production Labour', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for production labour postings.'),
    ('5070', 'Production Overhead', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for production overhead postings.'),
    ('5090', 'Inventory Write Off', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for inventory write-off postings.'),
    ('5100', 'Production Variance', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for production variance postings.'),
    ('5110', 'Default Cost of Goods Sold', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for generic cost-of-goods-sold postings.'),
    ('7040', 'Exchange Gain', 'OTHER_INCOME', true, 'CREDIT', 'Backfilled posting account for exchange-gain postings.'),
    ('8020', 'Exchange Loss', 'EXPENSE', true, 'DEBIT', 'Backfilled posting account for exchange-loss postings.')
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
cross join required_accounts definition
where not exists (
  select 1
  from icecream_erp.accounts existing
  where existing.organization_id = org.id
    and existing.code = definition.code
);

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
  organization_id,
  code,
  name,
  branch_id,
  parent_id,
  is_active,
  created_at,
  updated_at
)
select
  org.id,
  centre.code,
  centre.name,
  null,
  null,
  true,
  now(),
  now()
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
from icecream_erp.cost_centres current_child
join base_cost_centres centre
  on centre.code = current_child.code
left join icecream_erp.cost_centres parent
  on parent.organization_id = current_child.organization_id
 and parent.code = centre.parent_code
where child.id = current_child.id
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
  where branch.status = 'ACTIVE'::icecream_erp.branch_status
    and branch.deleted_at is null
)
insert into icecream_erp.cost_centres (
  organization_id,
  code,
  name,
  branch_id,
  parent_id,
  is_active,
  created_at,
  updated_at
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
    ('DEFAULT_SALES_REVENUE', '4120', 'Dedicated posting child used instead of a header account.'),
    ('BRANCH_SALES_REVENUE', '4070', null),
    ('WHOLESALE_SALES_REVENUE', '4080', null),
    ('RETAIL_SALES_REVENUE', '4090', null),
    ('DISCOUNT_ALLOWED', '4100', null),
    ('SALES_RETURNS', '4110', null),
    ('COST_OF_GOODS_SOLD', '5110', 'Dedicated posting child used instead of a header account.'),
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
  organization_id,
  mapping_key,
  account_id,
  branch_id,
  notes,
  is_active,
  created_at,
  updated_at
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
  organization_id,
  module_name,
  document_type,
  posting_role,
  account_id,
  branch_id,
  payment_method_code,
  item_category_id,
  tax_code,
  is_active,
  created_at,
  updated_at
)
select
  account.organization_id,
  'sales',
  definition.document_type,
  definition.posting_role,
  account.id,
  null,
  null,
  null,
  null,
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
    and existing.module_name = 'sales'
    and existing.document_type = definition.document_type
    and existing.posting_role = definition.posting_role
    and existing.branch_id is null
    and existing.payment_method_code is null
    and existing.item_category_id is null
    and existing.tax_code is null
);
