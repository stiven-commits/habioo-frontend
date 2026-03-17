const VE_LOCALE = 'es-VE';
const VE_TIMEZONE = 'America/Caracas';

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateVE = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString(VE_LOCALE, {
    timeZone: VE_TIMEZONE,
  });
};

export const formatDateTimeVE = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleString(VE_LOCALE, {
    timeZone: VE_TIMEZONE,
  });
};

