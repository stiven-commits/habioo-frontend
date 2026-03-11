export const sanitizeCedulaRif = (value, options = {}) => {
  const { withDash = false, maxDigits = 9 } = options;
  const raw = String(value || '').toUpperCase().replace(/[^VEJG0-9]/g, '');
  if (!raw) return '';

  const prefix = raw.charAt(0);
  if (!['V', 'E', 'J', 'G'].includes(prefix)) return '';

  const digits = raw.slice(1).replace(/\D/g, '').slice(0, maxDigits);
  return withDash ? `${prefix}-${digits}` : `${prefix}${digits}`;
};

export const isValidCedulaRif = (value) => {
  const normalized = String(value || '').toUpperCase().replace(/[^VEJG0-9]/g, '');
  return /^[VEJG][0-9]{5,9}$/.test(normalized);
};

export const sanitizePhone = (value, maxLen = 15) => {
  return String(value || '').replace(/\D/g, '').slice(0, maxLen);
};

export const isValidPhone = (value, minLen = 7, maxLen = 15) => {
  const digits = sanitizePhone(value, maxLen);
  return digits.length >= minLen && digits.length <= maxLen;
};

export const sanitizeEmail = (value) => {
  return String(value || '').trim().toLowerCase();
};

export const isValidEmail = (value) => {
  const email = sanitizeEmail(value);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
