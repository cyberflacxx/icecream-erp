import type { NextFunction, Request, Response } from 'express';

export function requirePermission(permission: string | string[]) {
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];

  return (req: Request, res: Response, next: NextFunction) => {
    const currentPermissions = req.authContext?.permissions ?? [];
    const isAllowed = requiredPermissions.some((item) => currentPermissions.includes(item));

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to perform this action.'
      });
    }

    return next();
  };
}
