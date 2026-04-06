import React, { useCallback } from 'react';
import type { FC } from 'react';
import type { Banco, Fondo } from './types';
import { formatMoney } from '../../utils/currency';
import {
  formatAba,
  formatNumeroCuenta,
  inferBancoMoneda,
  getBancoChannels,
  toNum,
} from './utils';
import StatusBadge from '../ui/StatusBadge';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BancoCardProps {
  banco: Banco;
  fondos: Fondo[];
  onEdit: (banco: Banco) => void;
  onDelete: (id: number) => void;
  onOpenFondos: (banco: Banco) => void;
  onSetPredeterminada: (id: number) => void;
}

// ─── Subcomponent: Balance Display ──────────────────────────────────────────

interface SaldosDisplayProps {
  banco: Banco;
  fondos: Fondo[];
}

const SaldosDisplay: FC<SaldosDisplayProps> = React.memo(({ banco, fondos }) => {
  const fondosCuenta = fondos.filter(
    (f: Fondo) => f?.cuenta_bancaria_id === banco.id
  );

  // Group balances by currency
  const saldos = fondosCuenta.reduce<Record<string, number>>(
    (acc: Record<string, number>, f: Fondo) => {
      const moneda = f?.moneda || 'N/A';
      acc[moneda] = (acc[moneda] || 0) + toNum(f?.saldo_actual);
      return acc;
    },
    {}
  );

  // Calculate transit funds (real balance - virtual funds sum)
  const saldoCuentaReal = toNum(
    banco?.saldo_actual ?? banco?.saldo_total ?? banco?.saldo
  );
  const totalFondosCuenta = fondosCuenta.reduce(
    (acc: number, f: Fondo) => acc + toNum(f?.saldo_actual),
    0
  );
  const fondosTransito = saldoCuentaReal - totalFondosCuenta;
  const showFondosTransito = fondosTransito > 0;

  return (
    <div className="space-y-1.5">
      {Object.entries(saldos).length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center">
          Sin fondos registrados
        </p>
      ) : (
        Object.entries(saldos).map(([moneda, monto]: [string, number]) => (
          <div
            key={moneda}
            className="flex justify-between items-center gap-6 border-b border-gray-200 dark:border-gray-700/50 pb-1 last:border-0 last:pb-0"
          >
            <span className="text-xs font-bold text-gray-500">{moneda}</span>
            <span
              className={`font-black tracking-tight ${
                moneda === 'USD' || moneda === 'EUR'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-800 dark:text-white'
              }`}
            >
              {formatMoney(monto)}
            </span>
          </div>
        ))
      )}
      {showFondosTransito && (
        <div className="flex justify-between items-center gap-6 mt-2 px-2 py-2 rounded-lg border border-dashed border-yellow-500/50 bg-yellow-50/60 dark:bg-yellow-900/10">
          <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
            Fondos en Transito / Gastos Extra
          </span>
          <span className="font-black tracking-tight text-yellow-700 dark:text-yellow-300">
            {formatMoney(fondosTransito)}
          </span>
        </div>
      )}
    </div>
  );
});

SaldosDisplay.displayName = 'SaldosDisplay';

// ─── Subcomponent: Channel Badges ───────────────────────────────────────────

interface ChannelBadgesProps {
  channels: string[];
  tipo: string;
}

const ChannelBadges: FC<ChannelBadgesProps> = React.memo(({ channels, tipo }) => (
  <>
    {channels.includes('TRANSFERENCIA') && (
      <StatusBadge color="indigo" shape="tag" size="md" border className="shadow-sm">
        Transferencia
      </StatusBadge>
    )}
    {channels.includes('PAGO MOVIL') && (
      <StatusBadge color="emerald" shape="tag" size="md" border className="shadow-sm">
        Pago Móvil
      </StatusBadge>
    )}
    {tipo === 'Zelle' && (
      <StatusBadge color="blue" shape="tag" size="md" border className="shadow-sm">
        Zelle
      </StatusBadge>
    )}
    {tipo === 'Transferencia Internacional' && (
      <StatusBadge color="blue" shape="tag" size="md" border className="shadow-sm">
        Wire Transfer
      </StatusBadge>
    )}
  </>
));

ChannelBadges.displayName = 'ChannelBadges';

// ─── Main Component ─────────────────────────────────────────────────────────

