import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';

import { isAppError } from './lib/app-error';
import { branchOperationsRouter } from './modules/branch-operations/branch-operations.routes';
import { branchesRouter } from './modules/branches/branches.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { hrRouter } from './modules/hr/hr.routes';
import { maintenanceRouter } from './modules/maintenance/maintenance.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { productionRouter } from './modules/production/production.routes';
import { procurementRouter } from './modules/procurement/procurement.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';
import { authRouter } from './routes/auth';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buffer) => {
      (req as express.Request).rawBody = buffer.toString('utf8');
    }
  }),
);
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'absolute-ice-cream-api'
  });
});

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/procurement', procurementRouter);
app.use('/api/procurement/suppliers', suppliersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/hr', hrRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/production', productionRouter);
app.use('/api/finance', financeRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/branch-operations', branchOperationsRouter);

app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  if (error instanceof ZodError) {
    const fieldErrors = error.issues.reduce<Record<string, string>>((acc, issue) => {
      const path = issue.path.join('.');
      if (path && !acc[path]) {
        acc[path] = issue.message;
      }

      return acc;
    }, {});

    return res.status(400).json({
      error: 'Validation failed.',
      fieldErrors,
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  if (error.message.includes('Environment variable not found: DATABASE_URL')) {
    return res.status(503).json({
      error:
        'Database is not configured. Set DATABASE_URL in .env and restart the API.'
    });
  }

  const statusCode = isAppError(error)
    ? error.statusCode
    : error.message.toLowerCase().includes('unauthorized')
      ? 401
      : error.message.toLowerCase().includes('forbidden')
        ? 403
        : 500;

  res.status(statusCode).json({
    error: error.message || 'Internal Server Error',
    ...(isAppError(error) && error.code ? { code: error.code } : {})
  });
});
