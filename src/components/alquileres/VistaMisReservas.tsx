import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ModalReportarPagoAlquiler from './ModalReportarPagoAlquiler';
import ModalVerificarPagoAlquiler from './ModalVerificarPagoAlquiler';

type EstadoReserva = 'Pendiente' | 'Rechazada' | 'Aprobada' | 'Pago_Reportado' | 'Confirmada' | string;

interface MisReserva {
  id: number;
  amenidad_nombre: string;
  condominio_id?: number;
  fecha_reserva: string;
  monto_total_usd: number | string;
  monto_pagado_usd?: number | string | null;
  deposito_usd?: number | string;
  monto_bs_pagado?: number | string | null;
  tasa_cambio?: number | string | null;
  referencia?: string | null;
  comprobante_url?: string | null;
  banco_destino_nombre?: string | null;
  estado: EstadoReserva;
}

interface MisReservasResponse {
  status: 'success' | 'error';
  data?: MisReserva[];
  message?: string;
}

const normalizeEstado = (estado: string): string => estado.trim().toUpperCase();

const formatDateVe = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatUsd = (value: string | number): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const badgeClassByEstado = (estado: EstadoReserva): string => {
  const normalized = normalizeEstado(String(estado));
  if (normalized === 'PENDIENTE') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (normalized === 'RECHAZADA') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  if (normalized === 'APROBADA') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  if (normalized === 'PAGO_PARCIAL') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  if (normalized === 'PAGO_REPORTADO') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
  if (normalized === 'CONFIRMADA') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const labelEstado = (estado: EstadoReserva): string => {
  const normalized = normalizeEstado(String(estado));
  if (normalized === 'PAGO_REPORTADO') return 'PAGO REPORTADO';
  if (normalized === 'PAGO_PARCIAL') return 'PAGO PARCIAL';
  return normalized;
};

const VistaMisReservas: FC = () => {
  const [misReservas, setMisReservas] = useState<MisReserva[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [reservaAPagar, setReservaAPagar] = useState<MisReserva | null>(null);
  const [reservaDetalle, setReservaDetalle] = useState<MisReserva | null>(null);

  const fetchMisReservas = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres/mis-reservas`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = (await response.json()) as MisReservasResponse;
      if (!response.ok || result.status !== 'success') {
        setMisReservas([]);
        setError(result.message || 'No se pudieron cargar tus reservas.');
        return;
      }

      setMisReservas(Array.isArray(result.data) ? result.data : []);
    } catch {
      setMisReservas([]);
      setError('Error de conexión al cargar tus reservas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMisReservas();
  }, [fetchMisReservas]);

  const hasData = useMemo<boolean>(() => misReservas.length > 0, [misReservas.length]);

  return (
    <section className="space-y-4">
      {isLoading && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <Loader2 size={16} className="animate-spin" />
            Cargando tus reservas...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isLoading && !error && !hasData && (
        <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10 p-8 text-center">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Aún no has realizado ninguna solicitud de alquiler.
          </p>
        </div>
      )}

      {!isLoading && !error && hasData && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark shadow-sm overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-3 font-black">Estado</th>
                  <th className="p-3 font-black">Lugar</th>
                  <th className="p-3 font-black">Fecha Alquiler</th>
                  <th className="p-3 font-black text-right">Monto (USD)</th>
                  <th className="p-3 font-black text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {misReservas.map((reserva) => {
                  const normalized = normalizeEstado(String(reserva.estado));
                  const canReport = normalized === 'APROBADA' || normalized === 'PAGO_PARCIAL';
                  const canSeeDetails = normalized === 'PAGO_REPORTADO' || normalized === 'CONFIRMADA' || normalized === 'RECHAZADA';
                  const pagadoUsd = Number(reserva.monto_pagado_usd) || 0;
                  const totalUsd = Number(reserva.monto_total_usd) || 0;
                  const restanteUsd = Math.max(0, totalUsd - pagadoUsd);

                  return (
                    <tr
                      key={reserva.id}
                      className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                    >
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badgeClassByEstado(reserva.estado)}`}>
                          {labelEstado(reserva.estado)}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-semibold text-gray-800 dark:text-gray-200">{reserva.amenidad_nombre}</td>
                      <td className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{formatDateVe(reserva.fecha_reserva)}</td>
                      <td className="p-3 text-right text-sm font-black text-gray-900 dark:text-white">
                        <div>${formatUsd(pagadoUsd)} / ${formatUsd(totalUsd)} USD</div>
                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                          Resta: ${formatUsd(restanteUsd)} USD
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {canReport ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => setReservaAPagar(reserva)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                            >
                              Reportar Pago
                            </button>
                          </div>
                        ) : canSeeDetails ? (
                          <button
                            type="button"
                            onClick={() => setReservaDetalle(reserva)}
                            className="rounded-lg bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                          >
                            Detalles pago
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalReportarPagoAlquiler
        isOpen={Boolean(reservaAPagar)}
        onClose={() => setReservaAPagar(null)}
        reservacion={reservaAPagar}
        onSuccess={() => {
          setReservaAPagar(null);
          void fetchMisReservas();
        }}
      />

      <ModalVerificarPagoAlquiler
        isOpen={Boolean(reservaDetalle)}
        onClose={() => setReservaDetalle(null)}
        readOnly
        solicitud={
          reservaDetalle
            ? {
                id: reservaDetalle.id,
                lugar: reservaDetalle.amenidad_nombre,
                fecha_alquiler: reservaDetalle.fecha_reserva,
                monto_total_usd: reservaDetalle.monto_total_usd,
                monto_bs_pagado: reservaDetalle.monto_bs_pagado || 0,
                tasa_cambio: reservaDetalle.tasa_cambio || 0,
                referencia: reservaDetalle.referencia || '',
                comprobante_url: reservaDetalle.comprobante_url || null,
                banco_destino_nombre: reservaDetalle.banco_destino_nombre || null,
              }
            : null
        }
        onSuccess={() => {
          setReservaDetalle(null);
          void fetchMisReservas();
        }}
      />
    </section>
  );
};

export default VistaMisReservas;
