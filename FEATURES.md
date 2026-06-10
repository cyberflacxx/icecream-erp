# Absolute Ice Cream ERP — Feature Registry
> Auto-referenced at the start of every conversation.
> Status: 🟢 Implemented | 🟡 Partial / In Progress | 🔴 Planned / Not Yet Built

---

## 🔐 Authentication & User Management

| Feature | Status | Notes |
|---|---|---|
| Work ID login (AQI-XXXXXXXX format) | 🟢 | `/auth/login` with SweetAlert2 feedback |
| Staff registration with admin key | 🟢 | `/auth/register`, admin key = `AQI-ADMIN-2026` |
| Role-based access control (RBAC) | 🟡 | Roles exist, `PermissionGate` component works, needs tighter per-module enforcement |
| Password = ID number (lowercase letter) | � | Wired: email template shows computed password; registration stores hashed ID number as password |
| Welcome email on account creation | 🟢 | Gmail SMTP live; ice-cream themed HTML with Work ID + password |
| Work ID emailed on registration | 🟢 | Included in welcome email with credentials block |
| First-login welcome modal (onboarding) | 🔴 | Planned — modal with features list, profile pic upload, password change |
| Admin impersonate login (key: DrnLeeroy) | 🟢 | `POST /api/auth/impersonate` with key check; sets cookie + returns token |
| Password reset by admin | 🔴 | Planned — admin settings → reset any user's password |
| Profile picture upload | 🔴 | Planned — needs storage decision (Supabase Storage vs local) |
| Session expiry & auto logout | 🟡 | Token stored in localStorage + cookie; no idle timeout yet |
| Audit log on login/logout | 🟡 | API writes audit log when DB is connected |

---

## 🏠 Dashboard

| Feature | Status | Notes |
|---|---|---|
| Role-aware KPI stats (Admin/Production/Branch) | 🟢 | `DashboardOverview` switches view by role |
| Live production output counter | 🟢 | Mock data; real when DB connected |
| Revenue trend line chart | 🟢 | Recharts; real data from API when connected |
| Inventory breakdown pie chart | 🟢 | Recharts |
| Recent transactions table | 🟢 | |
| Real-time branch sales updates (Supabase Realtime) | 🟡 | Wired but needs icecream_erp schema migration on VPS |
| Dashboard widget customisation | 🔴 | Planned |
| Export dashboard snapshot to PDF | 🔴 | Planned |

---

## 📦 Procurement

| Feature | Status | Notes |
|---|---|---|
| Supplier management (CRUD) | 🟢 | `/procurement/suppliers` |
| Purchase Requisitions (PR) | 🟢 | `/procurement/requisitions` |
| Purchase Orders (PO) | 🟢 | `/procurement/purchase-orders` |
| Goods Received Notes (GRN) | 🟢 | `/procurement/goods-received` |
| Multi-level approval workflow | 🟡 | API routes exist; UI approval buttons partial |
| Supplier rating / blacklist | 🟡 | Model exists; UI not built |
| RFQ (Request for Quotation) | 🔴 | Planned |
| Supplier payment terms tracking | 🟡 | Field exists on model |

---

## 🏪 Inventory

| Feature | Status | Notes |
|---|---|---|
| Items / products master list | 🟢 | `/inventory/items` |
| Stock balances by warehouse | 🟢 | `/inventory/stock-balances` |
| Stock movements ledger | 🟢 | `/inventory/stock-movements` |
| Warehouse management | 🟢 | `/inventory/warehouses` |
| Stock transfers between branches | 🟢 | `/inventory/transfers` |
| Expiry date tracking | 🟢 | `/inventory/expiring` |
| Low-stock alerts (job) | 🟢 | `low-stock-check.job.ts` runs on schedule |
| Expiry alerts (job) | 🟢 | `expiry-alert.job.ts` |
| Barcode / batch label printing | 🔴 | Planned |
| Stock adjustment with reason | 🟡 | API supports; UI partial |

---

## 🏭 Production

