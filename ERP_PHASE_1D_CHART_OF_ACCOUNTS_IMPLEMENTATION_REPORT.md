# ERP Phase 1D Chart of Accounts Implementation Report

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Preserved prior batch: Phase 1C sales, pricing, posting, branch authorization, invoice printing

## Summary

Phase 1D is implemented in the repository without applying the migration. The batch adds the chart-of-accounts foundation, configurable account mappings, cost-centre foundation, opening-balance workflow, finance UI improvements, and targeted tests.

## Audit Findings Carried Forward

- live accounts already enforce unique `(organization_id, code)`
- baseline account enum did not support `HEADER`, `CONTRA_ASSET`, `CONTRA_REVENUE`, `OTHER_INCOME`
- baseline accounts did not have `allow_posting` or `normal_balance`
- baseline repo only had `sales_posting_account_mappings`
- baseline opening balances lacked branch, cost-centre, currency, effective-date, and fiscal-period fields

See `ERP_PHASE_1D_CHART_OF_ACCOUNTS_AUDIT.md` for the full baseline.

## Migration Filename

- `migrations/043_finance_chart_of_accounts_foundation.sql`
- rollback: `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
- verification: `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`

## Exact Files Changed

- `ERP_PHASE_1D_CHART_OF_ACCOUNTS_AUDIT.md`
- `ERP_PHASE_1D_CHART_OF_ACCOUNTS_IMPLEMENTATION_REPORT.md`
- `migrations/043_finance_chart_of_accounts_foundation.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
- `migrations/manual/043_finance_chart_of_accounts_foundation.verify.sql`
- `src/lib/finance-foundation.ts`
- `src/lib/finance-foundation-server.ts`
- `src/lib/finance-server.ts`
- `src/lib/finance.ts`
- `src/app/api/finance/chart-of-accounts/route.ts`
- `src/app/api/finance/chart-of-accounts/[id]/route.ts`
- `src/app/api/finance/meta/route.ts`
- `src/app/api/finance/opening-balances/route.ts`
- `src/app/api/finance/opening-balances/post/route.ts`
- `src/app/api/finance/journal-entries/route.ts`
- `src/app/api/finance/journal-entries/[id]/post/route.ts`
- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx`
- `src/app/(dashboard)/finance/opening-balances/page.tsx`
- `src/app/(dashboard)/finance/page.tsx`
- `src/components/finance/finance-nav.tsx`
- `src/hooks/finance/useFinanceResources.ts`
- `src/app/api/procurement/supplier-invoices/[id]/post/route.ts`
- `src/app/api/procurement/supplier-payments/route.ts`
- `src/app/api/sales/payments/route.ts`
- `src/app/api/sales/invoices/[id]/payment/route.ts`
- `tests/finance-helpers.test.ts`

## Accounts Created

The seed definition contains:

- total accounts: `110`
- header accounts: `10`
- posting accounts: `100`

Source:

- `src/lib/finance-foundation.ts:69-228`
- `src/lib/finance-foundation.ts:436-440`

Actual inserted-versus-updated row counts are data-dependent at migration runtime because the migration uses organization-scoped upsert:

- `on conflict (organization_id, code) do update`
- Evidence: `migrations/043_finance_chart_of_accounts_foundation.sql:395-401`

## Accounts Updated

Existing compatible accounts are updated in place instead of duplicated:

- preserved by `(organization_id, code)` uniqueness
- enforced by migration upsert
- supported by API-level uniqueness checks in server helpers

Evidence:

- `migrations/043_finance_chart_of_accounts_foundation.sql:96-97`
- `migrations/043_finance_chart_of_accounts_foundation.sql:395-401`
- `src/lib/finance-foundation-server.ts:171-273`

## Hierarchy

The official hierarchy is defined in `src/lib/finance-foundation.ts` and supports:

- parent-child nesting
- header versus posting distinction
- normal-balance metadata
- flattening for tree rendering

Evidence:

- `src/lib/finance-foundation.ts:69-228`
- `src/lib/finance-foundation.ts:325-392`
- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx:104-114`

## Posting and Header Behavior

Implemented behavior:

