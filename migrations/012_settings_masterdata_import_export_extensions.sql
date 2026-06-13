create table if not exists icecream_erp.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  setting_key text not null,
  setting_value jsonb not null,
  module_name text not null default 'settings',
  description text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz null,
  deactivated_by uuid null
);

create unique index if not exists idx_system_settings_unique_key
  on icecream_erp.system_settings (setting_key);
create index if not exists idx_system_settings_module
  on icecream_erp.system_settings (organization_id, module_name, is_active);

create table if not exists icecream_erp.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  from_unit_id uuid not null,
  to_unit_id uuid not null,
  conversion_factor numeric(18,6) not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unit_conversions_unique
  on icecream_erp.unit_conversions (organization_id, from_unit_id, to_unit_id);
create index if not exists idx_unit_conversions_active
  on icecream_erp.unit_conversions (organization_id, is_active);

create table if not exists icecream_erp.settings_flavours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_flavours_unique
  on icecream_erp.settings_flavours (organization_id, code);

create table if not exists icecream_erp.settings_chocolate_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_chocolate_types_unique
  on icecream_erp.settings_chocolate_types (organization_id, code);

create table if not exists icecream_erp.settings_box_sizes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  box_capacity numeric(18,3) not null default 0,
  unit_id uuid null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_box_sizes_unique
  on icecream_erp.settings_box_sizes (organization_id, code);

create table if not exists icecream_erp.settings_product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  item_id uuid not null,
  code text not null,
  name text not null,
  flavour_id uuid null,
  chocolate_type_id uuid null,
  size_label text null,
  packaging text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_product_variants_unique
  on icecream_erp.settings_product_variants (organization_id, code);
create index if not exists idx_settings_product_variants_item
  on icecream_erp.settings_product_variants (item_id, is_active);

create table if not exists icecream_erp.settings_packaging_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_item_id uuid not null,
  packaging_item_id uuid not null,
  quantity_required numeric(18,3) not null default 0,
  unit_id uuid null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_packaging_rules_unique
  on icecream_erp.settings_packaging_rules (organization_id, product_item_id, packaging_item_id);

create table if not exists icecream_erp.settings_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  payment_type text not null default 'CASH',
  requires_reference boolean not null default false,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_payment_methods_unique
  on icecream_erp.settings_payment_methods (organization_id, code);

create table if not exists icecream_erp.settings_approval_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  document_type text not null,
  action_name text not null,
  required_role text not null,
  approval_level text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settings_approval_settings_module
  on icecream_erp.settings_approval_settings (organization_id, module_name, document_type, is_active);

create table if not exists icecream_erp.settings_expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_expense_categories_unique
  on icecream_erp.settings_expense_categories (organization_id, code);

create table if not exists icecream_erp.settings_customer_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  credit_limit numeric(18,2) null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_customer_groups_unique
  on icecream_erp.settings_customer_groups (organization_id, code);

create table if not exists icecream_erp.settings_import_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  template_name text not null,
  module_name text not null,
  data_type text not null,
  required_columns jsonb not null default '[]'::jsonb,
  optional_columns jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_settings_import_templates_unique
  on icecream_erp.settings_import_templates (template_name);

create table if not exists icecream_erp.settings_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module_name text not null,
  data_type text not null,
  file_name text not null,
  status text not null default 'UPLOADED',
  total_rows integer not null default 0,
  successful_rows integer not null default 0,
  failed_rows integer not null default 0,
  error_summary text null,
  imported_at timestamptz not null default now(),
  imported_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settings_import_batches_org
  on icecream_erp.settings_import_batches (organization_id, created_at desc, status);

create table if not exists icecream_erp.settings_import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null,
  row_number integer not null,
  raw_row_data jsonb not null,
  validation_status text not null default 'VALID',
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_settings_import_batch_rows_batch
  on icecream_erp.settings_import_batch_rows (import_batch_id, row_number);

create table if not exists icecream_erp.settings_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  data_type text not null,
  export_format text not null default 'CSV',
  filters jsonb not null default '{}'::jsonb,
  file_name text not null,
  status text not null default 'EXPORTED',
  exported_at timestamptz not null default now(),
  exported_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_settings_export_batches_org
  on icecream_erp.settings_export_batches (organization_id, created_at desc, data_type);

alter table if exists icecream_erp.number_series
  add column if not exists reset_frequency text not null default 'NEVER',
  add column if not exists deactivated_at timestamptz null,
  add column if not exists deactivated_by uuid null;

alter table if exists icecream_erp.item_categories
  add column if not exists code text null,
  add column if not exists stock_category text null,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

create unique index if not exists idx_item_categories_code_unique
  on icecream_erp.item_categories (organization_id, code)
  where code is not null;

alter table if exists icecream_erp.units_of_measure
  add column if not exists code text null,
  add column if not exists unit_type text null,
  add column if not exists is_base_unit boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz null;

create unique index if not exists idx_units_of_measure_code_unique
  on icecream_erp.units_of_measure (organization_id, code)
  where code is not null;
