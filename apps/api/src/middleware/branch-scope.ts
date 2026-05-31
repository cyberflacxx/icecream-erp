import type { NextFunction, Request, Response } from 'express';

function getBranchIdsFromRequest(req: Request) {
  const branchIds = new Set<string>();
  const candidates = [
    req.params.branchId,
    typeof req.query.branchId === 'string' ? req.query.branchId : undefined,
    typeof req.body?.branchId === 'string' ? req.body.branchId : undefined
  ];

  for (const value of candidates) {
    if (value) {
      branchIds.add(value);
    }
  }

  return [...branchIds];
}

export function enforceBranchScope(req: Request, res: Response, next: NextFunction) {
  const authContext = req.authContext;

  if (!authContext?.isBranchScoped || !authContext.profile.branchId) {
    return next();
  }

  const requestedBranchIds = getBranchIdsFromRequest(req);
  const hasOutOfScopeBranch = requestedBranchIds.some(
    (branchId) => branchId !== authContext.profile.branchId,
  );

  if (hasOutOfScopeBranch) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This role is limited to its assigned branch.'
    });
  }

  return next();
}
