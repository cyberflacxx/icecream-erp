import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { prisma } from '@absolute-ice-cream/database';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { financeController } from './finance.controller';

export const financeRouter = Router();

financeRouter.use(authenticateRequest);

async function checkNotPostedJournal(req: Request, res: Response, next: NextFunction) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    return next();
  }

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: {
      entryNumber: true,
      isPosted: true
    }
  });

  if (entry?.isPosted) {
    return res.status(403).json({
      error: `Journal entry ${entry.entryNumber} has been posted and cannot be modified. Create a reversal entry instead.`,
      code: 'POSTED_RECORD_LOCKED'
    });
  }

  return next();
}

financeRouter.get('/dashboard', requirePermission('finance.read'), financeController.getDashboard);
financeRouter.get('/journal-entries', requirePermission('finance.read'), financeController.listJournalEntries);
financeRouter.post('/journal-entries', requirePermission('finance.manage'), financeController.createJournalEntry);
financeRouter.get('/journal-entries/:id', requirePermission('finance.read'), financeController.getJournalEntry);
financeRouter.patch(
  '/journal-entries/:id',
  requirePermission('finance.manage'),
  checkNotPostedJournal,
  financeController.updateJournalEntry,
);
financeRouter.delete(
  '/journal-entries/:id',
  requirePermission('finance.manage'),
  checkNotPostedJournal,
  financeController.deleteJournalEntry,
);
financeRouter.post(
  '/journal-entries/:id/post',
  requirePermission('finance.manage'),
  financeController.postJournalEntry,
);
