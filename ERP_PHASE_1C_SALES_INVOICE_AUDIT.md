# ERP Phase 1C Sales Invoice Audit

## Scope

Audit date: 2026-08-01
Branch baseline: `fix/sales-invoice-production` from `master` at `7da2a62bbd42cf4a04dd9177a82eb180db266991`

## Exact files inspected

- `package.json`
- `migrations/005_sales_dispatch_extensions.sql`
- `migrations/029_sales_schema_recovery.sql`
- `migrations/040_sales_finance_transaction_engine.sql`
- `src/lib/api-auth.ts`
- `src/lib/branch-access.ts`
- `src/lib/item-selector.ts`
- `src/lib/sales.ts`
- `src/lib/sales-server.ts`
- `src/lib/sales-transactions-server.ts`
- `src/lib/sales-customers.ts`
- `src/lib/sales-payments.ts`
- `src/lib/finance-server.ts`
- `src/hooks/useAuthorizedBranches.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/hooks/sales/useCreateSalesOrder.ts`
- `src/hooks/sales/useRecordPayment.ts`
- `src/hooks/sales/useSalesMeta.ts`
- `src/hooks/sales/useSalesPrices.ts`
- `src/components/shared/item-selector-field.tsx`
- `src/components/sales/sales-line-items-editor.tsx`
- `src/app/api/branches/route.ts`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/inventory/sales-dispatch/route.ts`
- `src/app/api/finance/accounts-receivable/route.ts`
- `src/app/api/sales/meta/route.ts`
- `src/app/api/sales/prices/route.ts`
- `src/app/api/sales/quotations/route.ts`
- `src/app/api/sales/quotations/[id]/approve/route.ts`
- `src/app/api/sales/quotations/[id]/convert-to-order/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/api/sales/orders/[id]/route.ts`
- `src/app/api/sales/orders/[id]/confirm/route.ts`
- `src/app/api/sales/orders/[id]/approve/route.ts`
- `src/app/api/sales/invoices/route.ts`
- `src/app/api/sales/invoices/[id]/route.ts`
- `src/app/api/sales/invoices/[id]/approve/route.ts`
- `src/app/api/sales/invoices/[id]/payment/route.ts`
- `src/app/api/sales/payments/route.ts`
- `src/app/api/sales/dispatches/route.ts`
- `src/app/api/sales/dispatches/[id]/post/route.ts`
- `src/app/api/sales/customers/[id]/ledger/route.ts`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/sales/payments/page.tsx`
- `src/app/(dashboard)/sales/dispatches/page.tsx`
- `src/app/(dashboard)/sales/payments/receipt/page.tsx`
- `tests/sales-helpers.test.ts`
- `tests/branch-helpers.test.ts`
- `tests/finance-helpers.test.ts`

## Current status flows

### Quotations

Observed implementation:

- create: `DRAFT`
- approve route writes: `accepted`
- convert route allows any non-cancelled/non-rejected/non-expired quotation
- convert route sets quotation to `ACCEPTED`

Issues:

- status casing is inconsistent: `accepted` vs `ACCEPTED`
- approval flow does not align with expected `DRAFT -> SUBMITTED -> APPROVED -> CONVERTED_TO_ORDER`
- conversion is not restricted to approved quotations

### Sales orders

Observed implementation:

- create: `DRAFT`
- confirm: `CONFIRMED`
- approve route is only a re-export to confirm route
- invoice creation marks order `INVOICED`

Issues:

- there is no distinct approval step
- `approve` and `confirm` are the same behavior
- no guarded path to `DISPATCHED`, `CLOSED`, or partial completion

### Invoices

Observed implementation:

- create via route fallback: `SENT`
- approve route writes: `APPROVED`, but treats legacy `SENT` as acceptable
- payment route uses `SENT`, `PARTIAL_PAID`, `PAID`
- dispatch route can move invoice to `FULLY_DISPATCHED`

Issues:

