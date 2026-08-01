# ERP Phase 1D Chart of Accounts Audit

Date: 2026-08-01
Branch: `fix/sales-invoice-production`

## Scope

This audit was completed from the repository state on disk before any migration execution. It inspects the chart-of-accounts baseline, finance posting dependencies, and the repo artifacts required for Phase 1D.

## Files Inspected

- `package.json`
- `migrations/manual/icecream_erp_live_schema_20260712.sql`
- `migrations/015_admin_migration_backup_health_readiness.sql`
- `migrations/030_full_schema_contract_recovery.sql`
- `migrations/040_sales_finance_transaction_engine.sql`
- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `src/lib/finance.ts`
- `src/lib/finance-server.ts`
- `src/lib/finance-foundation.ts`
- `src/lib/finance-foundation-server.ts`
- `src/app/api/finance/chart-of-accounts/route.ts`
- `src/app/api/finance/chart-of-accounts/[id]/route.ts`
- `src/app/api/finance/meta/route.ts`
- `src/app/api/finance/opening-balances/route.ts`
- `src/app/api/finance/opening-balances/post/route.ts`
- `src/app/api/finance/journal-entries/route.ts`
- `src/app/api/finance/journal-entries/[id]/post/route.ts`
- `src/app/(dashboard)/finance/page.tsx`
- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx`
- `src/app/(dashboard)/finance/opening-balances/page.tsx`
- `src/components/finance/finance-nav.tsx`
- `src/hooks/finance/useFinanceResources.ts`
- `src/app/api/procurement/supplier-invoices/[id]/post/route.ts`
- `src/app/api/procurement/supplier-payments/route.ts`
- `src/app/api/sales/payments/route.ts`
- `src/app/api/sales/invoices/[id]/payment/route.ts`
- `tests/finance-helpers.test.ts`
- `tests/branch-helpers.test.ts`
- `tests/sales-helpers.test.ts`

## Baseline Schema Findings

### Existing account table and columns

The live schema dump shows a legacy `icecream_erp.accounts` table with these core columns:

- `id`, `organization_id`, `code`, `name`, `type`, `parent_id`, `is_active`, `balance`, `description`, timestamps
- Evidence: `migrations/manual/icecream_erp_live_schema_20260712.sql:661-672`

Parent-child support already exists through `parent_id`:

- Evidence: `migrations/manual/icecream_erp_live_schema_20260712.sql:667`

### Existing account-type constraints

The live enum only contains:

- `ASSET`
- `LIABILITY`
- `EQUITY`
- `REVENUE`
- `EXPENSE`
- `COST_OF_SALES`

Evidence: `migrations/manual/icecream_erp_live_schema_20260712.sql:32-39`

Implication:

- No baseline support for `HEADER`
- No baseline support for `CONTRA_ASSET`
- No baseline support for `CONTRA_REVENUE`
- No baseline support for `OTHER_INCOME`

### Existing account codes and duplicate-code control

The live schema already enforces uniqueness on `(organization_id, code)`:

- Evidence: `migrations/manual/icecream_erp_live_schema_20260712.sql:2566-2570`

That means duplicate account codes are already blocked at the database level in deployed schema. Phase 1D still preserves this requirement with an explicit compatibility index in the new migration.

### Posting-account support

The live schema dump does not contain `allow_posting` or `normal_balance` on `icecream_erp.accounts`.

- Search result: no matches for `allow_posting` or `normal_balance` in `migrations/manual/icecream_erp_live_schema_20260712.sql`

Implication:

- The baseline schema can distinguish parent-child structure, but not header-versus-posting behavior.
- Journal posting logic therefore needed a new explicit posting guard.

### Header-account support

The baseline schema has no header account type and no non-postable account flag.

Implication:

- Header accounts were not first-class finance objects in the deployed baseline.
- Any tree view would be structural only, not enforcement-capable, until Phase 1D.

### Existing journals

The repo already had journal-line posting infrastructure before Phase 1D:

- `opening_account_balances` existed in migrations `015` and `030`
- `sales_posting_account_mappings` existed in migration `040`

Evidence:

- `migrations/015_admin_migration_backup_health_readiness.sql:94-111`
- `migrations/030_full_schema_contract_recovery.sql:2634-2654`
- `migrations/040_sales_finance_transaction_engine.sql:153-169`

### Existing account mappings

Before Phase 1D, the repo only had sales-specific posting mappings:

- `icecream_erp.sales_posting_account_mappings`
- Evidence: `migrations/040_sales_finance_transaction_engine.sql:153-169`

The repo did not have a general ERP-wide account-mapping table in the live schema dump:

- Search result: no matches for `erp_account_mappings` in `migrations/manual/icecream_erp_live_schema_20260712.sql`

### Cost-centre support

The live schema dump does not contain `icecream_erp.cost_centres`.

- Search result: no matches for `cost_centres` in `migrations/manual/icecream_erp_live_schema_20260712.sql`

Implication:

- Finance routing could not assign cost centres from a dedicated master table before Phase 1D.

### Branch support

Branch-specific finance behavior already existed indirectly:

- sales posting mappings support optional `branch_id`
- current branch authorization is handled in shared app auth and branch-access utilities

Evidence:

- `migrations/040_sales_finance_transaction_engine.sql:160`
- `src/app/api/finance/chart-of-accounts/route.ts:7-9`
- `src/app/api/finance/opening-balances/post/route.ts:7-9`

### Opening-balance baseline

The existing `opening_account_balances` table was minimal:

- `organization_id`, `migration_batch_id`, `account_id`, debit/credit, `reference`, `remarks`, `posting_status`, audit fields
- No `branch_id`
- No `cost_center_code`
- No `currency_code`
- No `effective_date`
- No `fiscal_period_id`

Evidence:

- `migrations/015_admin_migration_backup_health_readiness.sql:94-111`
- `migrations/030_full_schema_contract_recovery.sql:2634-2654`

### Current Finance UI gaps identified during inspection

Baseline gaps that required Phase 1D implementation:

- no finance-native account tree contract in the live schema
- no general ERP account-mapping table
- no cost-centre master table
- no structured opening-balance metadata fields
- no explicit header/posting enforcement in baseline accounts

Remaining repo-level constraints after Phase 1D scope:

- write authorization is permission-based (`finance.write`, `finance.gl.post`), not role-name-based
- full report-engine redesign is intentionally out of scope for this batch
- actual create-versus-update counts depend on migration runtime data because the seed path uses upsert

## Migration Requirement

A migration was required because the deployed baseline lacked:

- extended account types
- `allow_posting`
- `normal_balance`
- `cost_centres`
- `erp_account_mappings`
- enriched opening-balance columns

The next available sequential prefix in the repo was `043`, so Phase 1D correctly targets:

- `migrations/043_finance_chart_of_accounts_foundation.sql`

## Compatibility Risks

1. The live schema dump already enforces unique `(organization_id, code)` on accounts, so any seed must update rather than duplicate.
2. Existing posting flows in Sales and Procurement previously depended on hard-coded legacy codes; those call sites needed migration to configurable lookups.
3. `opening_account_balances` already existed with a narrower contract, so the new migration had to be additive.
4. Header accounts `4000` and `5000` cannot safely be used as posting targets. Phase 1D therefore needed dedicated posting children for generic mappings.

## Audit Conclusion

The repository baseline was missing the finance foundations required for a structured chart of accounts and reusable ERP posting mappings. The Phase 1D implementation required:

- additive schema expansion
- organization-scoped account APIs
- posting validation in journal routes
- reusable mapping resolution for Sales and Procurement
- a dedicated opening-balance workflow
