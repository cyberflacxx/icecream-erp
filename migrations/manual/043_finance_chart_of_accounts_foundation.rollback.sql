-- Rollback companion for 043_finance_chart_of_accounts_foundation.sql
-- Note: PostgreSQL enum values are not removed by this rollback.

delete from icecream_erp.sales_posting_account_mappings
where (document_type, posting_role) in (
  ('sales_invoice', 'ACCOUNTS_RECEIVABLE'),
  ('sales_invoice', 'SALES_REVENUE'),
  ('sales_invoice', 'VAT_OUTPUT'),
  ('sales_invoice', 'COST_OF_GOODS_SOLD'),
  ('sales_invoice', 'FINISHED_GOODS_INVENTORY'),
  ('invoice_payment', 'BANK_ACCOUNT'),
  ('invoice_payment', 'CASH_ON_HAND'),
  ('invoice_payment', 'MOBILE_MONEY')
)
  and branch_id is null
  and payment_method_code is null
  and item_category_id is null
  and tax_code is null;

delete from icecream_erp.erp_account_mappings
where mapping_key in (
  'CASH_ACCOUNT',
  'BANK_ACCOUNT',
  'PETTY_CASH_ACCOUNT',
  'ACCOUNTS_RECEIVABLE',
  'VAT_INPUT',
  'RAW_MATERIAL_INVENTORY',
  'PACKAGING_INVENTORY',
  'WORK_IN_PROGRESS',
  'FINISHED_GOODS_INVENTORY',
  'BRANCH_INVENTORY',
  'GOODS_IN_TRANSIT',
  'INVENTORY_VARIANCE',
  'ACCOUNTS_PAYABLE',
  'SUPPLIER_PAYABLES',
  'VAT_OUTPUT',
  'VAT_PAYABLE',
  'DEFAULT_SALES_REVENUE',
  'BRANCH_SALES_REVENUE',
  'WHOLESALE_SALES_REVENUE',
  'RETAIL_SALES_REVENUE',
  'DISCOUNT_ALLOWED',
  'SALES_RETURNS',
  'COST_OF_GOODS_SOLD',
  'RAW_MATERIALS_CONSUMED',
  'PACKAGING_COST',
  'PRODUCTION_LABOUR',
  'PRODUCTION_OVERHEAD',
  'INVENTORY_WRITE_OFF',
  'PRODUCTION_VARIANCE',
  'EXCHANGE_GAIN',
  'EXCHANGE_LOSS'
);

delete from icecream_erp.cost_centres
where code in (
  'FACTORY',
  'PRODUCTION_DAY',
  'PRODUCTION_NIGHT',
  'STORES',
  'DISPATCH',
  'PROCUREMENT',
  'FINANCE',
  'ADMIN',
  'HR',
  'SALES',
  'MARKETING'
)
   or code like 'BRANCH_%';

delete from icecream_erp.accounts
where code in ('4120', '5110');

drop index if exists icecream_erp.idx_opening_account_balances_cost_center;
drop index if exists icecream_erp.idx_opening_account_balances_effective_date;

alter table if exists icecream_erp.opening_account_balances
  drop column if exists notes,
  drop column if exists fiscal_period_id,
  drop column if exists effective_date,
  drop column if exists exchange_rate,
  drop column if exists currency_code,
  drop column if exists cost_center_code,
  drop column if exists branch_id;

drop index if exists icecream_erp.idx_erp_account_mappings_org_branch;
drop index if exists icecream_erp.idx_erp_account_mappings_org_default;
drop table if exists icecream_erp.erp_account_mappings;

drop index if exists icecream_erp.idx_cost_centres_org_branch;
drop index if exists icecream_erp.idx_cost_centres_org_code;
drop table if exists icecream_erp.cost_centres;

drop index if exists icecream_erp.idx_accounts_org_code_unique;

alter table if exists icecream_erp.accounts
  drop constraint if exists accounts_normal_balance_check;

alter table if exists icecream_erp.accounts
  drop column if exists normal_balance,
  drop column if exists allow_posting;
