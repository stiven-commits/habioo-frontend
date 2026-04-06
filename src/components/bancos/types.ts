// ─── Shared Type Definitions for Bancos Module ──────────────────────────────

export type Moneda = 'BS' | 'USD';

export type TipoCuenta =
  | 'Transferencia'
  | 'Deposito'
  | 'Pago Movil'
  | 'Zelle'
  | 'Transferencia Internacional'
  | 'Efectivo BS'
  | 'Efectivo USD'
  | 'Efectivo';

export interface Banco {
  id: number;
  es_predeterminada?: boolean;
  nombre_banco: string;
  apodo: string;
  tipo: TipoCuenta | string;
  moneda?: string;
  swift?: string;
  aba?: string;
  nombre_titular: string;
  cedula_rif?: string;
  numero_cuenta?: string;
  telefono?: string;
  acepta_transferencia?: boolean;
  acepta_pago_movil?: boolean;
  pago_movil_telefono?: string;
  pago_movil_cedula_rif?: string;
  saldo_actual?: string | number;
  saldo_total?: string | number;
  saldo?: string | number;
}

export interface Fondo {
  id: number | string;
  cuenta_bancaria_id: number | string;
  nombre: string;
  moneda: string;
  saldo_actual: string | number;
  es_operativo?: boolean;
  porcentaje_asignacion?: string | number;
}

export interface FormState {
  tipo: TipoCuenta | string;
  moneda: Moneda;
  nombre_banco: string;
  apodo: string;
  nombre_titular: string;
  cedula_rif: string;
  numero_cuenta: string;
  telefono: string;
  acepta_transferencia: boolean;
  acepta_pago_movil: boolean;
  pago_movil_telefono: string;
  pago_movil_cedula_rif: string;
  swift: string;
  aba: string;
}
