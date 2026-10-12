# Live E2E Readiness Plan

Do not run this automatically. Execute manually with an authenticated Admin/Super Admin account after migration 061 preflight passes and a backup exists.

Use identifiable prefixes:
- `E2E-UOM-`
- `E2E-PAY-`
- `E2E-BOM-`

Record every created ID in the execution log before cleanup.

## Before Running

1. Create a database backup.
2. Run read-only preflight:
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preflight-061.sql`
3. Apply migration 061 only after review:
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/061_item_uom_conversions_and_bom_versioning.sql`
4. Confirm app health and login.

## Scenario A: Procurement + UOM

1. Create raw material `E2E-UOM-Raw Material`.
2. Set base UOM to `LITRE`.
3. Create item UOM conversion:
   `1 BUCKET = 20 LITRES`.
4. Create supplier `E2E-PAY-Supplier`.
5. Create purchase order for `10 BUCKETS`.
6. Expected PO line:
   transaction quantity `10`, transaction UOM `BUCKET`, base quantity `200`, base UOM `LITRE`, conversion factor `20`.
7. Receive GRN for `10 BUCKETS`.
8. Post GRN to inventory.
9. Expected stock balance:
   `200 LITRES`.
10. Expected stock movement:
   movement quantity `200`, transaction quantity `10`, transaction UOM `BUCKET`, base quantity `200`, base UOM `LITRE`.

## Scenario B: Production UOM Consumption

1. Create BOM `E2E-BOM-V1`.
2. Add raw material consumption:
   `35 LITRES`.
3. Create production batch/order using the BOM.
4. Issue materials.
5. Expected stock balance:
   `165 LITRES` remaining from the original `200 LITRES`.
6. Confirm production material/cost lines use `35 LITRES` base quantity.

## Scenario C: Supplier Payment

1. Create supplier invoice `E2E-PAY-Invoice` for `$1000`.
2. Post cash payment `$300`.
3. Expected:
   invoice outstanding `$700`, payment row created, journal balanced, Dr Accounts Payable `$300`, Cr Cash `$300`.
4. Post bank transfer `$200`.
5. Expected:
   invoice outstanding `$500`, payment row created, journal balanced, Dr Accounts Payable `$200`, Cr Bank `$200`.
6. Attempt payment `$600`.
7. Expected:
   rejected as overpayment; no payment row; no journal.
8. Attempt duplicate payment reference/idempotency key.
9. Expected:
   no duplicate payment and no duplicate journal.

## Scenario D: Supplier Payment Receipt

1. Open the supplier payment receipt from payment history.
2. Verify fields:
   company details, receipt number, date/time, supplier, invoice/PO/GRN reference where applicable, amount paid, outstanding, method, reference, cashier/user.
3. Test browser print:
   A4, 80mm, 58mm.
4. Expected:
   no sidebar/nav, black text on white, no clipped columns, no horizontal overflow, totals stay together.

## Scenario E: BOM Change and Protection

1. Complete or preserve historical production using `E2E-BOM-V1`.
2. Edit BOM material composition/quantity.
3. Expected:
   new version is created; old version remains historical.
4. Create a new production order.
5. Expected:
   new order uses latest active BOM version.
6. Try deleting a BOM used by active production.
7. Expected:
   business error; no destructive delete.
8. Try deleting historical BOM.
9. Expected:
   archive/deactivate behavior; historical production remains readable.

## Cleanup Log

Record IDs before any cleanup:

| Prefix | Table/Object | ID | Cleanup Action |
| --- | --- | --- | --- |
| E2E-UOM- | item |  | deactivate if unused |
| E2E-UOM- | item_uom_conversion |  | deactivate if unused |
| E2E-PAY- | supplier |  | deactivate if unused |
| E2E-PAY- | supplier_invoice |  | reverse/void only if posted |
| E2E-PAY- | supplier_payment |  | reverse/void only if posted |
| E2E-BOM- | recipe |  | archive/deactivate |
| E2E-BOM- | production batch/order |  | cancel/void only if allowed |

Never hard-delete posted GRNs, posted stock movements, posted supplier payments, journals, or completed production history.
