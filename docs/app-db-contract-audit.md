# App/DB Contract Audit: `icecream_erp`

This document captures the Phase 1 to Phase 2 contract gap between the current app code and the rebuilt live `icecream_erp` schema.

## Counts

- App-referenced tables in `src`: `200`
- Live `icecream_erp` tables: `102`
- Missing live tables referenced by the app: `107`
- Missing tables already covered by existing repo migrations: `89`
- Missing app-only tables that require new additive definitions: `18`
- Existing tables with RLS disabled: `17`

## Consolidated Interpretation

- The current problem is not isolated to one route or one module.
- The app contract is broader than the manual rebuild snapshot.
- Most missing tables can be recovered safely by consolidating existing additive repo migrations into one new recovery migration.
- The remaining app-only tables need fresh additive compatibility definitions.

## Missing Tables by Module

### Finance

`asset_depreciation`, `bank_accounts`, `bank_reconciliations`, `bank_transactions`, `cash_accounts`, `cash_transactions`, `finance_expenses`, `fiscal_periods`, `fixed_assets`, `journal_entry_lines`, `opening_account_balances`, `petty_cash_requests`, `tax_rates`

### Sales and Branch Operations

`branch_customers`, `branch_expenses`, `branch_payments`, `branch_reconciliations`, `branch_returns`, `branch_sale_items`, `branch_stock_counts`, `branch_stock_ledger`, `branch_stock_receipt_items`, `branch_stock_receipts`, `branch_user_assignments`

### HR

`departments`, `hr_attendance_records`, `hr_employee_contracts`, `hr_job_roles`, `hr_labour_cost_allocations`, `hr_overtime_records`, `hr_payroll_periods`, `hr_payroll_summaries`, `hr_shift_definitions`, `hr_shift_schedule_employees`, `hr_shift_schedules`, `leave_applications`

### Inventory and Procurement

`inventory_batches`, `opening_customer_balances`, `opening_stock_balances`, `opening_supplier_balances`, `stock_adjustment_items`, `stock_adjustments`, `supplier_items`, `supplier_shortages`

### Production

`production_chocolate_types`, `production_flavours`, `production_material_request_items`, `production_material_requests`, `production_shift_targets`, `production_wastage`, `shift_reports`

### Quality

`damaged_goods_records`, `expired_goods_records`, `goods_return_voucher_items`, `goods_return_vouchers`, `market_quality_reports`, `market_report_findings`, `quality_check_parameters`, `quality_check_templates`, `quality_inspections`, `return_inspections`, `reusable_stock_approvals`, `rework_records`, `waste_disposal_records`

### Maintenance

`machine_breakdowns`, `machine_profiles`, `maintenance_schedules`

### Workflows and Controls

`correction_actions`, `correction_requests`, `document_locks`, `posting_logs`, `reversal_logs`, `void_logs`, `workflow_comments`, `workflow_history`

### Settings and Support

`document_files`, `number_series`, `settings_export_batches`, `settings_import_batch_rows`, `settings_import_batches`, `settings_import_templates`, `settings_payment_methods`

### Notifications

No notification tables were missing at audit time after the earlier recovery work, but notification routes still depend on the broader schema contract staying inside `icecream_erp`.

### Testing and Admin Readiness

`backup_jobs`, `backup_logs`, `data_integrity_checks`, `data_integrity_issues`, `deployment_checklist_items`, `deployment_checklists`, `environment_checks`, `error_logs`, `go_live_approvals`, `restore_tests`, `system_health_checks`, `system_health_metrics`, `testing_bug_reports`, `testing_documents`, `testing_handover_approvals`, `testing_handover_checklist`, `testing_release_notes`, `testing_test_cases`, `testing_test_runs`, `testing_training_attendance`, `testing_training_sessions`, `testing_uat_participants`, `testing_uat_sessions`, `testing_uat_signoffs`

## The 18 App-Only Tables

These tables were referenced by the app but did not have matching definitions in the existing additive repo migrations, so `030_full_schema_contract_recovery.sql` must define them directly:

```text
asset_depreciation
bank_reconciliations
branch_sale_items
departments
fixed_assets
inventory_batches
journal_entry_lines
leave_applications
machine_breakdowns
maintenance_schedules
petty_cash_requests
production_material_request_items
production_material_requests
production_wastage
shift_reports
stock_adjustment_items
stock_adjustments
tax_rates
```

## Existing Migration-Backed Missing Tables

The remaining `89` missing tables are already represented in additive repo migrations and should be recovered by consolidating those statements into a single new migration instead of replaying old migrations directly on the VPS.

Main migration sources:

- `002_inventory_control_extensions.sql`
- `003_procurement_management_extensions.sql`
- `004_production_planning_extensions.sql`
- `005_sales_dispatch_extensions.sql`
- `006_branch_operations_extensions.sql`
- `007_finance_accounting_extensions.sql`
- `008_quality_control_returns_extensions.sql`
- `011_hr_shift_productivity_extensions.sql`
- `012_settings_masterdata_import_export_extensions.sql`
- `013_workflow_control_extensions.sql`
- `015_admin_migration_backup_health_readiness.sql`
- `016_testing_uat_training_docs_handover.sql`
- `017_auth_settings_support_tables.sql`
- `019_procurement_returns_payments_productivity.sql`
- `020_procurement_compatibility_columns.sql`
- `021_production_execution_costing.sql`
- `023_inventory_stores_controls.sql`
- `024_procurement_workflow_hq_receipts.sql`
- `025_production_simple_workflow_compatibility.sql`
- `026_maintenance_machine_profiles.sql`
- `027_registration_otps.sql`

## Priority Runtime Risk Areas

- Sales pages must not regress into `PGRST205`, `PGRST106`, or raw schema-cache errors.
- Branch operations, finance, HR, and maintenance are the next highest-risk modules because they still reference missing tables directly from API routes.
- Settings/import-export, testing, workflows, and admin-readiness rely on support tables that were not part of the manual rebuild snapshot.
