-- Core backbone data repair for August 23, 2026.
-- Applies only to icecream_erp and only to proven configuration gaps.

update icecream_erp.branches
set default_warehouse_id = warehouses.id
from icecream_erp.warehouses
where branches.organization_id = warehouses.organization_id
  and branches.name = 'Main Branch'
  and warehouses.code = '1000'
  and warehouses.branch_id = branches.id;

update icecream_erp.branches
set default_warehouse_id = warehouses.id
from icecream_erp.warehouses
where branches.organization_id = warehouses.organization_id
  and branches.name = 'Makoni'
  and warehouses.code = '123'
  and warehouses.branch_id = branches.id;

update icecream_erp.branches
set default_warehouse_id = warehouses.id
from icecream_erp.warehouses
where branches.organization_id = warehouses.organization_id
  and branches.name = 'Mbare Branch'
  and warehouses.code = '1234MJ'
  and warehouses.branch_id = branches.id;

insert into icecream_erp.settings_payment_methods (
  organization_id,
  code,
  name,
  is_active
)
select
  organizations.id,
  seeded.code,
  seeded.name,
  true
from icecream_erp.organizations
cross join (
  values
    ('CASH', 'Cash'),
    ('BANK', 'Bank'),
    ('CREDIT', 'Credit')
) as seeded(code, name)
where organizations.id = 'd81ad59c-f207-40cd-8842-a0c6da10da1c'
  and not exists (
    select 1
    from icecream_erp.settings_payment_methods existing
    where existing.organization_id = organizations.id
      and existing.code = seeded.code
  );
