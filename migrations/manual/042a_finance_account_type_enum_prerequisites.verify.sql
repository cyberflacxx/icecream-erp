-- Verification companion for 042a_finance_account_type_enum_prerequisites.sql
-- Raises exceptions when required account_type enum labels are missing.

\echo 'VERIFY 042A: account_type enum prerequisite'

do $$
declare
  v_missing_labels text[];
begin
  if to_regtype('icecream_erp.account_type') is null then
    raise exception 'VERIFY 042A failed: missing enum icecream_erp.account_type.';
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
    raise exception 'VERIFY 042A failed: missing account_type enum labels: %', array_to_string(v_missing_labels, ', ');
  end if;
end $$;

select
  enum.enumlabel
from pg_enum enum
where enum.enumtypid = 'icecream_erp.account_type'::regtype
  and enum.enumlabel in ('HEADER', 'CONTRA_ASSET', 'CONTRA_REVENUE', 'OTHER_INCOME')
order by enum.enumlabel;
