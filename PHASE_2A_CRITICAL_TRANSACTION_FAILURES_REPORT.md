# Phase 2A Critical Transaction Failures Report

Date: 2026-08-02
Branch: `hotfix/phase-2a-critical-transaction-failures`
Production baseline: `030904b`

## 1. Root-cause report

| Issue | Failing screen | Failing request | Actual root cause | Affected files | Database impact | Correction | Test evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Items failing to load | item pickers across sales, inventory, procurement, production | `GET /api/inventory/items?selector=1...` | selector mode could over-read the full table, optional relationship failures surfaced as generic 500s, and selector payload was missing some required display fields | `src/app/api/inventory/items/route.ts`, `src/lib/item-selector.ts`, `src/hooks/useItemSelectorOptions.ts` | none | bounded selector pagination, safer optional-relationship handling, safe selector errors, added `taxStatus` to selector contract | `npm run test:inventory` |
| Prices failing to load | Sales Prices page and downstream price selection | `GET /api/sales/prices` | `sales_product_prices` was being read without organization scoping through owned items, causing stale/live schema mismatches and unsafe cross-org assumptions | `src/app/api/sales/prices/route.ts`, `src/lib/sales-pricing.ts` | none | organization-scoped price loading through active items, strengthened price priority helper, no-zero policy preserved | `npm run test:sales` |
| Sales invoice cannot be recorded | Sales Invoices page | `POST /api/sales/invoices` | invoice route still contained an unsafe fallback path that bypassed the atomic transaction engine when RPC posting failed | `src/app/api/sales/invoices/route.ts`, `src/lib/sales-pricing.ts` | none | removed manual fallback inserts, enforced transaction-engine-only posting, added idempotency-key fallback and controlled missing-engine error | `npm run test:sales` |
| Invoice and receipt printing unavailable | invoice payment flow, payments page, receipt page | receipt print URL and receipt page load | receipt printing depended on unsaved transient form data instead of saved payment records; reprint path was missing | `src/lib/sales-payments.ts`, `src/app/(dashboard)/sales/invoices/page.tsx`, `src/app/(dashboard)/sales/payments/page.tsx`, `src/app/(dashboard)/sales/payments/receipt/page.tsx` | none | receipt rendering now loads by saved `paymentId`; added reprint action from payment history | `npm run test:sales`, `npm run build` |
| Journal account selector not loading accounts | finance journal/account selector flows | `GET /api/finance/meta` | finance metadata sync still assumed `branches.is_active`, which is stale against the current production-compatible branch contract | `src/lib/finance-foundation-server.ts`, `src/app/api/finance/meta/route.ts` | none | branch sync now uses active non-deleted branch filtering with legacy fallback only where needed | `npm run test:finance` |
| Branch expense internal error | branch expense create/list flow | `GET/POST /api/branch-operations/[branchId]/expenses` | route assumed newer finance setup and newer `branch_expenses` columns unconditionally, leading to failures on live-compatible schemas | `src/app/api/branch-operations/[branchId]/expenses/route.ts` | none | added branch/cost-centre/payment-account/open-period validation and legacy-column-compatible insert fallback | `npm run test:branches` |
| Production reports internal error | production reports page | production report server query stack | report loader used brittle embedded PostgREST relationship paths that fail on compatibility gaps and missing columns | `src/lib/production-server.ts`, `src/app/(dashboard)/production/reports/page.tsx` | none | added compatibility fallback loading and zero-output costing notice | `npm run test:production` |
| Maintenance module internal error | maintenance schedules, breakdowns, machines | maintenance API list/create routes | top-level route failures still surfaced generic 500s even where compatibility fallbacks already existed | `src/app/api/maintenance/schedules/route.ts`, `src/app/api/maintenance/breakdowns/route.ts`, `src/app/api/maintenance/machines/route.ts` | none | switched affected routes to shared structured API error handling | `npm run build`, `npm run lint` |
| Generic "Internal Error" responses | affected flows above | multiple API routes | no shared server-side error-id logger existed for these routes, so failures were opaque to users and weakly traceable server-side | `src/lib/api-auth.ts` plus affected API routes above | writes to existing `icecream_erp.error_logs` only | added `apiServerError()` with unique error IDs and sanitized error logging | `npm run test:sales`, `npm run test:finance`, `npm run test:branches`, `npm run test:production` |

