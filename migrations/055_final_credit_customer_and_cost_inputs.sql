-- Final additive compatibility for credit branch sales and production costing inputs.
-- Scope: icecream_erp only. No global roles, no public/auth changes, no destructive changes.

alter table icecream_erp.branch_sales
  add column if not exists customer_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_sales_customer_id_fkey'
      and conrelid = 'icecream_erp.branch_sales'::regclass
  ) then
    alter table icecream_erp.branch_sales
      add constraint branch_sales_customer_id_fkey
      foreign key (customer_id)
      references icecream_erp.customers (id);
  end if;
end $$;

create index if not exists idx_branch_sales_customer_id
  on icecream_erp.branch_sales (customer_id)
  where customer_id is not null;

alter table icecream_erp.production_batch_materials
  add column if not exists material_type text null,
  add column if not exists is_packaging boolean null;

create index if not exists idx_production_batch_materials_batch_type
  on icecream_erp.production_batch_materials (batch_id, material_type);

notify pgrst, 'reload schema';
