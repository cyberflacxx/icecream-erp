# ERP Phase 1C Sales Invoice Implementation Report

## Root causes addressed

1. Sales routes trusted browser prices and quantities too early.
2. Branch and warehouse authorization was inconsistent across orders, invoices, and payments.
3. Direct invoices could bypass branch scope because list/detail/payment logic relied too heavily on linked sales orders.
4. The item selector only surfaced `items.selling_price`, not the effective sales price for the customer and branch context.
5. There was no saved-data invoice preview/print path.
6. The invoice route mixed transaction-RPC posting with a compatibility fallback that could leave the workflow partially completed.

## Files changed

- `src/lib/sales-workflow.ts`
- `src/lib/sales-pricing.ts`
- `src/hooks/useItemSelectorOptions.ts`
- `src/hooks/sales/useSalesOrders.ts`
- `src/components/sales/sales-line-items-editor.tsx`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/api/sales/invoices/route.ts`
- `src/app/api/sales/invoices/[id]/route.ts`
- `src/app/api/sales/invoices/[id]/payment/route.ts`
- `src/app/api/sales/payments/route.ts`
- `src/app/api/sales/meta/route.ts`
- `src/app/(dashboard)/sales/orders/page.tsx`
- `src/app/(dashboard)/sales/invoices/page.tsx`
- `src/app/(dashboard)/sales/quotations/page.tsx`
- `src/app/(dashboard)/sales/invoices/[id]/page.tsx`
- `tests/sales-helpers.test.ts`
- `tests/branch-helpers.test.ts`
- `ERP_PHASE_1C_SALES_INVOICE_AUDIT.md`

## Branch authorization

- Sales order creation now resolves branch authorization through `src/lib/branch-access.ts` even when the browser omits `branchId`.
- Warehouse selection is now validated with `isWarehouseAvailableToContext` for order and invoice creation.
- Invoice payment now enforces scope from the invoice’s own `branch_id`, not only from a linked sales order.
- Generic sales payments now scope invoice-based reads and writes by organization and branch.
- Sales UI order and invoice drawers now use `useAuthorizedBranches` and auto-select the only branch/default warehouse where applicable.

## Item and price behavior

- Added `src/lib/sales-pricing.ts` to resolve effective prices server-side.
- Selector pricing now supports branch/customer context through `customer_id`, `branch_id`, and `warehouse_id`.
- Sales selector price priority in this batch:
  1. customer `price_list_code`
  2. customer-group code
  3. branch code
  4. `STANDARD`
  5. item master `selling_price` fallback
- Order and invoice routes now ignore browser-submitted selling prices and use server-resolved prices.
- Sales line editor price field is now read-only so the visible UI matches the server contract.
- Missing or zero selling price now blocks sales creation with a clear error.
- Missing inventory cost now blocks posted invoice creation when stock posting is requested.

## Sales workflow

- Added `src/lib/sales-workflow.ts` for normalized invoice/order status behavior.
- Invoice list and sales meta now derive display status from stored status plus `approved_*` and `posted_*` fields.
- Orders page now only offers invoice creation for `CONFIRMED`, `APPROVED`, or `DISPATCHED` orders.
- Invoice creation now defaults to posted-transaction intent (`postInventory !== false`) for the repaired UI flow.
- If the transaction engine is unavailable during a posted invoice request, the route now returns a clear server error instead of silently falling into a partial sales flow.
- Compatibility fallback remains only for non-posted draft invoice creation.

## Inventory behavior

- Sales item selector now includes resolved branch/warehouse stock in the same request that resolves price.
- Posted invoice creation pre-validates missing cost before calling the transaction engine.
- The repaired workflow expects stock reduction through the sales transaction engine rather than a browser-driven fallback.
- Dispatch logic was not redesigned in this batch; the practical effect is that newly posted invoices will no longer be the primary source of stock issue through the UI dispatch flow.

## Customer balance behavior

- Posted invoices now prefer the transaction engine path for atomic customer balance updates.
- Draft compatibility invoice fallback no longer attempts to behave like a fully posted sale.
- Invoice payment scope now follows the invoice branch correctly.

## Accounting behavior

- This batch leans into migration `040_sales_finance_transaction_engine.sql` instead of expanding hard-coded accounting logic.
- Posted invoice requests now require the sales transaction engine path.
- Existing fallback finance posting remains in payment compatibility routes, but branch scope and organization scope were tightened.
- No account UUIDs or new mappings were hard-coded in this batch.

## Invoice printing

- Added `src/app/(dashboard)/sales/invoices/[id]/page.tsx`.
- Added invoice preview/print action from the invoices list.
- Print view reads saved invoice data from `/api/sales/invoices/[id]`.
- The invoice detail API now includes:
  - derived display status
  - company profile
  - branch details
- Print page supports:
  - preview
  - print
  - saved totals
  - customer and branch details
  - stored line items

## Tests added or updated

- `tests/sales-helpers.test.ts`
  - sales workflow status normalization
  - printable invoice and invoiceable order checks
  - static assertions for:
    - invoice preview page
    - branch-aware sales pages
    - selector pricing route usage
    - read-only sales price editor
- `tests/branch-helpers.test.ts`
  - static assertions for:
    - shared warehouse authorization in sales order route
    - invoice payment route using invoice branch and organization scope

## Validation results

- `npm run test:sales`: PASS
- `npm run test:inventory`: PASS
- `npm run test:finance`: PASS
- `npm run test:branches`: PASS
- `npm run lint`: PASS with existing repo warnings outside this batch plus no new sales-batch lint failures
- `git diff --check`: PASS with CRLF conversion warnings only

Additional validation context:

- `npm run typecheck`: FAIL, but failures are dominated by pre-existing repository issues outside this batch, especially in:
  - `src/app/api/finance/dashboard/route.ts`
  - procurement API routes
  - unrelated existing Supabase typing surfaces
- `npm run build`: did not complete within the extended 10-minute timeout window, so this batch cannot honestly claim a build pass

## Migration proposed

- No migration proposed in this batch.
- The repair reused existing sales transaction engine structures and branch/item helper infrastructure.

## Rollback considerations

- UI rollback is straightforward for:
  - invoice preview page
  - branch selectors in sales order/invoice drawers
  - read-only sales price field
- API rollback should be treated carefully in:
  - `src/app/api/sales/invoices/route.ts`
  - `src/app/api/inventory/items/route.ts`
  - `src/app/api/sales/orders/route.ts`
- If rollback is required, revert the sales pricing and invoice posting changes together; splitting them would recreate browser/server price mismatches.

## Known risks

1. Full repo `typecheck` is still blocked by unrelated existing type errors outside this batch.
2. `next build` did not finish within the available timeout window, so production readiness is still conditional.
3. Dispatch workflow remains a compatibility surface and was not fully re-architected in this batch.
4. The current repo schema still does not expose a richer customer-specific pricing table beyond existing price-list design.
5. Generic payment fallback logic still exists for compatibility mode; the strongest path is the migration-040 transaction engine.

## Next recommended batch

1. Standardize dispatch behavior against posted invoices and eliminate duplicate stock-issue paths.
2. Add explicit sales posting/posted-state UI actions for legacy invoices that predate this repair.
3. Tighten generic sales payments list filtering and customer ledger linking further.
4. Add integration-style tests around:
   - direct posted invoice
   - order-to-invoice posting
   - branch-scoped payment rejection
   - invoice preview authorization
