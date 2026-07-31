# PRODUCTION_SECURITY_IMPLEMENTATION_REPORT

Date: July 30, 2026
Scope: Production module security corrections, batch 1 of 4

## 1. Files changed

Application code changed:

- `src/lib/production-order-authorization.ts` (new)
- `src/lib/production-server.ts`
- `src/app/api/production/orders/route.ts`
- `src/app/api/production/orders/[id]/route.ts`
- `src/app/api/production/orders/[id]/release/route.ts`
- `src/app/api/production/orders/[id]/issue/route.ts`
- `src/app/api/production/orders/[id]/receipt/route.ts`
- `src/app/api/production/orders/[id]/close/route.ts`
- `tests/production-helpers.test.ts`

Documentation added:

- `PRODUCTION_SECURITY_IMPLEMENTATION_REPORT.md`

Worktree note:

- `PRODUCTION_MODULE_AUDIT.md` was already present in the worktree from the prior audit and was not modified as part of this batch.

## 2. Root cause

The production-order write routes were inconsistent with the read routes:

- create and update trusted client branch input too directly
- release, issue, receipt, and close executed service-role RPCs without first loading the target order inside the authenticated organization scope
- branch-scoped users were not being blocked at the route layer before RPC execution

The database RPCs already used organization IDs, but the route layer still needed to enforce:

- same-organization order lookup
- branch-scope authorization
- branch validation for create and update
- no-RPC-on-failure behavior

## 3. Authorization policy chosen

The implemented policy is:

- Organization scope:
  - order lookups are always filtered by `ctx.organizationId`
  - cross-organization orders resolve as `404 Production order not found.`

- Branch-scoped users:
  - create:
    - if the client sends another branch, the server forces `ctx.branchId`
    - if `ctx.branchId` is missing, the action is forbidden
  - update:
    - the existing order must belong to `ctx.branchId`
    - orders with `branch_id NULL` are forbidden
    - an explicit attempt to move the order to another branch is forbidden
  - release / issue / receipt / close:
    - the order must belong to `ctx.branchId`
    - orders with `branch_id NULL` are forbidden

- Head-office / unrestricted users:
  - create:
    - supplied `branchId` must belong to the authenticated organization and be available
    - no supplied branch preserves `NULL`
  - update:
    - no supplied branch preserves the current order branch
    - supplied `branchId` must belong to the authenticated organization and be available

Response conventions preserved:

- `403` with `{ error: "Forbidden" }` for branch-scope denial
- `404` with `{ error: "Production order not found." }` for cross-organization or missing orders
- `400` with `{ error: "Selected branch is not available." }` for invalid branch selection

## 4. Shared helper design

The authorization logic is split in two layers:

1. Pure policy helper:
   - `src/lib/production-order-authorization.ts`
   - contains:
     - `authorizeProductionOrderForWrite`
     - `resolveProductionCreateBranchAuthorization`
     - `resolveProductionUpdateBranchAuthorization`
   - this layer has no external side effects and is directly unit-tested

2. Data-loading service helper:
   - `src/lib/production-server.ts`
   - contains:
     - `loadProductionOrderAuthorizationRecord`
     - `loadProductionBranchAuthorizationRecord`
     - `authorizeProductionOrderWriteAccess`
     - `resolveAuthorizedProductionCreateBranchId`
     - `resolveAuthorizedProductionUpdateBranchId`
   - this layer performs service-role reads scoped to `icecream_erp`

Design intent:

- centralize organization and branch checks in one path
- keep route handlers small
- ensure failures happen before RPC execution
- keep create/update policy separate from action-on-existing-order policy

## 5. Route-by-route behaviour

### `POST /api/production/orders`

- now calls `resolveAuthorizedProductionCreateBranchId(...)` before the save RPC
- branch-scoped users are forced to `ctx.branchId`
- unrestricted users must supply an organization-valid branch if they send one

Key references:

- `src/app/api/production/orders/route.ts:74`
- `src/app/api/production/orders/route.ts:80`

### `PUT /api/production/orders/[id]`

- now calls `resolveAuthorizedProductionUpdateBranchId(...)` before validation reaches the save RPC
- loads the existing order inside the authenticated organization
- blocks branch-scoped updates outside the current branch
- preserves current branch when no valid branch change is supplied

Key references:

- `src/app/api/production/orders/[id]/route.ts:94`
- `src/app/api/production/orders/[id]/route.ts:109`

