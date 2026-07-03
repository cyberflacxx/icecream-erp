# Client Change Tracker

Last updated: 2026-07-03

This file groups the latest client requests into related workstreams so we can track what is done, what is blocked, and what still needs design or data clarification.

## Progress Key

- `[x]` Done
- `[ ]` Not started
- `[-]` In progress
- `[?]` Needs clarification or live verification

## Immediate UX Fixes

- `[x]` Sales receipts: add `Save` and `Save & Print` actions for receipt entry so branch users can record and immediately print customer receipts.
- `[x]` Verify and fix the `Invoice not found.` issue seen while recording receipts from the sales payments drawer by aligning receipt invoice selection to the live `icecream_erp` invoice source and payable-status filters.
- `[-]` Restyle the shared dashboard UI to match the tighter RoboCore internal ERP look, with smaller typography, sleeker spacing, cooler surfaces, and consistent shell polish across modules.
  Current progress: shared theme tokens, shell chrome, button system, table/card/filter/drawer components, module nav families, notifications, PWA prompts, and onboarding modal have been moved into the RoboCore-style visual system.

## Procurement

### Suppliers

- `[x]` Fix supplier save flow by making supplier create and update tolerant of missing optional live-schema columns such as tax and document fields.
- `[-]` Allow supplier document attachments through a server-managed upload flow that can create the missing storage bucket and avoid client-side storage permission failures.
- `[ ]` Confirm supplier master data import works from template.

### Requisitions

- `[x]` Fix item selection in requisitions by tying item choice to clearer item context and automatic unit-of-measure fill.
- `[x]` Allow choosing the approver.
- `[x]` Show who created the requisition to approvers and supervisors.
- `[x]` Add clear `Approve` and `Reject` actions.
- `[-]` Reflect approval status clearly in the list and detail flow, including approved or rejected ownership and editable draft visibility, then confirm against live user accounts.

### Purchase Orders

- `[x]` Generate the PO in a cleaner supplier-facing format with a proper printable document layout.
- `[x]` Include company information on the PO.
- `[x]` Show raw material prices on the PO.
- `[x]` Support addition and subtraction during PO line editing.
- `[-]` Add option to email the PO directly to the supplier and confirm live delivery during the final full-system test pass.
- `[x]` Keep PO actions simple and direct for users.

### Goods Received / GRN

- `[-]` Confirm PO-linked goods receiving posts exactly against the selected PO, with final live verification still pending.
- `[x]` Allow manual goods received entry where PO is not used.
- `[-]` Ensure goods received updates HQ inventory only, as requested, with the UI now locked to HQ warehouse selection and final posting verification still pending.
- `[x]` Add supervisor `Approve` and `Reject` actions with visible status.

### Supplier Invoices and Payments

- `[x]` Add a clean way to capture supplier invoices.
- `[x]` Link supplier invoices to purchase orders and GRNs where applicable.
- `[x]` Link procurement payments to supplier invoices, including quick-pay handoff from invoice records into the payment drawer.
- `[-]` Ensure every procurement transaction links end to end, with final live verification still pending across supplier invoice posting, payment posting, and linked document balances.

## Inventory and Stores

### Warehouse Structure

- `[x]` Support independent balances for raw materials, production materials, finished goods, dispatch, and returns warehouses, with clearer warehouse-type visibility on the inventory warehouse screen.

### Transfers

- `[x]` Redesign transfers around a direct warehouse-to-warehouse flow.
- `[-]` Remove the old duplicated `stock movement` and `leave transfers` option if it conflicts with the requested redesign.
- `[x]` Require source warehouse, destination warehouse, item, quantity, price, reference number, remarks, and batch or lot where applicable.
- `[x]` Support transfer statuses: `Draft`, `Pending Approval`, `Approved`, `Completed`, `Cancelled`.
- `[x]` On completion, immediately subtract from source and add to destination.
- `[-]` Prevent duplicate transfer records and duplicate stock movement postings, with transfer-status posting tightened and integrity review surfaced for testing.
- `[-]` Keep the inventory ledger balanced, with integrity checks already available and final live validation still pending.

### Stores Controls

- `[x]` Make stores the central control point for inventory, with a dedicated inventory stores controls page plus clearer dashboard and approvals routing.
- `[-]` Support GRN, GIN, internal transfers, material requisitions, stock adjustments, stock returns, stock counts, cycle counts, physical verification, damaged stock, expired stock, scrap, bin locations, shelf locations, min-max levels, reorder levels, and reorder alerts.
- `[-]` Ensure stock can be added and subtracted correctly across stores transactions, with stores-side controls now exposed for adjustments, stock take, customer returns, production issue, and finished-goods receipt.
- `[x]` Track transaction history by item and by warehouse.
- `[x]` Generate full audit trails for stores transactions.

### Pricing Links

- `[x]` Link procurement pricing to inventory movements and balances through visible unit cost and stock value on inventory balance rows.
- `[x]` Make raw material prices visible where stock and procurement intersect.

## Production

### BOM Stage

- `[x]` Define bills of materials for finished goods through production recipe formulas.
- `[x]` Support raw material quantities per finished item recipe.

### Issuing Stage

- `[x]` Issue raw materials from the production store based on approved BOMs through batch material request, approval, reservation, and usage flows.
- `[x]` Record material consumption for stock accuracy.

### Release Stage

- `[x]` Release finished goods into finished goods inventory after production.
- `[-]` Reduce raw materials and increase finished goods automatically, with the workflow present and final live stock-posting verification still pending.

### Production Inventory and Reporting

- `[-]` Maintain a dedicated production inventory, with production warehouses, batch WIP, and finished-goods transfer flows in place and live verification still pending.
- `[-]` Track raw materials, work in progress, and finished goods in real time, with final live validation still pending across the full production cycle.
- `[x]` Add production reports for materials used, output quantities, and balances.

## Cross-Module Linking and Controls

- `[-]` Ensure transactions link across procurement, inventory, production, sales, finance, HR, quality, and branch workflows where the client expects one document trail, with stores cross-links and procurement-to-payment linking now improved.
- `[ ]` Review approval and visibility rules for role-based users, especially supervisors and branch managers.

## Test Accounts Provided By Client

- `[ ]` Verify access and workflow coverage for Sales Lead, Inventory Lead, Quality Lead, Finance Lead, HR Lead, Operations Manager, Branch Manager, and Production Manager.

## Implementation Notes

- The current pass started with the sales receipt workflow because the user explicitly requested `Save` and `Save & Print` for branch-side receipt capture.
- The next smart step is to tackle requests in this order:
  1. Procurement workflow stability
  2. Inventory and stores redesign
  3. Production flow completion
  4. Cross-module linking and polish
