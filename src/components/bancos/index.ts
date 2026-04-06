// ─── Bancos Components Barrel Export ────────────────────────────────────────

export { default as BancoCard } from './BancoCard';
export {
  BancoFormModal,
  ModalPagoProveedor,
  ModalTransferencia,
  ModalEliminarFondo,
  ModalRegistrarEgreso,
} from './modals';

// Re-export types
export type { Banco, Fondo, FormState, Moneda, TipoCuenta } from './types';

// Re-export utilities
export {
  normalizeTipo,
  formatSwift,
  formatAba,
  parseAba,
  formatNumeroCuenta,
  preserveBancosOrder,
  resolveTipoMoneda,
  inferBancoMoneda,
  toNum,
  getBancoChannels,
} from './utils';
