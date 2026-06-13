create table if not exists icecream_erp.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
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

create unique index if not exists idx_fiscal_periods_name
  on icecream_erp.fiscal_periods (organization_id, period_name);
create index if not exists idx_fiscal_periods_dates
  on icecream_erp.fiscal_periods (organization_id, start_date, end_date);
create index if not exists idx_fiscal_periods_status
  on icecream_erp.fiscal_periods (organization_id, status, is_locked);

create table if not exists icecream_erp.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  expense_date date not null,
  category text not null,
  branch_id uuid null,
  department_id uuid null,
  account_id uuid null,
  amount numeric(18,2) not null default 0,
  payment_method text not null default 'Cash',
  supporting_document text null,
  description text not null,
  source_document text null,
  status text not null default 'DRAFT',
  created_by uuid null,
  updated_by uuid null,
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_by uuid null,
  rejected_at timestamptz null,
  rejection_reason text null,
  posted_by uuid null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_finance_expenses_org
  on icecream_erp.finance_expenses (organization_id, expense_date);
create index if not exists idx_finance_expenses_status
  on icecream_erp.finance_expenses (organization_id, status);
create index if not exists idx_finance_expenses_branch
  on icecream_erp.finance_expenses (branch_id);
create index if not exists idx_finance_expenses_account
  on icecream_erp.finance_expenses (account_id);

create table if not exists icecream_erp.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null references icecream_erp.bank_accounts (id),
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(18,2) not null default 0,
  reference_number text null,
  description text null,
  source_document text null,
  status text not null default 'POSTED',
  created_by uuid null,
  posted_by uuid null,
  posted_at timestamptz null,
  reversed_by uuid null,
  reversed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bank_transactions_org
  on icecream_erp.bank_transactions (organization_id, transaction_date);
create index if not exists idx_bank_transactions_account
  on icecream_erp.bank_transactions (bank_account_id);
create index if not exists idx_bank_transactions_status
  on icecream_erp.bank_transactions (organization_id, status);

create table if not exists icecream_erp.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cash_account_id uuid not null references icecream_erp.cash_accounts (id),
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(18,2) not null default 0,
  source text null,
  reference text null,
  counterparty text null,
  remarks text null,
  status text not null default 'POSTED',
  created_by uuid null,
  posted_by uuid null,
  posted_at timestamptz null,
  reversed_by uuid null,
  reversed_at timestamptz null,
  voided_by uuid null,
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cash_transactions_org
  on icecream_erp.cash_transactions (organization_id, transaction_date);
create index if not exists idx_cash_transactions_account
  on icecream_erp.cash_transactions (cash_account_id);
create index if not exists idx_cash_transactions_status
  on icecream_erp.cash_transactions (organization_id, status);
