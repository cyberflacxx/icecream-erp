# Client Change Tracker

Last updated: 2026-07-02

This file groups the latest client requests into related workstreams so we can track what is done, what is blocked, and what still needs design or data clarification.

## Progress Key

- `[x]` Done
- `[ ]` Not started
- `[-]` In progress
- `[?]` Needs clarification or live verification

## Immediate UX Fixes

- `[x]` Sales receipts: add `Save` and `Save & Print` actions for receipt entry so branch users can record and immediately print customer receipts.
- `[x]` Verify and fix the `Invoice not found.` issue seen while recording receipts from the sales payments drawer by aligning receipt invoice selection to the live `icecream_erp` invoice source and payable-status filters.

## Procurement

### Suppliers

- `[x]` Fix supplier save flow by making supplier create and update tolerant of missing optional live-schema columns such as tax and document fields.
- `[-]` Allow supplier document attachments.
- `[ ]` Confirm supplier master data import works from template.

### Requisitions

- `[-]` Fix item selection in requisitions.
- `[ ]` Allow choosing the approver.
- `[ ]` Show who created the requisition to approvers and supervisors.
- `[ ]` Add clear `Approve` and `Reject` actions.
- `[ ]` Reflect approval status clearly in the list and detail flow.

### Purchase Orders

- `[ ]` Generate the PO in the format the client provided.
- `[ ]` Include company information on the PO.
- `[ ]` Show raw material prices on the PO.
- `[ ]` Support addition and subtraction during PO line editing.
- `[ ]` Add option to email the PO directly to the supplier.
- `[ ]` Keep PO actions simple and direct for users.

### Goods Received / GRN

- `[ ]` Confirm PO-linked goods receiving posts exactly against the selected PO.
- `[ ]` Allow manual goods received entry where PO is not used.
- `[ ]` Ensure goods received updates HQ inventory only, as requested.
- `[ ]` Add supervisor `Approve` and `Reject` actions with visible status.

### Supplier Invoices and Payments

- `[ ]` Add a clean way to capture supplier invoices.
- `[ ]` Link supplier invoices to purchase orders and GRNs where applicable.
- `[ ]` Link procurement payments to supplier invoices.
- `[ ]` Ensure every procurement transaction links end to end.

## Inventory and Stores

### Warehouse Structure

- `[ ]` Support independent balances for raw materials, production materials, finished goods, dispatch, and returns warehouses.

### Transfers

- `[ ]` Redesign transfers around a direct warehouse-to-warehouse flow.
- `[ ]` Remove the old duplicated `stock movement` and `leave transfers` option if it conflicts with the requested redesign.
- `[ ]` Require source warehouse, destination warehouse, item, quantity, price, reference number, remarks, and batch or lot where applicable.
- `[ ]` Support transfer statuses: `Draft`, `Pending Approval`, `Approved`, `Completed`, `Cancelled`.
- `[ ]` On completion, immediately subtract from source and add to destination.
- `[ ]` Prevent duplicate transfer records and duplicate stock movement postings.
- `[ ]` Keep the inventory ledger balanced.

### Stores Controls

- `[ ]` Make stores the central control point for inventory.
- `[ ]` Support GRN, GIN, internal transfers, material requisitions, stock adjustments, stock returns, stock counts, cycle counts, physical verification, damaged stock, expired stock, scrap, bin locations, shelf locations, min-max levels, reorder levels, and reorder alerts.
- `[ ]` Ensure stock can be added and subtracted correctly across stores transactions.
- `[ ]` Track transaction history by item and by warehouse.
- `[ ]` Generate full audit trails for stores transactions.

### Pricing Links

- `[ ]` Link procurement pricing to inventory movements and balances.
- `[ ]` Make raw material prices visible where stock and procurement intersect.

## Production

### BOM Stage

- `[ ]` Define bills of materials for finished goods.
- `[ ]` Support raw material quantities per finished item recipe.

### Issuing Stage

- `[ ]` Issue raw materials from the production store based on approved BOMs.
- `[ ]` Record material consumption for stock accuracy.

### Release Stage

- `[ ]` Release finished goods into finished goods inventory after production.
- `[ ]` Reduce raw materials and increase finished goods automatically.

### Production Inventory and Reporting

- `[ ]` Maintain a dedicated production inventory.
- `[ ]` Track raw materials, work in progress, and finished goods in real time.
- `[ ]` Add production reports for materials used, output quantities, and balances.

## Cross-Module Linking and Controls

- `[ ]` Ensure transactions link across procurement, inventory, production, sales, finance, HR, quality, and branch workflows where the client expects one document trail.
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
