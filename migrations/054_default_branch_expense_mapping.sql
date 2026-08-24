-- Adds the default branch expense posting account expected by branch expense posting.
-- Additive only; preserves existing chart and mappings.

with required_account as (
  select
    org.id as organization_id,
    '6100' as code,
    'Branch Operating Expenses' as name,
    'EXPENSE'::icecream_erp.account_type as type,
    true as allow_posting,
    'DEBIT' as normal_balance,
    'Default posting account for branch operating expenses.' as description
  from icecream_erp.organizations org
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
  required_account.organization_id,
  required_account.code,
  required_account.name,
  required_account.type,
  null,
  true,
  0,
  required_account.description,
  required_account.allow_posting,
  required_account.normal_balance,
  now(),
  now()
from required_account
where not exists (
  select 1
  from icecream_erp.accounts existing
  where existing.organization_id = required_account.organization_id
    and existing.code = required_account.code
);

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
  'DEFAULT_BRANCH_EXPENSE',
  account.id,
  null,
  'Default branch operating expense mapping.',
  true,
  now(),
  now()
from icecream_erp.accounts account
where account.code = '6100'
  and account.is_active = true
  and not exists (
    select 1
    from icecream_erp.erp_account_mappings existing
    where existing.organization_id = account.organization_id
      and existing.mapping_key = 'DEFAULT_BRANCH_EXPENSE'
      and existing.branch_id is null
  );

notify pgrst, 'reload schema';
