interface BcvRateItem {
  promedio?: number | string | null;
  fecha?: string | null;
}

const BCV_CURRENT_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const BCV_HISTORICAL_URL = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';

const parsePositiveRate = (value: unknown): number | null => {
  const parsed = parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const isValidYmd = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const extractPromedioFromUnknown = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') return null;
  const direct = parsePositiveRate((payload as { promedio?: unknown }).promedio);
  if (direct) return direct;
  const nestedData = (payload as { data?: unknown }).data;
  if (!nestedData || typeof nestedData !== 'object') return null;
  return parsePositiveRate((nestedData as { promedio?: unknown }).promedio);
};

export const getCurrentBcvRate = async (): Promise<number | null> => {
  try {
    const response = await fetch(BCV_CURRENT_URL);
    if (!response.ok) return null;
    const json = (await response.json()) as unknown;
    return extractPromedioFromUnknown(json);
  } catch {
    return null;
  }
};

export const getBcvRateByDate = async (dateYmd: string): Promise<number | null> => {
  const safeDate = String(dateYmd || '').trim();
  if (!isValidYmd(safeDate)) return null;
  try {
    const response = await fetch(BCV_HISTORICAL_URL);
    if (!response.ok) return null;
    const historicos = (await response.json()) as BcvRateItem[];
    if (!Array.isArray(historicos) || historicos.length === 0) return null;

    const targetDate = new Date(`${safeDate}T00:00:00`);
    const selected = historicos
      .filter((item) => item && typeof item.fecha === 'string' && String(item.fecha).trim().length > 0)
      .map((item) => ({
        ...item,
        _date: new Date(`${String(item.fecha).slice(0, 10)}T00:00:00`),
      }))
      .filter((item) => Number.isFinite(item._date.getTime()) && item._date.getTime() <= targetDate.getTime())
      .sort((a, b) => b._date.getTime() - a._date.getTime())[0];

    if (!selected) return null;
    return parsePositiveRate(selected.promedio);
  } catch {
    return null;
  }
};

export const getBcvRateForPaymentDate = async (dateYmd: string): Promise<number | null> => {
  const historical = await getBcvRateByDate(dateYmd);
  if (historical && historical > 0) return historical;
  return getCurrentBcvRate();
};

