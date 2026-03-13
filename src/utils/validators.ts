interface SanitizeCedulaRifOptions {
  withDash?: boolean;
  maxDigits?: number;
}

export const sanitizeCedulaRif = (value: unknown, options: SanitizeCedulaRifOptions = {}): string => {
  const { withDash = false, maxDigits = 9 } = options;
  const raw = String(value || '').toUpperCase().replace(/[^VEJG0-9]/g, '');
  if (!raw) return '';

  const prefix = raw.charAt(0);
  if (!['V', 'E', 'J', 'G'].includes(prefix)) return '';

  const digits = raw.slice(1).replace(/\D/g, '').slice(0, maxDigits);
  return withDash ? `${prefix}-${digits}` : `${prefix}${digits}`;
};

export const isValidCedulaRif = (value: unknown): boolean => {
  const normalized = String(value || '').toUpperCase().replace(/[^VEJG0-9]/g, '');
  return /^[VEJG][0-9]{5,9}$/.test(normalized);
};

export const sanitizePhone = (value: unknown, maxLen = 15): string => {
  return String(value || '').replace(/\D/g, '').slice(0, maxLen);
};

export const isValidPhone = (value: unknown, minLen = 7, maxLen = 15): boolean => {
  const digits = sanitizePhone(value, maxLen);
  return digits.length >= minLen && digits.length <= maxLen;
};

export const sanitizeEmail = (value: unknown): string => {
  return String(value || '').trim().toLowerCase();
};

export const isValidEmail = (value: unknown): boolean => {
  const email = sanitizeEmail(value);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
