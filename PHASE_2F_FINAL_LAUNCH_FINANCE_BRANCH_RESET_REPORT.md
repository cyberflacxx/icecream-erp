# Phase 2F Final Launch Finance Branch Reset Report

Date: Tuesday, August 4, 2026

## Scope Delivered

- Reduced desktop and mobile sidebar width in the shared dashboard shell.
- Forced selector cache refresh after creating inventory items so new items appear in downstream selectors.
- Forced branch selector and module cache refresh after creating branches.
- Reworked sales receipt save-and-print flow to open the saved receipt page instead of downloading an HTML blob.
- Added explicit bank or cash account selection to invoice receipts and sales payments.
- Routed sales and supplier payment-linked finance transactions to the selected cash or bank account instead of the first available account.
- Extended sales metadata so sales users can load bank and cash selector options without depending on `finance.read`.
- Added branch bootstrap on create:
  - default active branch warehouse
  - branch cost centre synchronization
  - branch cash account attempt with non-fatal warning capture
- Added guarded operational reset script:
  - `npm run reset:operational-data`
  - requires `--organization-id=<id>`
  - requires exact confirmation phrase
  - supports `--dry-run`

## Verification

Passed on Tuesday, August 4, 2026:

- `npm run test:inventory`
- `npm run test:sales`
- `npm run test:branches`
- `npm run test:procurement`
- `npm run test:finance`
- `npm run test:production`
- `npm run lint`
- `npm run build`
- `git diff --check`

`npm run lint` completed with warnings only:

- `src/app/(dashboard)/maintenance/machines/page.tsx`
- `src/app/(dashboard)/sales/customers/page.tsx`

## Build and Type State

- `npm run build` succeeded on Tuesday, August 4, 2026.
- Repo-wide `npm run typecheck` is still failing because of existing unrelated TypeScript issues outside this hotfix scope across finance dashboard, selector callback typings, procurement routes, production routes, user routes, and several legacy compatibility files.
- The hotfix-specific type mismatch introduced during this work was corrected by aligning the sales invoice list shape with `branchId`.

## Residual Risks

- Customer, supplier, stock, and cash opening-balance workflows still need a broader accounting-ledger hardening pass beyond the receipt, branch bootstrap, and reset controls delivered here.
- The branch cash-account bootstrap is intentionally non-fatal so branch creation does not fail if finance account mappings or finance tables are incomplete in a live environment.
