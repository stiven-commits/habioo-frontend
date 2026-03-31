import type { FC } from 'react';
import ModalBase from '../ui/ModalBase';

export interface IMovimientoDetalle {
  id: string | number;
  fecha: string;
  fecha_registro?: string;
  referencia: string;
  concepto: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto_bs: string | number;
  tasa_cambio: string | number;
  monto_usd: string | number;
  banco_origen?: string;
  cedula_origen?: string;
}

interface ModalDetalleMovimientoProps {
  movimiento: IMovimientoDetalle;
  isCuentaUsd: boolean;
  onClose: () => void;
  formatCurrency: (value: string | number | undefined | null) => string;
  formatFecha: (dateString?: string) => string;
}

const ModalDetalleMovimiento: FC<ModalDetalleMovimientoProps> = ({
  movimiento,
  isCuentaUsd,
  onClose,
  formatCurrency,
  formatFecha
}) => {
  const bancoOrigen = movimiento.banco_origen?.trim() || '-';
  const cedulaOrigen = movimiento.cedula_origen?.trim() || '-';

  return (
    <ModalBase onClose={onClose} title="Detalle del movimiento" maxWidth="max-w-xl">
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><span className="font-bold text-gray-600 dark:text-gray-300">ID:</span> <span className="text-gray-800 dark:text-gray-100">{String(movimiento.id)}</span></div>
          <div><span className="font-bold text-gray-600 dark:text-gray-300">Tipo:</span> <span className={movimiento.tipo === 'EGRESO' ? 'font-bold text-red-600 dark:text-red-400' : 'font-bold text-emerald-600 dark:text-emerald-400'}>{movimiento.tipo}</span></div>
          <div><span className="font-bold text-gray-600 dark:text-gray-300">Fecha:</span> <span className="text-gray-800 dark:text-gray-100">{formatFecha(movimiento.fecha)}</span></div>
          <div><span className="font-bold text-gray-600 dark:text-gray-300">Referencia:</span> <span className="text-gray-800 dark:text-gray-100">{movimiento.referencia || '-'}</span></div>
          <div className="md:col-span-2"><span className="font-bold text-gray-600 dark:text-gray-300">Concepto:</span> <span className="text-gray-800 dark:text-gray-100">{movimiento.concepto}</span></div>
          <div><span className="font-bold text-gray-600 dark:text-gray-300">Monto Bs:</span> <span className="text-gray-800 dark:text-gray-100">{toNumber(movimiento.monto_bs) > 0 ? `Bs ${formatCurrency(movimiento.monto_bs)}` : 'N/A'}</span></div>
          {!isCuentaUsd && <div><span className="font-bold text-gray-600 dark:text-gray-300">Tasa:</span> <span className="text-gray-800 dark:text-gray-100">{movimiento.tasa_cambio ? formatCurrency(movimiento.tasa_cambio) : '-'}</span></div>}
          <div><span className="font-bold text-gray-600 dark:text-gray-300">Monto USD:</span> <span className="text-gray-800 dark:text-gray-100">${formatCurrency(movimiento.monto_usd)}</span></div>
          <div className="md:col-span-2"><span className="font-bold text-gray-600 dark:text-gray-300">Banco origen:</span> <span className="text-gray-800 dark:text-gray-100">{bancoOrigen}</span></div>
          <div className="md:col-span-2"><span className="font-bold text-gray-600 dark:text-gray-300">Cédula/RIF origen:</span> <span className="text-gray-800 dark:text-gray-100">{cedulaOrigen}</span></div>
      </div>
    </ModalBase>
  );
};

const toNumber = (value: string | number | undefined | null): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default ModalDetalleMovimiento;
