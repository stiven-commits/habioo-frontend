const VE_LOCALE = 'es-VE';
const VE_TIMEZONE = 'America/Caracas';

const ISO_LIKE_WITHOUT_TZ = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const ISO_WITH_EXPLICIT_TZ = /([zZ]|[+\-]\d{2}(:?\d{2})?)$/;

const normalizeDateInput = (value: string): string => {
  const raw = value.trim();
  if (raw.length === 0) return raw;
  if (ISO_LIKE_WITHOUT_TZ.test(raw) && !ISO_WITH_EXPLICIT_TZ.test(raw)) {
    const isoCore = raw.replace(' ', 'T');
    return `${isoCore}Z`;
  }
  return raw;
};

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (!value) return null;
  const parsedValue = typeof value === 'string' ? normalizeDateInput(value) : value;
  const date = parsedValue instanceof Date ? parsedValue : new Date(parsedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseDateVE = (value: string | number | Date | null | undefined): Date | null => {
  return toDate(value);
};

export const toYmdVE = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
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
