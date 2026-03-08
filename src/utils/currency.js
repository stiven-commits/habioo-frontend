export const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  const text = String(value).trim();
  if (!text) return 0;

  // 1.234,56 -> 1234.56
  if (text.includes('.') && text.includes(',')) {
    const n = parseFloat(text.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  // 1234,56 -> 1234.56
  if (text.includes(',') && !text.includes('.')) {
    const n = parseFloat(text.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
};

export const formatMoney = (value, decimals = 2) =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));

