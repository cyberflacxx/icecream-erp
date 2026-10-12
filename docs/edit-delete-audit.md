# Edit/Delete Audit

Scope: Procurement, Inventory, Production, Sales, Finance, HR, Quality, Maintenance, Branch Operations, Master Data, Reporting.

Method: static UI/API scan for visible `Edit`, `Delete`, `Archive`, `Deactivate`, `Void`, `Cancel`, `Approve`, and `Reject` actions in `src/app/(dashboard)` and corresponding mutation routes under `src/app/api`.

| Module | Page | Entity | UI Action | API Endpoint | Classification | RBAC Present | Audit Log Present | Safe Business Rule | Current Status | Action Required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Procurement | `/procurement/requisitions` | Purchase requisition | Edit Draft | `/api/procurement/requisitions/[id]` | DRAFT_TRANSACTION | Yes | Partial | Draft-only edit expected | Usable | Add explicit audit verification test |
| Procurement | `/procurement/requisitions` | Purchase requisition | Delete | `/api/procurement/requisitions/[id]` | DRAFT_TRANSACTION | Yes | Partial | UI says draft-only delete | Usable | Confirm API blocks non-draft delete in live E2E |
| Procurement | `/procurement/purchase-orders` | Purchase order | Edit Order / Edit Draft | `/api/procurement/purchase-orders/[id]` | DRAFT_TRANSACTION | Yes | Partial | Draft edit only from detail page | Usable | Confirm approved/posted PO cannot be destructively edited |
| Procurement | `/procurement/purchase-orders` | Purchase order | Approve / Reject | `/api/procurement/purchase-orders/[id]/approve`, `/reject` | DRAFT_TRANSACTION | Yes | Partial | Approval state transition | Usable | Add regression around duplicate approvals |
| Procurement | `/procurement/goods-received` | GRN | Approve / Reject / Post | `/api/procurement/grns/[id]/*` | COMPLETED_INVENTORY_TRANSACTION | Yes | Partial | Posted GRN should not be deleted | Usable | Verify no hard-delete action is exposed |
| Procurement | `/procurement/suppliers` | Supplier | Edit / Deactivate | `/api/suppliers/[id]` | MASTER_DATA | Yes | Partial | Deactivate preferred over delete | Usable | Confirm supplier with history cannot be hard-deleted |
| Procurement | `/procurement/payments` | Supplier payment | Reprint Receipt | `/procurement/payments/receipt` | POSTED_FINANCIAL_TRANSACTION | Yes | N/A read-only | Reprint only | Usable | None |
| Inventory | `/inventory/items` | Inventory item | Edit / Activate / Deactivate | `/api/inventory/items/[id]` | MASTER_DATA | Yes | Partial | Deactivate instead of deleting used item | Usable | Confirm API rejects destructive delete for used items |
| Inventory | `/inventory/transfers` | Stock transfer | Approve / Cancel / Receive | `/api/inventory/transfers/[id]/*` | COMPLETED_INVENTORY_TRANSACTION | Yes | Yes on key posting paths | Reverse/cancel instead of delete | Usable | Validate cancel blocked after receipt/posting |
| Inventory | `/inventory/approvals` | Inventory approval | Approve / Reject | `/api/inventory/approvals/*` | COMPLETED_INVENTORY_TRANSACTION | Yes | Yes | Atomic approval RPC path | Usable | None |
| Inventory | `/inventory/warehouses` | Warehouse | Create/Edit form | `/api/inventory/warehouses` | MASTER_DATA | Yes | Partial | No delete found | Usable | Add deactivate if business needs require it |
| Production | `/production/orders` | Production order | Edit | `/production/orders/[id]/edit`, `/api/production/orders/[id]` | DRAFT_TRANSACTION | Yes | Partial | Planned/unstarted order edit | Usable | Confirm active/completed order protection |
| Production | `/production/batches` | Production batch | Edit actual usage/cost | `/api/production/batches/[id]/material-usage` | HISTORICAL_PRODUCTION_TRANSACTION | Yes | Partial | Completed batches use cost overrides | Usable | Confirm completed history is not rewritten destructively |
| Production | `/production/recipes` | BOM/recipe | Edit / Archive/Delete via API | `/api/production/recipes/[id]` | MASTER_DATA | Yes | Yes for version create | Active/historical protection added | Usable | Live E2E proof required |
| Production | `/production/transfers` | Raw material transfer | Cancel drawer actions | `/api/production/raw-material-transfers` | COMPLETED_INVENTORY_TRANSACTION | Yes | Partial | Transfer/return/damage workflows | Usable | Confirm posted transfer reversal path |
| Sales | `/sales/customers` | Customer | Edit / Deactivate | `/api/sales/customers/[id]`, `/deactivate` | MASTER_DATA | Yes | Partial | Deactivate instead of hard delete | Usable | Confirm customer with ledger remains auditable |
| Sales | `/sales/orders` | Sales order | Cancel | `/api/sales/orders/[id]/cancel` | DRAFT_TRANSACTION | Yes | Partial | Cancel instead of delete | Usable | Confirm invoiced order cancel protection |
| Sales | `/sales/invoices` | Invoice | Approve/Reserve / Cancel | `/api/sales/invoices/[id]/*` | POSTED_FINANCIAL_TRANSACTION | Yes | Yes | Atomic cancellation RPC reverses stock and journals; paid invoices and duplicate reversals are blocked | Implemented | Run controlled live E2E after preflight and migration approval |
| Sales | `/sales/dispatches` | Dispatch | Cancel/Post | `/api/sales/dispatches/[id]/*` | COMPLETED_INVENTORY_TRANSACTION | Yes | Yes | Dispatch cancellation delegates to invoice cancellation RPC and reverses linked stock and journals atomically | Implemented | Run controlled live E2E after preflight and migration approval |
| Sales | `/sales/payments` | Customer payment | Reprint Receipt | `/sales/payments/receipt` | POSTED_FINANCIAL_TRANSACTION | Yes | N/A read-only | Reprint only | Usable | None |
| Sales | `/sales/quotations` | Quotation | Approve / Cancel | `/api/sales/quotations/[id]/*` | DRAFT_TRANSACTION | Yes | Partial | Quotation state transitions | Usable | Confirm converted quotation lock |
| Finance | `/finance/cash-accounts` | Cash account | Edit / Activate / Deactivate | `/api/finance/cash-accounts` | MASTER_DATA | Yes | Partial | Deactivate instead of delete | Usable | Confirm linked GL/account history preserved |
| Finance | `/finance/bank-accounts` | Bank account | Edit / Activate / Deactivate | `/api/finance/bank-accounts` | MASTER_DATA | Yes | Partial | Deactivate instead of delete | Usable | Confirm linked GL/account history preserved |
| Finance | `/finance/chart-of-accounts` | GL account | Edit / Activate / Deactivate | `/api/finance/chart-of-accounts/[id]` | MASTER_DATA | Yes | Partial | Posting accounts with history should deactivate only | Usable | Confirm posted journal account cannot be hard-deleted |
| Finance | `/finance/fixed-assets` | Fixed asset | Edit | `/api/finance/fixed-assets/[id]` | MASTER_DATA | Yes | Partial | Asset edit; disposal/depreciation separate | Usable | Confirm posted depreciation history immutable |
| Finance | `/finance/fiscal-periods` | Fiscal period | Edit | `/api/finance/fiscal-periods/[id]` | MASTER_DATA | Yes | Partial | Period state rules expected | Usable | Confirm closed period cannot be reopened without permission |
| Finance | `/finance/journals` | Journal | Draft form cancel only | `/api/finance/journals/[id]/*` | POSTED_FINANCIAL_TRANSACTION | Yes | Partial | Post/reverse routes exist | Usable | Confirm posted journal reversal only |
| HR | `/hr/transfers` | Employee transfer | Approve | `/api/hr/employee-transfers/[id]/approve` | MASTER_DATA | Yes | Partial | Approval state transition | Usable | Confirm no hard delete on employee history |
| HR | API | Production worker assignment | Edit/Delete | `/api/hr/production-worker-assignments/[id]` | HISTORICAL_PRODUCTION_TRANSACTION | Yes | Yes | Unused assignments can be removed; labour/activity history blocks hard delete | Protected | Live E2E proof required |
| Maintenance | `/maintenance/machines` | Machine | Edit / Activate / Deactivate | `/api/maintenance/machines/[id]` | MASTER_DATA | Yes | Partial | Deactivate/retire with history | Usable | Confirm machine with maintenance history is not hard-deleted |
| Maintenance | `/maintenance/breakdowns` | Breakdown | Edit/Resolve via API | `/api/maintenance/breakdowns/[id]`, `/resolve` | MASTER_DATA | Yes | Partial | Resolution state transition | Usable | Add audit assertion for resolve |
| Quality | API/pages | Quality templates/waste/disposal | Patch/Approve | `/api/quality/*` | MASTER_DATA / COMPLETED_INVENTORY_TRANSACTION | Yes | Partial | Approval state transition | Usable | Confirm disposal does not delete stock movement history |
| Branch Operations | `/branches/[id]/sales` | Branch sale | Cancel | `/api/branches/[id]/sales/[saleId]/cancel` | POSTED_FINANCIAL_TRANSACTION | Yes | Partial | Cancel/reverse instead of delete | Usable | Confirm posted branch sale reversal path remains balanced |
| Branch Operations | `/branches/[id]/shift-close` | Shift close | Approve/Reject/Submit | `/api/branches/[id]/shift-closes/[id]/*` | POSTED_FINANCIAL_TRANSACTION | Yes | Yes on submit/reject | Approval state transition | Usable | None |
| Branch Operations | `/branches/[id]/expenses` | Branch expense | Form cancel / Void API | `/api/branches/[id]/expenses`, `/api/branches/[id]/expenses/[expenseId]/void` | POSTED_FINANCIAL_TRANSACTION | Yes | Yes | Posted expense void posts mirror journal and prevents duplicate reversal | Protected | Live E2E proof required |
| Master Data | `/settings/users` | User | Activate/Deactivate/Delete | `/api/users/[id]`, `/api/settings/users/[id]` | MASTER_DATA | Yes | Yes | Delete action deactivates/disables account, blocks self-disable and last Super Admin | Protected | Confirm Auth ban behavior in live E2E |
| Master Data | `/settings/roles` | Role | Edit | `/api/settings/roles` or users/roles routes | MASTER_DATA | Yes | Partial | Role edits permission controlled | Usable | Confirm role in use cannot be deleted |
| Reporting | `/reports` | Saved filter | Delete | `/api/reports/saved-filters/[id]` | MASTER_DATA | Yes | No material audit required | User-owned filter delete | Usable | None |