### `POST /api/production/orders/[id]/release`

- now loads and authorizes the target order before `releaseProductionOrder(...)`

Key reference:

- `src/app/api/production/orders/[id]/release/route.ts:18`

### `POST /api/production/orders/[id]/issue`

- now loads and authorizes the target order before `postProductionIssue(...)`

Key reference:

- `src/app/api/production/orders/[id]/issue/route.ts:17`

### `POST /api/production/orders/[id]/receipt`

- now loads and authorizes the target order before `postProductionReceipt(...)`

Key reference:

- `src/app/api/production/orders/[id]/receipt/route.ts:18`

### `POST /api/production/orders/[id]/close`

- now loads and authorizes the target order before `closeProductionOrder(...)`

Key reference:

- `src/app/api/production/orders/[id]/close/route.ts:17`

## 6. Tests added

Added to `tests/production-helpers.test.ts`:

- pure helper tests for:
  - branch-scoped create forcing own branch
  - head-office create on valid same-org branch
  - invalid branch rejection across organizations
  - branch-scoped update on own branch
  - branch-scoped update cross-branch rejection
  - cross-organization order rejection
  - branch-scoped rejection for `branch_id NULL`

- route guard tests for:
  - create uses forced branch before RPC
  - update failure blocks save RPC
  - release failure blocks release RPC
  - issue failure blocks issue RPC
  - receipt failure blocks receipt RPC
  - close failure blocks close RPC

The route tests transpile the route files in-process and mock only external dependencies. That keeps the actual route guard flow under test without needing a full Next runtime.

## 7. Commands run and results

1. `npm run test:production`
   - Result: PASS
   - 32 tests passed

2. `node --test --test-name-pattern "authorization|route" .tmp-tests/tests/production-helpers.test.js`
   - Result: PASS

3. `npm run lint`
   - Result: PASS with existing non-Production warnings
   - warnings:
     - `src/app/(dashboard)/maintenance/machines/page.tsx`
     - `src/app/(dashboard)/sales/customers/page.tsx`

4. `npm run typecheck`
   - Result: FAIL due unrelated existing repository errors
   - no Production-order errors remained after this batch
   - filtered follow-up:
     - `npm run typecheck 2>&1 | rg "src/app/api/production/orders|src/lib/production-order-authorization|src/lib/production-server|tests/production-helpers"`
     - Result: no matches

5. `git diff --check`
   - Result: PASS
   - note: Git printed LF/CRLF warnings for the current worktree

6. `git status --short`
   - Result at end of batch:
     - modified:
       - `package.json` (worktree still reports it modified; `git diff -- package.json` showed no content diff after the test-script revert)
       - `src/app/api/production/orders/route.ts`
       - `src/app/api/production/orders/[id]/route.ts`
       - `src/app/api/production/orders/[id]/release/route.ts`
       - `src/app/api/production/orders/[id]/issue/route.ts`
       - `src/app/api/production/orders/[id]/receipt/route.ts`
       - `src/app/api/production/orders/[id]/close/route.ts`
       - `src/lib/production-server.ts`
       - `tests/production-helpers.test.ts`
     - untracked:
       - `src/lib/production-order-authorization.ts`
       - `PRODUCTION_MODULE_AUDIT.md`
       - `PRODUCTION_SECURITY_IMPLEMENTATION_REPORT.md`

## 8. Remaining Production defects

Not part of this batch and still open:

- dashboard and navigation still point users into the legacy `production_batches` flow
- reversal RPCs are still not exposed through production API routes or UI
- reopen workflow is still not exposed through production API routes or UI
- relationship-map view still does not use `production_document_links`
- planned-order entry is still a drawer, not a dedicated page
- planned-order edit UI is still missing
- receipt UI still does not expose `receiptDate`

## 9. Assumptions

- `branches.organization_id` is the correct ownership field for validating permitted branch selection
- `branches.status = 'ACTIVE'` is the correct availability rule, matching existing project conventions such as `settings/users`
- preserving the current branch on unrestricted update when no valid branch change is supplied is safer than allowing a silent branch clear through this route
- returning `404` for cross-organization order access is consistent with current production read-route behavior

## 10. Confirmation

- No migration was created
- No migration was run
- No VPS deployment occurred
- No direct browser database writes were introduced
- No unrelated module behavior was intentionally changed
