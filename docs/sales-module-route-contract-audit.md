# Sales Module Route Contract Audit

Updated during the live Sales route stabilization pass after the `icecream_erp` schema rebuild.

## Route Summary

| Page path | API endpoints used | Database tables queried | Expected response shape | Current/previous failure cause | Fix applied |
| --- | --- | --- | --- | --- | --- |
| `/sales/dashboard` | `/api/sales/dashboard` | `invoices`, `sales_dispatch_notes`, `customers`, `items`, `stock_balances`, `warehouses`, `sales_orders` | `{ stats: { todaySales, overdueInvoices, creditAlerts, pendingDispatches, stockAvailableForSale } }` | Dashboard route already had legacy column fallbacks; no primary failure reproduced in code audit. | Left core logic intact. |
| `/sales/customers` | `/api/sales/customers` | `customers` and related customer tables | paginated customer rows | Working before this pass. | No change in this task. |
| `/sales/prices` | `/api/sales/prices`, `/api/sales/meta` | `sales_product_prices`, `items` | array of price rows with attached item label data | GET route depended on `items(...)` relationship expansion and could fail after schema rebuild if PostgREST relation metadata drifted. | Replaced relation select with base `sales_product_prices` query plus separate item lookup and safe created_at fallback. |
| `/sales/discounts` | `/api/sales/discounts` | `sales_discount_rules`, `sales_customer_groups`, `items` | array of discount rows | Route assumed current-column set only and returned 500 on optional-column drift. | Added safe column fallbacks, separate group/item lookups, normalized response defaults, and empty-state UI. |
| `/sales/quotations` | `/api/sales/quotations`, `/api/sales/meta` | `quotations`, `quotation_items`, `customers`, `items` | paginated quotation rows | Existing GET route already used separate customer/item-count lookups; likely failures were downstream from shared metadata or other tabs. | No primary GET contract rewrite needed in this pass. |
| `/sales/orders` | `/api/sales/orders`, `/api/sales/meta` | `sales_orders`, `sales_order_items`, `customers`, `items`, `warehouses` | paginated order rows | Existing GET route already used base-table queries plus separate lookups and legacy column fallbacks. | No primary GET contract rewrite needed in this pass. |
| `/sales/invoices` | `/api/sales/invoices`, `/api/sales/meta`, `/api/sales/invoices/[id]/approve`, `/api/sales/invoices/[id]/payment` | `invoices`, `invoice_items`, `customers`, `sales_orders` | paginated invoice rows | GET route depended on relation expansion (`customers`, `invoice_items`) and branch filtering via implicit relationship path, which is brittle after rebuild. | Replaced relation-based list loading with base invoice query plus separate customer/item-count lookups and safe legacy column fallbacks. |
| `/sales/dispatches` | `/api/sales/dispatches`, `/api/sales/meta`, `/api/sales/dispatches/[id]/post` | `sales_dispatch_notes`, `sales_dispatch_note_items`, `invoices`, `warehouses` | array of dispatch note rows | GET route assumed `vehicle_reference` and current column set only. | Added column fallbacks, safe missing-table handling, and sanitized error logging. |
| `/sales/payments` | `/api/sales/payments`, `/api/sales/meta`, `/api/sales/invoices/[id]/payment` | `payments`, `invoices`, `customers` | array of payment rows | GET route assumed full modern column set and returned 500 on column drift. | Added optional-column fallbacks, normalized defaults, and sanitized error logging. |
| `/sales/returns` | `/api/sales/returns` | `customer_returns` | array of return rows | GET route assumed `deleted_at`, `qc_status`, and `final_stock_action` columns existed together. | Added deleted/legacy fallbacks, normalized defaults, and empty-state UI. |

## Shared Contract Notes

- All Sales API access remains explicitly scoped to `icecream_erp`.
- Item selectors continue to use the saved `items` table and do **not** filter out items when stock is zero.
- The line-item editor now shows a stock warning for zero-availability items instead of hiding them.
- Sales navigation overflow was adjusted to use an explicit horizontal scroll container so right-edge tabs stay reachable on narrower layouts.

## Migration Status

- No migration was required in this pass.
- No `public`, `auth`, shared PostgREST, or VPS-global changes were introduced.