| Feature | Status | Notes |
|---|---|---|
| Recipe / Bill of Materials (BOM) | 🟢 | Production module |
| Production batch management | 🟢 | Create, start, close batches |
| Batch material consumption tracking | 🟢 | |
| Worker output per shift | 🟡 | Model exists (`batch_worker_output`); UI page partial |
| Yield tracking vs target | 🟡 | Calculated in costing; UI partial |
| Wastage recording | 🟡 | Model exists; form not built |
| Shift management (morning/night) | 🟡 | Model exists; UI partial |
| Production planning calendar | 🔴 | Planned |
| BOM version control | 🔴 | Planned |

---

## 🏪 Branch Operations

| Feature | Status | Notes |
|---|---|---|
| Multi-branch management | 🟢 | `/branches` |
| Branch-level daily sales | 🟢 | `/branches/[id]/sales` |
| Shift close report | 🟢 | `/branches/[id]/shift-close` |
| Branch expense recording | 🟡 | API exists; UI partial |
| Cash handover reconciliation | 🟡 | Partial |
| Inter-branch stock transfer | 🟢 | Via inventory transfers |

---

## 🛒 Sales

| Feature | Status | Notes |
|---|---|---|
| Customer management | 🟢 | `/sales/customers` |
| Sales orders | 🟢 | `/sales/orders` |
| Invoicing | 🟢 | `/sales/invoices` |
| Credit limit enforcement | 🟡 | UI shows warning; API enforcement partial |
| Quotations | 🟡 | API exists; UI not built |
| Payment recording | 🟡 | API exists; UI not built |
| Delivery notes | 🟡 | PDF generation exists in API |
| Sales returns / credit notes | 🔴 | Planned |

---

## 💰 Finance & Accounting

| Feature | Status | Notes |
|---|---|---|
| Double-entry journal entries | 🟡 | API exists; UI form partial |
| Chart of accounts | 🟡 | Model exists |
| Income statement report | 🔴 | Planned |
| Cash flow report | 🔴 | Planned |
| Bank reconciliation | 🔴 | Planned |
| Tax (VAT) computation | 🔴 | Planned |
| Petty cash management | 🔴 | Planned |

---

## 👥 HR & Payroll

| Feature | Status | Notes |
|---|---|---|
| Employee records | 🟢 | `/hr/employees` |
| Attendance tracking | 🟢 | `/hr/attendance` |
| Payroll processing | 🟢 | `/hr/payroll` |
| Leave management | 🔴 | Planned |
| Overtime calculation | 🟡 | Field in payroll model |
| Payslip PDF generation | 🔴 | Planned |
| PAYE / statutory deductions | 🔴 | Planned |

---

## 🧪 Quality Control

| Feature | Status | Notes |
|---|---|---|
| QC checks by production stage | 🟢 | `/quality` |
| Pass/fail recording | 🟢 | |
| Quarantine management | 🟡 | UI alert shown; full workflow planned |
| Batch rejection workflow | 🔴 | Planned |
| QC report export | 🔴 | Planned |

---

## 💵 Cost Accounting

| Feature | Status | Notes |
|---|---|---|
| Cost per batch calculation | 🟢 | `/cost-accounting` |
| Cost per unit (cone/stick) | 🟢 | |
| Material cost breakdown | 🟢 | |
| Labour cost tracking | 🟡 | Partial |
| Overhead allocation | 🔴 | Planned |
| Standard vs actual cost variance | 🟡 | Chart shown; full analysis planned |
| Cost centre reporting | 🔴 | Planned |

---

## 🔧 Maintenance

| Feature | Status | Notes |
|---|---|---|
| Machine register | 🟢 | `/maintenance/machines` |
| Preventive maintenance schedule | 🟡 | UI shows next service; scheduling form not built |
| Breakdown recording | 🟢 | |
| Repair cost tracking | 🟡 | Field exists; reports not built |
| Maintenance job card | 🔴 | Planned |

---

## 📊 Budget & Forecasting

| Feature | Status | Notes |
|---|---|---|
| Budget entry by department | 🟢 | `/budget` |
| Budget vs actual variance | 🟢 | Bar chart |
| Alert when over budget | 🟡 | UI badge; no notification trigger yet |
| Multi-year forecast | 🔴 | Planned |

---

## 📈 Reports

| Feature | Status | Notes |
|---|---|---|
| Daily production report (job) | 🟢 | `daily-report.job.ts` |
| PDF report generation | 🟢 | `pdf-generation.job.ts` |
| CSV/Excel export utility | 🟢 | `lib/export.ts` |
| Management dashboard reports | 🟡 | Basic charts; full report builder planned |
| BI / advanced analytics | 🔴 | Planned |
| Scheduled email reports | 🔴 | Planned |