## High-Risk Fix Details

| Action | Before | After | API | RBAC | Audit | Business Rule | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User delete | One legacy route hard-deleted `users` and Supabase Auth. | Delete action now deactivates/disables, preserves history, bans Auth login best-effort. | `/api/users/[id]`, `/api/settings/users/[id]` | Super Admin / users.delete | `USER_DISABLED` | Cannot delete self; cannot disable last active Super Admin; history remains linked. | Protected |
| HR worker assignment delete | Assignment could be hard-deleted unless batch completed/cancelled. | Delete is allowed only before activity/cost exists. | `/api/hr/production-worker-assignments/[id]` | `hr.write` or `production.write` | `WORKER_ASSIGNMENT_REMOVED`, `WORKER_ASSIGNMENT_DELETE_BLOCKED` | Labour allocations, worker outputs, hours, or output block hard delete. | Protected |
| Posted branch expense | Posted branch expense had no branch-level reversal endpoint. | Void endpoint posts a mirror journal and marks original `VOIDED`. | `/api/branches/[id]/expenses/[expenseId]/void` | branch expense approval or finance write | `EXPENSE_VOIDED`, `JOURNAL_REVERSED` | Only `POSTED` can be voided; duplicate reversal is blocked. | Protected |
| Posted invoice/dispatch cancellation | Cancellation routes only changed status. | Controlled stock and finance reversal implemented through `cancel_sales_invoice_transaction`. | `/api/sales/invoices/[id]/cancel`, `/api/sales/dispatches/[id]/cancel` | sales write / finance write | `INVOICE_CANCELLATION_STARTED`, `INVOICE_CANCELLED`, `DISPATCH_REVERSED`, `STOCK_REVERSAL_CREATED`, `JOURNAL_REVERSED` | No hard delete; paid invoices block; exact journal reversal; `RETURN_IN` stock reversal; duplicate reversal protection. | Implemented |

## Summary

- Broken edit/delete actions found: 4 high-risk actions.
- Broken edit/delete actions fixed in this pass: 4 safety protections implemented.
- Remaining high-risk actions: 0 direct destructive delete paths found in the four audited blockers.
- Remaining non-blocking follow-up: run controlled live E2E after applying the approved invoice/dispatch reversal migration.

## Deployment Gate

This audit is documentation-ready for controlled live E2E. It is not a substitute for running the protected live scenarios in `scripts/live-e2e-readiness.md`.
