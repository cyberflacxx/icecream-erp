# Absolute Ice Cream ERP: System Overview

## 1. Purpose
Absolute Ice Cream ERP is a full-stack enterprise system built to manage the end-to-end operations of an ice cream manufacturing and distribution business. It connects procurement, inventory, production, branch operations, sales, finance, HR, and reporting in one platform.

## 2. Business Goals
- Keep stock and production data accurate in real time.
- Enforce operational controls through role-based access and approvals.
- Provide one source of truth across factory and branches.
- Reduce manual reconciliation between departments.

## 3. Technology Architecture
- Monorepo: Turborepo + npm workspaces.
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS.
- API: Express + TypeScript (deployed as serverless function on Vercel).
- Database: Prisma ORM with PostgreSQL (Supabase in production).
- Auth/session: Work ID login flow with JWT/session support.
- Jobs/services: Background-style service modules for alerts/reports.

## 4. High-Level Data Flow
1. User acts from the web UI (register, login, create transaction, approve flow, etc.).
2. Frontend sends requests to `/api/*` endpoints.
3. API validates input using Zod schemas.
4. Business service layer applies rules and permissions.
5. Prisma persists/retrieves records from PostgreSQL.
6. API returns normalized response for frontend rendering.
7. Audit/notification records are generated for traceability.

## 5. Core Functional Modules
- **Procurement**: Suppliers, requisitions, purchase orders, GRNs, returns.
- **Inventory**: Items, warehouses, stock balances, stock movements, transfers.
- **Production**: Recipes, production plans, batches, material requests, outputs.
- **Branch Operations**: Branch sales, expenses, shift close, branch stock visibility.
- **Sales & Distribution**: Customers, quotations, sales orders, invoices, payments.
- **Finance**: Accounts, journal entries, transaction support, operational summaries.
- **HR & Admin**: Employees, attendance, leave, payroll records, role assignments.
- **Settings & Security**: Roles, permissions, users, audit logs, organization config.
- **Reports**: Operational and management reports across modules.

## 6. Security and Access Model
- Role-based access control (RBAC) is enforced server-side.
- Critical routes require permission checks.
- Auth sessions and role resolution are used to scope actions.
- Audit logs capture important business and security actions.

## 7. Important Operational Workflows

### 7.1 Procurement to Stock
1. Requisition is raised.
2. Purchase order is approved and issued.
3. Goods received note (GRN) is captured.
4. Inventory balances and movement records are updated.

### 7.2 Production Consumption and Output
1. Batch is created from a recipe.
2. Materials are requested/approved/issued.
3. Inputs are consumed and finished goods are posted.
4. Wastage and quality checks are recorded.

### 7.3 Branch Sales and Shift Close
1. Branch sale is recorded.
2. Branch stock impact is applied.
3. Shift close computes expected vs actual values and variances.
4. Supervisory approvals can be enforced.

### 7.4 Sales to Cash Collection
1. Customer order/invoice is generated.
2. Payment is posted against customer/supplier context.
3. Balances and status fields are updated for reconciliation.

## 8. Deployment Model
- Frontend and API are deployed via Vercel.
- Routing uses:
  - `/api/*` -> Express API function.
  - all other routes -> Next.js frontend.
- Production database is Supabase PostgreSQL.
- PWA support is enabled (manifest, icons, service worker, install prompt).

## 9. Current Implementation Notes
- The UI includes landing, authentication, and full dashboard module pages.
- API endpoints are module-driven and integrated with Prisma models.
- Sync alignment has been addressed between frontend contracts, API behavior, and DB schema.
- Local dev and production deploy pipelines are active with GitHub + Vercel.

## 10. How Teams Use the System
- **Operations/Procurement** manage sourcing and receipt.
- **Production team** runs batches and monitors yields.
- **Branch managers** track sales and close shifts.
- **Finance** reviews transactions and summaries.
- **Admins** control users, roles, and permissions.
- **Leadership** monitors reports and KPIs for decisions.

---
This document is intended as a practical operating overview for developers, implementers, and business users onboarding onto Absolute Ice Cream ERP.