- header accounts cannot receive postings
- inactive accounts cannot receive postings
- active posting accounts can receive postings
- journal create and journal post paths both validate account posting eligibility

Evidence:

- `src/lib/finance-foundation.ts:265-283`
- `src/app/api/finance/journal-entries/route.ts:98-119`
- `src/app/api/finance/journal-entries/[id]/post/route.ts:77-93`
- `tests/finance-helpers.test.ts:410-437`

## Transaction Mappings

The batch adds a general ERP mapping foundation:

- default mappings defined in code: `31`
- dedicated DB table: `icecream_erp.erp_account_mappings`

Evidence:

- `src/lib/finance-foundation.ts:196-228`
- `migrations/043_finance_chart_of_accounts_foundation.sql:120-139`
- `migrations/043_finance_chart_of_accounts_foundation.sql:558-575`
- `src/lib/finance-foundation-server.ts:315-378`

Compatibility decisions:

- `DEFAULT_SALES_REVENUE` maps to posting child `4120`, not header `4000`
- `COST_OF_GOODS_SOLD` maps to posting child `5110`, not header `5000`

Reason:

- header accounts cannot safely receive postings

Evidence:

- `src/lib/finance-foundation.ts:213`
- `src/lib/finance-foundation.ts:219`
- `tests/finance-helpers.test.ts:350-351`

## Cost Centres

The batch adds:

- default cost centres: `11`
- dynamic branch cost-centre synchronization
- dedicated `icecream_erp.cost_centres` table

Evidence:

- `src/lib/finance-foundation.ts:182-194`
- `src/lib/finance-foundation-server.ts:380-421`
- `migrations/043_finance_chart_of_accounts_foundation.sql:99-117`
- `migrations/043_finance_chart_of_accounts_foundation.sql:437-519`

Branch sync behavior:

- one cost centre is generated for each active branch
- branch names are not hard-coded

Evidence:

- `src/lib/finance-foundation-server.ts:380-421`
- `tests/finance-helpers.test.ts:440-449`

## Opening Balances

Implemented:

- list API
- create draft API
- post-drafts API
- balanced draft validation
- organization scope
- branch support
- cost-centre support
- currency support
- effective date support
- fiscal-period support
- duplicate prevention
- posting through a balanced journal
- closed fiscal-period blocking

Evidence:

- `migrations/043_finance_chart_of_accounts_foundation.sql:142-155`
- `src/lib/finance-foundation.ts:394-434`
- `src/lib/finance-foundation-server.ts:549-769`
- `src/app/api/finance/opening-balances/route.ts:19-53`
- `src/app/api/finance/opening-balances/post/route.ts:6-27`
- `src/app/(dashboard)/finance/opening-balances/page.tsx:48-129`
- `tests/finance-helpers.test.ts:451-497`

## API Changes

### Chart of Accounts API

Implemented:

- list
- tree view
- detail
- create
- update
- delete guarded by history checks
- search
- filter by type
- filter by active status

Evidence:

- `src/app/api/finance/chart-of-accounts/route.ts:6-79`
- `src/app/api/finance/chart-of-accounts/[id]/route.ts:13-98`

Security:

- read requires `finance.read`
- writes require `finance.write`
- all operations use authenticated `organizationId`

Evidence:

- `src/app/api/finance/chart-of-accounts/route.ts:7-9`
- `src/app/api/finance/chart-of-accounts/route.ts:42-45`
- `src/app/api/finance/chart-of-accounts/[id]/route.ts:14-16`
- `src/app/api/finance/chart-of-accounts/[id]/route.ts:31-33`

### Finance Meta API

- syncs branch cost centres before returning metadata
- exposes accounts, cash accounts, bank accounts, branches, cost centres, currencies, fiscal periods

Evidence:

- `src/app/api/finance/meta/route.ts:6-14`
- `src/lib/finance-foundation-server.ts:423-485`

### Opening Balances API

- read requires `finance.read`
- draft create requires `finance.write`
- posting requires `finance.write` or `finance.gl.post`

Evidence:

- `src/app/api/finance/opening-balances/route.ts:7-9`
- `src/app/api/finance/opening-balances/route.ts:20-22`
- `src/app/api/finance/opening-balances/post/route.ts:7-9`

