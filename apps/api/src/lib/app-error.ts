export { AppError, NotFoundError, ValidationError } from '../utils/errors';

import { AppError } from '../utils/errors';

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
