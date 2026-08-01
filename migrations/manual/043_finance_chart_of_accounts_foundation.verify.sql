-- Verification companion for 043_finance_chart_of_accounts_foundation.sql
-- Raises exceptions when foundational finance seed data is incomplete.

\echo 'VERIFY 043: foundation data'

do $$
declare
  v_missing_labels text[];
  v_expected_account_count integer := 110;
  v_expected_mapping_count integer := 31;
  v_expected_cost_centre_count integer := 11;
  v_org record;
begin
  if to_regtype('icecream_erp.account_type') is null then
    raise exception 'VERIFY 043 failed: missing enum icecream_erp.account_type. Apply 042a_finance_account_type_enum_prerequisites.sql first.';
  end if;

  select array_agg(required.enum_label order by required.enum_label)
  into v_missing_labels
  from (
    values
      ('HEADER'),
      ('CONTRA_ASSET'),
      ('CONTRA_REVENUE'),
      ('OTHER_INCOME')
  ) as required(enum_label)
  where not exists (
    select 1
    from pg_enum enum
    where enum.enumtypid = 'icecream_erp.account_type'::regtype
      and enum.enumlabel = required.enum_label
  );

  if coalesce(array_length(v_missing_labels, 1), 0) > 0 then
    raise exception 'VERIFY 043 failed: missing account_type enum prerequisite labels from 042a_finance_account_type_enum_prerequisites.sql: %', array_to_string(v_missing_labels, ', ');
  end if;

  if not exists (select 1 from icecream_erp.organizations) then
    raise exception 'VERIFY 043 failed: no organizations found in icecream_erp.organizations.';
  end if;

  for v_org in
    select id
    from icecream_erp.organizations
  loop
    if (
      select count(*)
      from icecream_erp.accounts account
      where account.organization_id = v_org.id
    ) < v_expected_account_count then
      raise exception 'VERIFY 043 failed: organization % has fewer than % seeded chart-of-accounts rows.', v_org.id, v_expected_account_count;
    end if;

    if exists (
      select 1
      from icecream_erp.accounts account
      where account.organization_id = v_org.id
      group by account.code
      having count(*) > 1
    ) then
      raise exception 'VERIFY 043 failed: organization % has duplicate account codes.', v_org.id;
    end if;

    if exists (
      select 1
      from icecream_erp.accounts account
      where account.organization_id = v_org.id
        and upper(account.type::text) = 'HEADER'
        and coalesce(account.allow_posting, true) = true
    ) then
      raise exception 'VERIFY 043 failed: organization % has HEADER accounts with allow_posting=true.', v_org.id;
    end if;

    if exists (
      select 1
      from icecream_erp.accounts account
      where account.organization_id = v_org.id
        and upper(account.type::text) <> 'HEADER'
        and nullif(account.normal_balance, '') is null
    ) then
      raise exception 'VERIFY 043 failed: organization % has posting accounts without normal_balance.', v_org.id;
    end if;

    if (
      select count(*)
      from icecream_erp.cost_centres centre
      where centre.organization_id = v_org.id
        and centre.branch_id is null
    ) < v_expected_cost_centre_count then
      raise exception 'VERIFY 043 failed: organization % has fewer than % base cost centres.', v_org.id, v_expected_cost_centre_count;
    end if;

    if (
      select count(*)
      from icecream_erp.erp_account_mappings mapping
      where mapping.organization_id = v_org.id
        and mapping.branch_id is null
        and mapping.is_active = true
    ) < v_expected_mapping_count then
      raise exception 'VERIFY 043 failed: organization % has fewer than % default ERP account mappings.', v_org.id, v_expected_mapping_count;
    end if;

    if exists (
      with required_mappings(mapping_key) as (
        values
          ('CASH_ACCOUNT'),
          ('BANK_ACCOUNT'),
          ('PETTY_CASH_ACCOUNT'),
          ('ACCOUNTS_RECEIVABLE'),
          ('VAT_INPUT'),
          ('RAW_MATERIAL_INVENTORY'),
          ('PACKAGING_INVENTORY'),
          ('WORK_IN_PROGRESS'),
          ('FINISHED_GOODS_INVENTORY'),
          ('BRANCH_INVENTORY'),
          ('GOODS_IN_TRANSIT'),
          ('INVENTORY_VARIANCE'),
          ('ACCOUNTS_PAYABLE'),
          ('SUPPLIER_PAYABLES'),
          ('VAT_OUTPUT'),
          ('VAT_PAYABLE'),
          ('DEFAULT_SALES_REVENUE'),
          ('BRANCH_SALES_REVENUE'),
          ('WHOLESALE_SALES_REVENUE'),
          ('RETAIL_SALES_REVENUE'),
          ('DISCOUNT_ALLOWED'),
          ('SALES_RETURNS'),
          ('COST_OF_GOODS_SOLD'),
          ('RAW_MATERIALS_CONSUMED'),
          ('PACKAGING_COST'),
          ('PRODUCTION_LABOUR'),
          ('PRODUCTION_OVERHEAD'),
          ('INVENTORY_WRITE_OFF'),
          ('PRODUCTION_VARIANCE'),
          ('EXCHANGE_GAIN'),
          ('EXCHANGE_LOSS')
      )
      select 1
      from required_mappings required
      left join icecream_erp.erp_account_mappings mapping
        on mapping.organization_id = v_org.id
       and mapping.mapping_key = required.mapping_key
       and mapping.branch_id is null
       and mapping.is_active = true
      left join icecream_erp.accounts account
        on account.id = mapping.account_id
      where mapping.id is null
         or account.id is null
         or coalesce(account.allow_posting, false) = false
    ) then
      raise exception 'VERIFY 043 failed: organization % is missing required default ERP account mappings or points to non-posting accounts.', v_org.id;
    end if;
  end loop;
end $$;

select
  organization_id,
  count(*) as total_accounts,
  count(*) filter (where upper(type::text) = 'HEADER' or allow_posting = false) as header_accounts,
  count(*) filter (where allow_posting = true) as posting_accounts
from icecream_erp.accounts
group by organization_id
order by organization_id;

select
  mapping.organization_id,
  count(*) filter (where mapping.branch_id is null) as default_mapping_count,
  count(*) filter (where mapping.branch_id is not null) as branch_mapping_count
from icecream_erp.erp_account_mappings mapping
group by mapping.organization_id
order by mapping.organization_id;