## 2. Changed-file list

- `src/lib/api-auth.ts`
- `src/lib/finance-foundation-server.ts`
- `src/app/api/finance/meta/route.ts`
- `src/lib/sales-pricing.ts`
- `src/app/api/sales/prices/route.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/lib/item-selector.ts`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/sales/invoices/route.ts`
- `src/lib/sales-payments.ts`
- `src/app/(dashboard)/sales/payments/receipt/page.tsx`
- `src/app/(dashboard)/sales/payments/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/api/branch-operations/[branchId]/expenses/route.ts`
- `src/lib/production-server.ts`
- `src/app/(dashboard)/production/reports/page.tsx`
- `src/app/api/maintenance/schedules/route.ts`
- `src/app/api/maintenance/breakdowns/route.ts`
- `src/app/api/maintenance/machines/route.ts`
- `tests/sales-helpers.test.ts`
- `tests/finance-helpers.test.ts`
- `tests/production-helpers.test.ts`
- `tests/branch-helpers.test.ts`

## 3. Migration files

None created in this branch.

## 4. Verification SQL

None created in this branch.

## 5. Automated tests

Executed:

- `npm test` -> failed because `package.json` does not define a `test` script
- `npm run test:sales` -> passed, 11/11
- `npm run test:finance` -> passed, 26/26
- `npm run test:production` -> passed, 61/61
- `npm run test:inventory` -> passed, 35/35
- `npm run test:procurement` -> passed, 56/56
- `npm run test:branches` -> passed, 11/11

Coverage added in this branch:

- sales price scoping and receipt print persistence
- finance meta branch filtering and safe error handling
- branch expense validation and legacy-column fallback
- production report compatibility fallback and zero-output notice

## 6. Test output summary

- `npm test`: `Missing script: "test"`
- targeted ERP module test scripts: all passed
- no database rehearsal script was required because no schema change was introduced

## 7. Build output

- `npm run lint` -> passed with two pre-existing warnings:
  - `src/app/(dashboard)/maintenance/machines/page.tsx` exhaustive-deps warning
  - `src/app/(dashboard)/sales/customers/page.tsx` exhaustive-deps warning
- `npm run build` -> passed on 2026-08-02
- `git diff --check` -> no whitespace errors; only CRLF normalization warnings from git

## 8. Deployment notes

- No migration or verification SQL needs deployment for this branch.
- Deploy application code only after normal CI and environment rollout checks.
- Because invoice posting now depends strictly on the transaction engine, production must still have the Sales Finance Transaction Engine deployment from migration `040_sales_finance_transaction_engine.sql` intact.
- Structured error logging writes to the existing `icecream_erp.error_logs` table via server-side service-role access.

## 9. Rollback notes

- Application rollback is code-only: redeploy the previous application build from before this hotfix.
- No schema rollback is required.
- Rolling back would restore the previous unsafe invoice fallback path and previous generic API failures, so rollback should only be used if a blocking regression is confirmed.

## 10. Known remaining issues

- `npm test` is still unavailable because the repository has no root `test` script.
- The invoice page already supports browser print preview through the saved invoice page, but this branch did not add a dedicated PDF-generation backend; receipt downloads still use printable HTML, not generated PDF binaries.
- Production readiness remains gated by live-like end-to-end verification of item selection, invoice posting, branch expenses, production reports, and maintenance flows against a restored database.
- The two lint warnings listed above remain in the repository and were not part of this hotfix scope.

## 11. Explicit production readiness result

NO

Reason:

- no isolated database rehearsal was required or run in this branch because no schema changes were introduced;
- no live-like end-to-end transaction rehearsal was executed against a restored backend in this turn;
- PDF generation remains incomplete for the printing requirement set.
