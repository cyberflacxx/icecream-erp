function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return getErrorMessage(error).includes(`column ${table}.${columnName} does not exist`);
}