const BancoCard: FC<BancoCardProps> = React.memo(({
  banco,
  fondos,
  onEdit,
  onDelete,
  onOpenFondos,
  onSetPredeterminada,
}) => {
  const channels = getBancoChannels(banco);
  const moneda = inferBancoMoneda(banco);
  const isPredeterminada = banco.es_predeterminada === true;

  const handleEdit = useCallback(() => onEdit(banco), [onEdit, banco]);
  const handleDelete = useCallback(() => onDelete(banco.id), [onDelete, banco.id]);
  const handleOpenFondos = useCallback(() => onOpenFondos(banco), [onOpenFondos, banco]);
  const handleSetPredeterminada = useCallback(
    () => onSetPredeterminada(banco.id),
    [onSetPredeterminada, banco.id]
  );

  return (
    <div
      className={`bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-6 justify-between xl:items-center transition-all ${
        isPredeterminada
          ? 'border-green-400 dark:border-green-600 bg-green-50/10'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Banco Info */}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
            {banco.nombre_banco || 'Efectivo'}
          </h3>

          <ChannelBadges channels={channels} tipo={banco.tipo} />

          <StatusBadge color="gray" shape="tag" size="md">
            {banco.apodo}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong className="text-gray-800 dark:text-gray-300 font-medium">
              Titular/Custodio:
            </strong>{' '}
            {banco.nombre_titular}
          </p>
          {banco.cedula_rif && (
            <p>
              <strong className="text-gray-800 dark:text-gray-300 font-medium">
                CI/RIF:
              </strong>{' '}
              {banco.cedula_rif}
            </p>
          )}
          {banco.numero_cuenta && (
            <p>
              <strong className="text-gray-800 dark:text-gray-300 font-medium">
                {banco.tipo === 'Zelle' ? 'Correo:' : 'N Cuenta:'}
              </strong>{' '}
              {banco.tipo === 'Zelle'
                ? banco.numero_cuenta
                : formatNumeroCuenta(banco.numero_cuenta)}
            </p>
          )}
          {banco.tipo === 'Transferencia Internacional' && banco.swift && (
            <p>
              <strong className="text-gray-800 dark:text-gray-300 font-medium">
                SWIFT/BIC:
              </strong>{' '}
              <span className="font-mono tracking-widest">{banco.swift}</span>
            </p>
          )}
          {banco.tipo === 'Transferencia Internacional' && banco.aba && (
            <p>
              <strong className="text-gray-800 dark:text-gray-300 font-medium">
                ABA:
              </strong>{' '}
              <span className="font-mono tracking-widest">
                {formatAba(String(banco.aba))}
              </span>
            </p>
          )}
          {banco.telefono && (
            <p>
              <strong className="text-gray-800 dark:text-gray-300 font-medium">
                Telefono:
              </strong>{' '}
              {banco.telefono}
            </p>
          )}
          {(banco.acepta_pago_movil || banco.tipo === 'Pago Movil') &&
            banco.pago_movil_telefono && (
              <p>
                <strong className="text-gray-800 dark:text-gray-300 font-medium">
                  Tel. Pago Móvil:
                </strong>{' '}
                {banco.pago_movil_telefono}
              </p>
            )}
        </div>
      </div>

      {/* Balances */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-w-[240px] border border-gray-100 dark:border-gray-700/50">
        <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3 flex items-center justify-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5 text-donezo-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          Saldos Virtuales
        </p>
        <SaldosDisplay banco={banco} fondos={fondos} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 min-w-[220px]">
        <button
          onClick={handleOpenFondos}
          className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 text-[11px] uppercase tracking-wide font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Gestionar Fondos
        </button>
        <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <button
            onClick={handleEdit}
            className="flex-1 text-[11px] text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 px-3 py-2.5 transition-colors border-r border-gray-200 dark:border-gray-700"
          >
            Editar
          </button>
          {isPredeterminada ? (
            <div className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[11px] font-bold px-3 py-2.5 cursor-default border-r border-gray-200 dark:border-gray-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Principal {moneda}
            </div>
          ) : (
            <button
              onClick={handleSetPredeterminada}
              className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 font-bold bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-3 py-2.5 transition-colors border-r border-gray-200 dark:border-gray-700"
            >
              Hacer Principal {moneda}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center justify-center px-4 py-2 bg-gray-50 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-sm transition-colors"
            title="Eliminar cuenta"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
});

BancoCard.displayName = 'BancoCard';

export default BancoCard;
