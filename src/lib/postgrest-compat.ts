export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

export function isMissingColumnError(error: unknown, table: string, columnName: string) {
  const message = getErrorMessage(error);
  return (
    message.includes(`column ${table}.${columnName} does not exist`) ||
    message.includes(`Could not find the '${columnName}' column of '${table}' in the schema cache`)
  );
}

export function isMissingTableError(error: unknown, table: string, schema = 'icecream_erp') {
  const message = getErrorMessage(error);
  return (
    message.includes(`relation "${table}" does not exist`) ||
    message.includes(`Could not find the table '${schema}.${table}' in the schema cache`)
  );
}

export function isMissingRelationshipError(error: unknown, sourceTable?: string, targetTable?: string) {
  const message = getErrorMessage(error);
  if (!message.includes('Could not find a relationship between')) {
    return false;
  }
  if (!sourceTable && !targetTable) return true;
  const normalized = message.toLowerCase();
  return (
    (!sourceTable || normalized.includes(`'${sourceTable.toLowerCase()}'`)) &&
    (!targetTable || normalized.includes(`'${targetTable.toLowerCase()}'`))
  );
}