## UI Changes

### Chart of Accounts UI

Added:

- account tree view
- code, name, type, parent, posting/header indicator, active status, balance
- search
- type filter
- active filter
- create/edit drawer
- activate/deactivate support
- ledger access link
- loading and empty-state handling

Evidence:

- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx:95-114`
- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx:196-254`
- `src/app/(dashboard)/finance/chart-of-accounts/page.tsx:314-388`

### Finance Dashboard Shortcuts

Added role-filtered shortcuts for:

- Chart of Accounts
- New Journal
- Opening Balances
- Trial Balance
- Income Statement
- Balance Sheet
- Cash Flow
- Bank Reconciliation
- Customer Receipts
- Supplier Payments
- Budget versus Actual

Evidence:

- `src/app/(dashboard)/finance/page.tsx:48-63`
- `src/app/(dashboard)/finance/page.tsx:101-112`
- `src/components/finance/finance-nav.tsx:26`

### Opening Balances UI

Added a usable finance form and draft list:

- posting-account selector
- branch selector
- cost-centre selector
- currency selector
- draft filtering
- post action

Evidence:

- `src/app/(dashboard)/finance/opening-balances/page.tsx:48-129`
- `src/app/(dashboard)/finance/opening-balances/page.tsx:287`
- `src/hooks/finance/useFinanceResources.ts:87-139`

## Sales and Procurement Posting Updates

Hard-coded fallback account codes were replaced with configurable mapping resolution in the affected posting routes.

Evidence:

- Procurement supplier invoices: `src/app/api/procurement/supplier-invoices/[id]/post/route.ts:40-42`
- Procurement supplier payments: `src/app/api/procurement/supplier-payments/route.ts:211-217`
- Sales payments: `src/app/api/sales/payments/route.ts:285-289`
- Sales invoice payment: `src/app/api/sales/invoices/[id]/payment/route.ts:271-275`

## Tests Added

Phase 1D added targeted finance coverage for:

- unique chart codes and counts
- hierarchy building
- header/inactive posting validation
- branch cost-centre synchronization
- opening-balance balancing rules
- static migration and route assertions

Evidence:

- `tests/finance-helpers.test.ts:345-497`

## Validation Results

Executed successfully:

- `npm run test:finance`
- `npm run test:sales`
- `npm run test:inventory`
- `npm run test:procurement`
- `npm run test:production`
- `npm run test:branches`
- `npm run lint`
- `npm run build`
- `git diff --check`

Observed notes:

- `npm run lint` completed with two pre-existing React hook warnings in maintenance and sales customer pages outside this batch.
- `git diff --check` exited cleanly and only emitted line-ending warnings about LF to CRLF normalization.
- build initially surfaced one real issue: `src/lib/finance-server.ts` imported new posting helpers from `@/lib/finance` instead of `@/lib/finance-foundation`; this was corrected and build then completed cleanly.

## Rollback Steps

Prepared but not executed:

1. review changes against `migrations/manual/043_finance_chart_of_accounts_foundation.rollback.sql`
2. run rollback in a controlled maintenance window after reversing dependent app deploys
3. re-run the verification SQL to confirm removal or restoration

No rollback was executed in this task.

## Deployment Order

1. review `043_finance_chart_of_accounts_foundation.sql`
2. apply migration `043`
3. run verification SQL
4. deploy app code
5. re-run targeted finance, sales, procurement, inventory, production checks in the target environment

No deployment was performed in this task.

## Known Risks

1. Runtime inserted-versus-updated counts depend on existing organization data because the migration is intentionally idempotent.
2. Chart administration is permission-based, not hard-coded to role names; role-permission assignments must remain correct.
3. Branch cost-centre volume depends on active branch count at migration runtime.
4. Opening balances now depend on the existing `opening_account_balances` contract from earlier migrations; environments that drifted from migrations `015` and `030` must be verified before apply.

## Next Recommended Batch

1. Apply migration `043` in a controlled environment and run the verification SQL.
2. Add live integration coverage for finance account creation, mapping resolution, and opening-balance posting against a real database contract.
3. Extend downstream modules to consume cost centres and ERP mappings beyond the current Sales and Procurement fallback paths.
