# ERP Phase 1H Client Sign-Off Checklist

Date: 2026-08-01
Branch: `fix/sales-invoice-production`
Status: pending

## Release Preconditions

- [ ] Isolated PostgreSQL 15 database provisioned
- [ ] `PHASE_1G_DB_TESTS=1` configured
- [ ] `PHASE_1G_DB_ISOLATED=1` configured
- [ ] non-production `DATABASE_URL` configured
- [ ] `psql` available to the operator
- [ ] isolated backup captured
- [ ] migration checksums recorded

## Isolated Migration Rehearsal

- [ ] `043_finance_chart_of_accounts_foundation.sql` applied
- [ ] `043` verification passed
- [ ] `044_atomic_inventory_posting_and_stock_ledger.sql` applied
- [ ] `044` verification passed
- [ ] `045_inventory_operational_reversals.sql` applied
- [ ] `045` verification passed
- [ ] transaction test passed
- [ ] concurrency test passed

## Controlled UAT

- [ ] Procurement flow completed end to end
- [ ] Production flow completed end to end
- [ ] Transfer flow completed end to end
- [ ] Sales flow completed end to end
- [ ] GRN reversal verified
- [ ] Stock adjustment reversal verified
- [ ] Write-off reversal verified
- [ ] Transfer receipt reversal verified
- [ ] Transfer dispatch reversal verified
- [ ] branch-scoped authorization verified through UI
- [ ] branch-scoped authorization verified through direct API calls

## Reconciliation

- [ ] stock ledger verified
- [ ] customer ledger verified
- [ ] supplier balances verified
- [ ] Trial Balance balanced
- [ ] Balance Sheet balanced
- [ ] inventory reconciliation matched

## Deployment Approval

- [ ] release notes reviewed
- [ ] production commands reviewed
- [ ] rollback commands reviewed
- [ ] production maintenance window approved
- [ ] client sign-off received

## Current Blockers

- [x] isolated DB rehearsal not yet executed
- [x] UAT not yet executed
- [x] real transaction and concurrency evidence not yet captured
