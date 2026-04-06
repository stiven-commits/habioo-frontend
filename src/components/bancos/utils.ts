import type { Banco, Moneda } from './types';

// ─── Utility Functions for Bancos Module ────────────────────────────────────

/**
 * Normalizes account type string for comparison (removes accents, lowercase)
 */
export const normalizeTipo = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Formats SWIFT/BIC code: uppercase, alphanumeric only, max 11 chars
 */
export const formatSwift = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

/**
 * Formats ABA routing number with dashes: XXX-XXX-XXX
 */
export const formatAba = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

/**
 * Parses formatted ABA number back to raw digits
 */
export const parseAba = (formatted: string): string => formatted.replace(/-/g, '');

/**
 * Formats account number with dashes every 4 digits
 */
export const formatNumeroCuenta = (value: string): string => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return value;
  return digits.match(/.{1,4}/g)?.join('-') || digits;
};

/**
 * Preserves banco array order based on previous state to prevent UI flickering
 */
export const preserveBancosOrder = (next: Banco[], prev: Banco[]): Banco[] => {
  if (prev.length === 0) return next;
  const prevIndexById = new Map<number, number>(
    prev.map((item, index) => [item.id, index])
  );
  return [...next].sort((a: Banco, b: Banco) => {
    const ai = prevIndexById.get(a.id);
    const bi = prevIndexById.get(b.id);
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
};

/**
 * Determines currency and block state based on account type
 */
export const resolveTipoMoneda = (
  tipo: string
): { moneda: Moneda | null; blocked: boolean } => {
  const normalized = normalizeTipo(tipo);

  const isInternational =
    normalized.includes('zelle') ||
    normalized.includes('panama') ||
    (normalized.includes('efectivo') && normalized.includes('usd')) ||
    normalized.includes('internacional') ||
    normalized.includes('usd') ||
    normalized === 'transferencia internacional';

  if (isInternational) {
    return { moneda: 'USD', blocked: true };
  }

  const isNational =
    normalized.includes('pago movil') ||
    normalized.includes('transferencia') ||
    normalized.includes('deposito') ||
    normalized.includes('nacional') ||
    normalized.includes('ves') ||
    (normalized.includes('bs') && !normalized.includes('usd'));

  if (isNational) {
    return { moneda: 'BS', blocked: true };
  }

  return { moneda: null, blocked: false };
};

/**
 * Infers currency (BS/USD) from banco properties
 */
export const inferBancoMoneda = (banco: Banco): Moneda => {
  const forced = resolveTipoMoneda(String(banco.tipo || '')).moneda;
  if (forced) return forced;

  const text = `${String(banco.apodo || '')} ${String(
    banco.nombre_banco || ''
  )} ${String(banco.tipo || '')}`.toUpperCase();

  return text.includes('USD') || text.includes('ZELLE') ? 'USD' : 'BS';
};

/**
 * Safely converts a value to a number, defaulting to 0
 */
export const toNum = (val: string | number | undefined): number => {
  const n = parseFloat(String(val ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Extracts unique payment channels from a banco
 */
export const getBancoChannels = (banco: Banco): string[] => {
  const channels = new Set<string>();
  if (banco.acepta_transferencia || banco.tipo === 'Transferencia')
    channels.add('TRANSFERENCIA');
  if (banco.acepta_pago_movil || banco.tipo === 'Pago Movil')
    channels.add('PAGO MOVIL');
  if (banco.tipo === 'Zelle') channels.add('ZELLE');
  if (
    banco.tipo === 'Efectivo BS' ||
    banco.tipo === 'Efectivo USD' ||
    banco.tipo === 'Efectivo'
  )
    channels.add(String(banco.tipo).toUpperCase());
  return Array.from(channels);
};
