# Absolute Ice Cream ERP

## Overview
Absolute Ice Cream ERP is a full-stack manufacturing ERP tailored for ice cream production and distribution workflows.  
It covers procurement, inventory, production, branch operations, sales, finance-ready reporting, role-based access control, and operational auditability.

## Tech Stack
- Monorepo: Turborepo
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, shadcn/ui primitives
- Backend: Node.js, Express, TypeScript
- ORM/DB: Prisma + PostgreSQL
- Auth: Clerk
- Realtime/Storage: Supabase (Realtime + Storage)
- Queue/Jobs: BullMQ + Redis
- Validation: Zod
- Testing: Node test runner (`node --test`) with TSX

## Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis
- Supabase account
- Clerk account

## Setup

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd absolute-ice-cream-erp
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill all values:
```bash
cp .env.example .env
```

### 3. Database Setup
```bash
npx prisma migrate dev
npx prisma db seed
```

### 4. Run Development
```bash
npm run dev
```

### 5. Default Login Credentials
Seeded profiles (roles are pre-assigned; authentication is managed by Clerk):
- `tafadzwa.moyo@absolutequalityicecream.co.zw` → System Admin
- `rutendo.chikafu@absolutequalityicecream.co.zw` → Procurement Officer
- `simbarashe.ncube@absolutequalityicecream.co.zw` → Store Keeper
- `nyasha.dube@absolutequalityicecream.co.zw` → Production Manager
- `tinashe.chari@absolutequalityicecream.co.zw` → Production Worker
- `rumbidzai.mlambo@absolutequalityicecream.co.zw` → Sales Rep
- `tapiwa.zhou@absolutequalityicecream.co.zw` → Branch Manager
- `farai.muchengeti@absolutequalityicecream.co.zw` → Accountant

Use Clerk sign-in/sign-up flows to authenticate these users in your environment.

## Module Guide
- Dashboard: role-based operational KPIs and trend widgets
- Procurement: suppliers, requisitions, purchase orders, GRNs, supplier returns
- Inventory: items, balances, movements, transfers, low-stock and expiry visibility
- Production: recipes, plans, batches, quality checkpoints (backend/domain ready)
- Branch Operations: branch sales, stock visibility, shift close workflows
- Sales & Distribution: customers, quotations, sales orders, invoices, payments
- Reports: dynamic filterable reports with chart/table views and CSV/PDF export
- Settings: company profile, user/role/permission management, audit logs, notification settings

## API Documentation
API is organized by module under `apps/api/src/modules` and mounted under `/api/*`.
Key route groups:
- `/api/auth`
- `/api/procurement`
- `/api/suppliers`
- `/api/inventory`
- `/api/branch-operations`
- `/api/branches`
- `/api/sales`
- `/api/reports`
- `/api/settings`
- `/api/notifications`

Authentication uses Clerk JWT/session context and permission checks (`requirePermission`) per route.

## Deployment
- Build all workspaces:
```bash
npm run build
```
- Provide production environment variables for API, Web, Clerk, Supabase, DB, and Redis.
- Run Prisma migrations against production DB before starting services.
- Ensure Redis is reachable for background jobs (PDF generation and scheduled jobs).
- Deploy `apps/web` and `apps/api` as separate services or in a monorepo-aware platform.
