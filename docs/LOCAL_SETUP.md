# Local Development Setup (MySQL)

## 1. Prerequisites
- Node.js 20+
- MySQL 8+
- Redis (optional for queue workflows)

## 2. Create MySQL database
```sql
CREATE DATABASE IF NOT EXISTS absolute_ice_cream_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'aqi_user'@'localhost' IDENTIFIED BY 'AqiLocal@2026!';
GRANT ALL PRIVILEGES ON absolute_ice_cream_erp.* TO 'aqi_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Environment
Create `.env.local` with:
```env
DB_PROVIDER=mysql
DATABASE_URL=mysql://aqi_user:AqiLocal@2026!@127.0.0.1:3306/absolute_ice_cream_erp
NODE_ENV=development
API_PORT=4001
NEXT_PUBLIC_API_URL=http://localhost:4001
```

## 4. Prisma (MySQL)
```bash
npm run -w packages/database db:generate:mysql
npm run -w packages/database db:push:mysql
npm run -w packages/database db:seed:mysql
```

## 5. Run apps
```bash
npm run -w apps/api dev
npm run -w apps/web dev
```