---

## ⚙️ Settings & Administration

| Feature | Status | Notes |
|---|---|---|
| User management (list/create/deactivate) | 🟡 | Register page works; admin list view partial |
| Role & permission management | 🟡 | Roles exist; permission editor UI not built |
| Organisation / branch settings | 🟡 | Partial |
| Audit trail viewer | 🟡 | `/settings/audit-logs` page exists |
| Email configuration | 🔴 | Needs Gmail app password |
| System backup | 🔴 | Planned |
| Settings moved to top-right dropdown | 🔴 | Planned |
| Admin impersonate login | 🔴 | Key: `DrnLeeroy` in .env |
| Password reset by admin | 🔴 | Planned |

---

## 🔔 Notifications

| Feature | Status | Notes |
|---|---|---|
| In-app notifications | 🟡 | Bell icon in topbar; content partial |
| Push notifications (VAPID) | 🟡 | Service worker exists (`sw.js`); not fully wired |
| Email notifications (alerts) | 🔴 | Needs email config |
| Low stock notification | 🟢 | Job runs; email delivery pending config |
| Expiry date notification | 🟢 | Job runs; email delivery pending config |

---

## 🎨 UI/UX

| Feature | Status | Notes |
|---|---|---|
| Dark theme (default) | 🟢 | `#0D0500` base |
| Light theme toggle | 🟡 | Toggle exists; site-wide CSS not fully wired |
| Responsive layout | 🟡 | Partial; mobile sidebar not done |
| Landing page (animated pipeline) | 🟢 | Full ice cream factory pipeline hero |
| SweetAlert2 feedback dialogs | 🟢 | Login/register |
| Feature status badges on pages | 🔴 | Planned — 🟢🟡🔴 corner badges |
| Profile picture on sidebar/topbar | 🔴 | Planned |
| First-login onboarding modal | 🔴 | Planned |
| Dropdown menus on forms | 🟡 | Some exist; standardisation needed |
| Reduced border radius (production look) | 🔴 | In progress |

---

## 🗄️ Database & Infrastructure

| Feature | Status | Notes |
|---|---|---|
| PostgreSQL 15 on self-hosted VPS | 🟢 | `178.238.227.229` Docker |
| Prisma ORM | 🟢 | Schema covers all modules |
| `icecream_erp` Supabase schema | 🟡 | SQL migration written; needs to be run on VPS |
| Shared VPS (multi-tenant safe) | 🟢 | Uses additive pgrst.db_schemas rule |
| Seed data (demo accounts) | 🟡 | Local in-memory; needs DB seed script |
| Monorepo (npm workspaces + Turbo) | 🟢 | |
| API on Express.js port 4000 | 🟢 | |
| Web app on Next.js 14 port 3000 | 🟢 | |

---

## 📋 Quick Start for Demo

```
# 1. Start API
cd apps/api && npx tsx src/server.ts

# 2. Start Web
cd apps/web && npx next dev

# 3. Login
Work ID: AQI-20261001   Password: Demo@2026!   Role: Super Admin
Work ID: AQI-20261004   Password: Demo@2026!   Role: Production Manager
Work ID: AQI-20261007   Password: Demo@2026!   Role: Branch Manager
Work ID: AQI-20261008   Password: Demo@2026!   Role: Accountant
```

---

## 🚧 Priority Fix List (Next Sessions)

1. 🔴 Run `icecream_erp` SQL migration on VPS to activate DB
2. 🔴 Gmail app password → wire email sending on registration
3. 🔴 First-login welcome modal + onboarding flow
4. 🔴 Admin impersonate login (key: `DrnLeeroy`)
5. 🔴 Profile picture upload (decide: Supabase Storage vs local)
6. 🔴 Feature status corner badges on every module page
7. 🟡 Light theme — fix CSS variable wiring site-wide
8. 🟡 Tighter RBAC — hide sidebar items by role permission
9. 🟡 Settings → move to top-right user dropdown
10. 🟡 Password = ID number (lowercase letter) auto-set on registration

---

*Last updated: June 8, 2026*
