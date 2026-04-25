export const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((v) => Number(v));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatNumberInput = (value: string | number | undefined | null, maxDecimals = 2): string => {
  const strValue = String(value || '');
  const isNegative = strValue.trim().startsWith('-');
  let rawValue = strValue.replace(/[^0-9,]/g, '');
  if (isNegative && !rawValue) return '-';
  const parts = rawValue.split(',');
  if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;
  let [integerPart, decimalPart] = rawValue.split(',');
  if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = decimalPart !== undefined ? `${integerPart},${decimalPart.slice(0, maxDecimals)}` : (integerPart || '');
  if (!formatted) return '';
  return isNegative ? `-${formatted}` : formatted;
};

export const parseNumberInput = (value: string | number | undefined | null): number => {
  if (!value) return 0;
  return parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
};

