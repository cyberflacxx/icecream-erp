## ERP Phase 1G End-to-End Test Plan

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Scope: controlled end-to-end validation for Phases 1A through 1G, with emphasis on atomic posting, operational reversals, inventory-finance linkage, and branch-scoped authorization.

### 1. Test Preconditions

- Use an isolated non-production PostgreSQL database.
- Apply migrations through `045_inventory_operational_reversals.sql` in sequence only after checksum verification.
- Seed at least:
  - one test supplier
  - one test customer
  - one finished-goods item
  - one raw-material item
  - one active BOM for the finished good
  - one source warehouse and one destination warehouse
  - one branch manager restricted to a single branch
  - one finance user with posting and reversal permission
- Confirm fiscal period is open.
- Confirm test users can authenticate without bypassing branch authorization.

### 2. Validation Objectives

- Confirm procurement, production, inventory, sales, and finance flows complete against real data.
- Confirm atomic posting updates stock, stock movements, ledgers, and journals together.
- Confirm reversal workflows restore balances safely and preserve audit history.
- Confirm branch-restricted users cannot cross branch boundaries through UI or direct API calls.

### 3. Procurement to GRN Flow

1. Create a purchase requisition for raw materials.
2. Submit the requisition.
3. Approve the requisition.
4. Create a purchase order from the approved requisition.
5. Approve the purchase order.
6. Create a GRN against the approved purchase order.
7. Approve the GRN.
8. Post the GRN.

Expected results:

- Requisition, PO, and GRN statuses transition to approved and posted states without bypasses.
- GRN lines load from the approved PO.
- Partial receipt quantities are accepted when below ordered quantity.
- PO received and remaining quantities recalculate correctly.
- Inventory stock increases for received quantities.
- Stock movement rows are created.
- Journal entry is created and balanced.
- Supplier link and source document references remain visible.

### 4. Production Flow

1. Create a production order for the finished good using product number as the primary identifier.
2. Enter planned quantity.
3. Confirm latest active BOM loads.
4. Release the order.
5. Post issue of raw materials.
6. Post receipt of finished goods.
7. Close the production order.

Expected results:

- BOM consumption is calculated from planned quantity.
- Raw-material inventory decreases on issue.
- Finished-goods inventory increases on receipt.
- Production order relationship map links order, issue, and receipt.
- Production journals and inventory movements remain consistent.

### 5. Transfer Flow

1. Create a transfer for finished goods from source warehouse to destination warehouse.
2. Dispatch the transfer.
3. Receive a partial quantity.
4. Receive the remainder.

Expected results:

- Dispatch reduces source stock and moves value to goods in transit.
- Partial receipt is accepted without over-receipt.
- Final receipt increases destination stock and clears goods in transit.
- Transfer status progresses correctly through dispatch and receipt stages.
- Stock movement and journal links remain traceable.

### 6. Sales Flow

1. Create or identify a test customer.
2. Create a sales invoice for finished goods.
3. Post the sale.
4. Record payment.
5. Open printable invoice output.

Expected results:

- Sales posting reduces inventory using the atomic inventory-finance posting path.
- Customer ledger updates.
- Revenue, receivable, tax, and cost of sales journals balance.
- Payment settles the customer balance correctly.

### 7. Cross-Module Financial Verification

After procurement, production, transfer, and sales transactions:

1. Verify stock ledger entries exist for each operational posting.
2. Verify related journal entries can be opened from source documents.
3. Run Trial Balance.
4. Run Income Statement / Profit and Loss.
5. Run Balance Sheet.
6. Run inventory valuation and inventory reconciliation reports if available.

Expected results:

- Inventory balances reconcile to stock ledger and journal totals.
- Trial Balance remains balanced.
- Income Statement reflects procurement-related non-P&L handling and production/sales cost flow.
- Balance Sheet reflects inventory, payables, receivables, and cash movement correctly.

### 8. Reversal Scenarios

Run these only on dedicated test documents:

#### 8.1 GRN Reversal

1. Reverse a posted GRN with a mandatory reason.
2. Verify duplicate reversal is blocked.

Expected results:

- PO received quantities are restored.
- PO status is recalculated.
- Stock quantities and value are reduced back out.
- Original journal is reversed and correcting journal is linked.
- Reversal audit record is created.

#### 8.2 Stock Adjustment Reversal

1. Post one gain adjustment and one loss adjustment.
2. Reverse each with a reason.

Expected results:

- Duplicate reversal is blocked.
- Stock balances return to pre-adjustment values.
- Reversal movements and correcting journals are created.

#### 8.3 Write-Off Reversal

1. Post a write-off for damaged or expired stock.
2. Reverse it with a reason.

Expected results:

- Stock is restored.
- Batch and expiry context remain traceable.
- Journal and movement links remain visible.

#### 8.4 Transfer Receipt Reversal

1. Reverse a posted transfer receipt where business rules allow.

Expected results:

- Destination inventory is reduced.
- Goods in transit is restored.
- Transfer header returns to an in-transit state.
- Duplicate receipt reversal is blocked.

#### 8.5 Transfer Dispatch Reversal

1. Attempt to reverse dispatch before reversing dependent receipt.
2. Reverse receipt first.
3. Reverse dispatch.

Expected results:

- Dispatch reversal is blocked while downstream receipt remains active.
- After receipt reversal, dispatch reversal restores source stock.
- Transfer status recalculates correctly.

### 9. Security and Authorization Tests

1. Log in as a branch-restricted manager.
2. Attempt to create, approve, post, and reverse transactions for an unauthorized branch through UI.
3. Repeat through direct API requests with a forged `branch_id`.

Expected results:

- `src/lib/branch-access.ts` server-side checks reject unauthorized access.
- Warehouse-scoped operations reject unauthorized branch-warehouse combinations.
- UI selectors do not expose unauthorized branches.

### 10. Concurrency Tests

Run only with `PHASE_1G_DB_TESTS=1`, `PHASE_1G_DB_ISOLATED=1`, a dedicated `DATABASE_URL`, and `psql` available.

1. GRN concurrent over-receipt race.
2. Write-off concurrent stock depletion race.
3. Transfer concurrent receipt race.
4. Repeated idempotent post request replay.

Expected results:

- Conflicting concurrent attempts fail safely.
- Inventory does not go negative.
- Duplicate posting and duplicate reversal protections hold.
- Safe idempotent retry behavior is deterministic.

### 11. Exit Criteria

- All module flows complete without manual database correction.
- Journals remain balanced after forward and reverse postings.
- Stock balances reconcile after reversals.
- Authorization boundaries hold at UI and API layers.
- No duplicate posting or duplicate reversal occurs.
- Trial Balance remains balanced after the full scripted run.

### 12. Execution Notes

- Do not run against production.
- Do not bypass approval flows.
- Do not disable branch authorization for convenience.
- Record document IDs, journal IDs, movement IDs, and reversal IDs during execution for the Phase 1G evidence pack.