- invoice status contract is inconsistent with the expected `DRAFT -> APPROVED -> POSTED -> PARTIALLY_PAID -> PAID`
- manual fallback path bypasses posted-state discipline
- `PARTIAL_PAID` is used instead of `PARTIALLY_PAID`

### Dispatches

Observed implementation:

- create: `PENDING`
- post: `POSTED`

Issues:

- dispatch is the real stock issue step, but invoice posting and dispatch posting are split inconsistently
- there is no complete atomic sale lifecycle tying invoice, stock, customer ledger, finance journal, and dispatch together

## Root cause preventing sales

1. The sales flow is split across incompatible models:
   - invoice RPC path in migration `040_sales_finance_transaction_engine.sql`
   - manual fallback writes in `src/app/api/sales/invoices/route.ts`
   - separate dispatch stock issue flow in `src/app/api/sales/dispatches/[id]/post/route.ts`

2. The fallback invoice path trusts browser-supplied line prices and taxes:
   - no server-side price resolution
   - no enforced tax-code lookup
   - no enforced cost lookup

3. Branch authorization is partial and inconsistent:
   - orders use `resolveRequestedBranchId`
   - invoices infer branch from linked order only
   - quotation routes do not use shared branch authorization
   - dispatch routes do not use centralized branch/warehouse helper

4. The UI exposes actions that do not map cleanly to the deployed transaction design:
   - orders page allows direct invoice creation from non-approved orders
   - invoices page exposes `Approve/Reserve`, not `Post Invoice`
   - there is no invoice preview/print workflow

5. The dispatch posting path updates stock directly with `unit_cost = 0` and `total_cost = 0`, breaking costing and stock valuation.

## Branch authorization gaps

- `src/app/api/sales/quotations/route.ts`: no branch handling at all.
- `src/app/api/sales/quotations/[id]/approve/route.ts`: no branch or organization scope validation beyond authenticated service-role write.
- `src/app/api/sales/quotations/[id]/convert-to-order/route.ts`: chooses the first available warehouse rather than an explicitly authorized branch/warehouse selection.
- `src/app/api/sales/invoices/route.ts`: direct invoices accept browser `warehouseId` and optional `branchId` without centralized branch helper validation.
- `src/app/api/sales/invoices/[id]/route.ts`: branch check only works when `sales_order_id` exists.
- `src/app/api/sales/invoices/[id]/payment/route.ts`: branch check only works when the invoice is linked to a sales order.
- `src/app/api/sales/dispatches/route.ts`: no shared branch helper use; warehouse scope is not validated with `isWarehouseAvailableToContext`.
- `src/app/api/sales/dispatches/[id]/post/route.ts`: no centralized warehouse authorization before stock issue.

## Price-loading gaps

1. Item selector returns `items.selling_price` from `src/app/api/inventory/items/route.ts`.
2. Sales meta builds `defaultPrice` from the first active `sales_product_prices` row by item, not by price priority.
3. No route applies the required priority:
   - customer-specific active price
   - customer-group active price
   - branch price
   - standard selling price
4. `src/components/sales/sales-line-items-editor.tsx` copies selector `sellingPrice` into the form and then allows unrestricted manual editing.
5. `src/app/api/sales/orders/route.ts` and `src/app/api/sales/invoices/route.ts` trust `unitPrice` from the request body.

## Stock-posting gaps

- `src/app/api/sales/invoices/[id]/approve/route.ts` only reserves stock; it does not post stock issue.
- `src/app/api/sales/dispatches/[id]/post/route.ts` posts stock outside a database transaction.
- dispatch posting writes `stock_movements.total_cost = 0` and `unit_cost = 0`.
- duplicate posting prevention is route-local only; there is no transaction-safe inventory posting lock around stock balance updates.
- `src/app/api/inventory/sales-dispatch/route.ts` is a second sales-dispatch implementation using different movement type (`SALES_DISPATCH`) and different inventory helpers, which creates competing workflows.

## Customer-balance gaps

