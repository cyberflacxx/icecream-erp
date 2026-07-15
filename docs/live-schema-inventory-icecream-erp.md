# Live Schema Inventory: `icecream_erp`

Generated from the Phase 1 read-only VPS inventory for the shared Supabase host. This document is the baseline for Phase 2 contract recovery and must be read together with `SHARED_DB_RULES.md`.

## Summary

- Live `icecream_erp` tables: `102`
- App-referenced tables under `src`: `200`
- Missing live tables still referenced by the app: `107`
- Missing tables already backed by existing repo migrations: `89`
- Remaining app-only tables without existing migration coverage: `18`
- Existing `icecream_erp` tables with RLS disabled: `17`
- Root cause: the live rebuild used `migrations/manual/rebuild_icecream_erp_safe.psql.sql` plus a narrower manual schema snapshot instead of the broader additive app/migration contract.

## Live Table Inventory

```text
accounts
approval_actions
approval_requests
approval_workflow_steps
approval_workflows
attendances
audit_logs
auth_sessions
batch_material_usage
batch_worker_output
branch_sales
branch_shift_closes
branches
budget_lines
budgets
communication_audit_logs
customer_returns
customers
delivery_notes
employees
escalation_logs
escalation_rules
finished_goods_transfers
goods_received_note_items
goods_received_notes
grn_items
hr_production_worker_outputs
invoice_items
invoices
item_categories
items
journal_entries
journal_lines
login_attempts
machines
maintenance_records
notification_delivery_logs
notification_preferences
notification_rules
notification_templates
notifications
organizations
payments
payroll_records
permissions
production_batch_materials
production_batch_outputs
production_batches
production_cost_overrides
production_plan_items
production_plans
production_stock_closures
production_worker_assignments
purchase_order_items
purchase_orders
purchase_requisition_items
purchase_requisitions
quality_checks
quotation_items
quotations
recipe_ingredients
recipe_items
recipe_packaging_items
recipes
reminder_rules
report_definitions
report_exports
report_run_histories
role_permissions
roles
sales_credit_notes
sales_customer_groups
sales_discount_rules
sales_dispatch_note_items
sales_dispatch_notes
sales_journals
sales_order_items
sales_orders
sales_product_prices
saved_report_filters
security_events
session_activities
stock_balances
stock_movements
stock_transfer_items
stock_transfers
supplier_categories
supplier_invoice_items
supplier_invoices
supplier_payments
supplier_return_items
supplier_returns
suppliers
system_settings
units_of_measure
user_accounts
user_branch_assignments
user_roles
user_warehouse_assignments
users
warehouses
wastage_records
```

## RLS Disabled Tables

These tables existed live at audit time but still had `rowsecurity = false`:

```text
finished_goods_transfers
goods_received_note_items
hr_production_worker_outputs
production_batch_materials
production_batch_outputs
production_cost_overrides
production_plan_items
production_plans
production_stock_closures
production_worker_assignments
recipe_items
recipe_packaging_items
supplier_invoice_items
supplier_invoices
supplier_payments
supplier_return_items
supplier_returns
```

## Module Notes

- Sales core is partly recovered live: `quotations`, `quotation_items`, `invoice_items`, `payments`, `customer_returns`, `delivery_notes`, `sales_customer_groups`, `sales_product_prices`, `sales_discount_rules`, `sales_dispatch_notes`, `sales_dispatch_note_items`, `sales_credit_notes`, and `sales_journals` now exist.
- The rebuild still omitted large finance, branch operations, HR, quality, workflows, admin-readiness, testing, and compatibility tables that the app expects.
- Existing live tables also show contract drift from app expectations in several places, especially branch operations, finance, HR, inventory, maintenance, and master-data support tables.
