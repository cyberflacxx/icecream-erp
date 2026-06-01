import type { NextFunction, Request, Response } from 'express';

import { notificationIdParamsSchema, notificationsQuerySchema } from './notifications.schemas';
import { NotificationsService } from './notifications.service';

function getNotificationsContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    branchId: req.authContext.profile.branchId,
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const notificationsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getNotificationsContext(req);
      const query = notificationsQuerySchema.parse(req.query);
      const result = await NotificationsService.listNotifications(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  markAllRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getNotificationsContext(req);
      const result = await NotificationsService.markAllAsRead(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getNotificationsContext(req);
      const params = notificationIdParamsSchema.parse(req.params);
      const result = await NotificationsService.markAsRead(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  unreadCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getNotificationsContext(req);
      const result = await NotificationsService.getUnreadCount(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
