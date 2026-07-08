const CAT_TIMEZONE = 'Africa/Harare';
const CAT_LOCALE = 'en-ZW';

function toDate(value: string | number | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCatDateTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = toDate(value);
  if (!date) return 'N/A';

  return `${new Intl.DateTimeFormat(CAT_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: CAT_TIMEZONE,
    ...options,
  }).format(date)} CAT`;
}

export function formatCatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = toDate(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(CAT_LOCALE, {
    dateStyle: 'medium',
    timeZone: CAT_TIMEZONE,
    ...options,
  }).format(date);
}

export { CAT_LOCALE, CAT_TIMEZONE };
