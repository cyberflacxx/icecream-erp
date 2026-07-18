"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
exports.isMissingColumnError = isMissingColumnError;
exports.isMissingTableError = isMissingTableError;
exports.isMissingRelationshipError = isMissingRelationshipError;
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String(error.message ?? '');
    }
    return '';
}
function isMissingColumnError(error, table, columnName) {
    const message = getErrorMessage(error);
    return (message.includes(`column ${table}.${columnName} does not exist`) ||
        message.includes(`Could not find the '${columnName}' column of '${table}' in the schema cache`));
}
function isMissingTableError(error, table, schema = 'icecream_erp') {
    const message = getErrorMessage(error);
    return (message.includes(`relation "${table}" does not exist`) ||
        message.includes(`Could not find the table '${schema}.${table}' in the schema cache`));
}
function isMissingRelationshipError(error, sourceTable, targetTable) {
    const message = getErrorMessage(error);
    if (!message.includes('Could not find a relationship between')) {
        return false;
    }
    if (!sourceTable && !targetTable)
        return true;
    const normalized = message.toLowerCase();
    return ((!sourceTable || normalized.includes(`'${sourceTable.toLowerCase()}'`)) &&
        (!targetTable || normalized.includes(`'${targetTable.toLowerCase()}'`)));
}