- manual fallback in `src/app/api/sales/invoices/route.ts` updates customer balance immediately on invoice creation, even before a posted/approved transaction lifecycle is completed.
- payment routes update customer balances directly and separately from finance posting.
- no unified customer-ledger write path is guaranteed across invoice creation, payment posting, and reversals.
- payment routes use two implementations:
  - `src/app/api/sales/invoices/[id]/payment/route.ts`
  - `src/app/api/sales/payments/route.ts`

## Accounting gaps

- deployed migration `040_sales_finance_transaction_engine.sql` already provides:
  - `post_sales_invoice_transaction`
  - `post_sales_payment_transaction`
  - open-period validation
  - idempotency handling
  - posting account mappings
- fallback invoice and payment routes bypass that design and hard-code accounting behavior.
- payment fallback hard-codes account codes:
  - `1000`
  - `1010`
  - `1100`
- dispatch stock issue does not create cost-of-sales accounting.
- fallback invoice path does not prove balanced journal creation before customer/inventory side effects.

## Invoice printing gaps

- there is a payment receipt print page.
- there is no invoice preview/print page for sales invoices.
- the invoices dashboard page has no `Preview Invoice`, `Print Invoice`, `Reprint Invoice`, or PDF action.
- no print-specific invoice CSS exists.
- no route guarantees that a printed invoice is built from saved posted data.

## Current end-to-end workflow

Observed current path:

1. Create quotation from UI with selector price copied from `items.selling_price`.
2. Approve quotation to `accepted`.
3. Convert quotation to order using first available warehouse.
4. Confirm order; approve route is the same as confirm.
5. Create invoice from order or directly.
6. Invoice create tries RPC first, then falls back to manual insert and immediate customer-balance update.
7. Invoice approval reserves stock only.
8. Dispatch is created separately.
9. Dispatch posting reduces stock and writes zero-cost stock movements.
10. Payments are recorded separately and may post finance via RPC or fallback.

This is not a single coherent sales transaction workflow.

## Database assumptions

- sales finance transaction engine exists in migration `040`.
- `sales_posting_account_mappings` is expected to be the canonical mapping source.
- some environments still rely on compatibility columns:
  - `total` vs `total_amount`
  - `amount_paid` vs `paid_amount`
  - `sales_order_id` vs `order_id`
- dispatch and legacy delivery-note schemas coexist.

## Migration requirement

Immediate repair target: **no new migration required for the first implementation batch** if the repair reuses:

- existing branch access helpers
- existing item selector
- existing migration 040 RPCs
- existing sales, inventory, and finance tables

A later migration may be needed only if the repo lacks a durable invoice-print relationship or explicit sales price-priority tables for customer-specific and branch pricing. That is not required to repair the currently broken workflow surface.

## Smallest implementation plan

### Batch 1

- centralize sales branch and warehouse authorization using `src/lib/branch-access.ts`
- repair sales metadata so branch-scoped users only see authorized branches, warehouses, orders, invoices, and printable documents
- block unauthorized direct invoice, payment, dispatch, and URL access

### Batch 2

- centralize server-side price, cost, tax, and total resolution
- remove trust in browser `unitPrice`
- enforce missing-price and missing-cost errors

### Batch 3

- standardize order and invoice statuses around the migration-040 transaction model
- align UI buttons with real workflow: save draft, approve, post, payment, preview/print

### Batch 4

- route invoice posting through the sales transaction engine consistently
- keep fallback behavior only where compatibility is unavoidable
- prevent duplicate posting and partial side effects

### Batch 5

- repair dispatch costing and movement linkage
- ensure stock movement and customer/finance references are traceable from the invoice

### Batch 6

- add invoice preview/print page from stored data
- add targeted tests for branch restrictions, price resolution, stock posting, customer ledger updates, and print access

## Summary of confirmed root causes

- browser prices are trusted instead of being resolved server-side
- branch/warehouse scope is not consistently enforced across the sales workflow
- order approval and invoice posting contracts are inconsistent
- dispatch posting writes zero-cost stock movements
- payment fallback uses hard-coded GL account codes
- invoice printing is missing
- multiple overlapping dispatch/payment implementations create inconsistent behavior
