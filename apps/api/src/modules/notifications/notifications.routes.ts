import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { notificationsController } from './notifications.controller';

export const notificationsRouter = Router();

notificationsRouter.use(authenticateRequest);

notificationsRouter.get('/', notificationsController.list);
notificationsRouter.post('/mark-all-read', notificationsController.markAllRead);
notificationsRouter.post('/:id/read', notificationsController.markRead);
