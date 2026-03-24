import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ModalVerificarPagoAlquiler from './ModalVerificarPagoAlquiler';

type EstadoSolicitud = 'Pendiente' | 'Aprobada' | 'Pago_Reportado' | 'Confirmada' | 'Rechazada' | string;

interface SolicitudAlquiler {
  id: number;
  amenidad_nombre: string;
  inmueble_identificador?: string;
  propiedad_identificador?: string;
  fecha_reserva: string;
  monto_total_usd: string | number;
  monto_bs_pagado?: string | number;
  tasa_cambio?: string | number;
  referencia?: string;
  comprobante_url?: string | null;
  banco_destino_nombre?: string | null;
  estado: EstadoSolicitud;
}

interface SolicitudesResponse {
  status: 'success' | 'error';
  data?: SolicitudAlquiler[];
  message?: string;
}

interface UpdateEstadoResponse {
  status: 'success' | 'error';
  message?: string;
}

interface MenuAnchor {
  id: number;
  top: number;
  left: number;
}

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

const badgeClassByEstado = (estado: EstadoSolicitud): string => {
  if (estado === 'Pendiente') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (estado === 'Aprobada') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  if (estado === 'Pago_Reportado') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
  if (estado === 'Confirmada') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (estado === 'Rechazada') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const VistaSolicitudesAlquiler: FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudAlquiler[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [solicitudAVerificar, setSolicitudAVerificar] = useState<SolicitudAlquiler | null>(null);

  const fetchSolicitudes = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres/reservaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result: SolicitudesResponse = (await response.json()) as SolicitudesResponse;

      if (!response.ok || result.status !== 'success') {
        setSolicitudes([]);
        setError(result.message || 'No se pudieron cargar las solicitudes.');
        return;
      }

      setSolicitudes(Array.isArray(result.data) ? result.data : []);
    } catch {
      setSolicitudes([]);
      setError('Error de conexión al cargar las solicitudes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSolicitudes();
  }, [fetchSolicitudes]);

  const updateEstado = useCallback(async (id: number, estado: 'Aprobada' | 'Rechazada'): Promise<void> => {
    if (updatingId !== null) return;
    setUpdatingId(id);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres/reservaciones/${id}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado }),
      });
      const result: UpdateEstadoResponse = (await response.json()) as UpdateEstadoResponse;
      if (!response.ok || result.status !== 'success') {
        setError(result.message || `No se pudo actualizar el estado a ${estado}.`);
        return;
      }

      setSolicitudes((prev) => prev.map((item) => (item.id === id ? { ...item, estado } : item)));
      setMenuAnchor(null);
    } catch {
      setError('Error de conexión al actualizar el estado.');
    } finally {
      setUpdatingId(null);
    }
  }, [updatingId]);

  useEffect(() => {
    if (!menuAnchor) return;
    const handleGlobalClick = (): void => setMenuAnchor(null);
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuAnchor(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menuAnchor]);

  const hasPendientes = useMemo<boolean>(() => solicitudes.some((item) => item.estado === 'Pendiente'), [solicitudes]);

  return (
    <section className="space-y-4">
      {isLoading && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <Loader2 size={16} className="animate-spin" />
            Cargando solicitudes...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isLoading && !error && solicitudes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10 p-8 text-center">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">No hay solicitudes de alquiler pendientes.</p>
        </div>
      )}

      {!isLoading && !error && solicitudes.length > 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark shadow-sm overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-3 font-black">Estado</th>
                  <th className="p-3 font-black">Solicitante</th>
                  <th className="p-3 font-black">Lugar</th>
                  <th className="p-3 font-black">Fecha Alquiler</th>
                  <th className="p-3 font-black text-right">Monto (USD)</th>
                  <th className="p-3 font-black text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((item) => {
                  const inmueble = item.propiedad_identificador || item.inmueble_identificador || 'Sin inmueble';
                  const isRowUpdating = updatingId === item.id;
                  const estadoNormalizado = String(item.estado || '').trim().toUpperCase();
                  return (
                    <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badgeClassByEstado(item.estado)}`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-bold text-gray-800 dark:text-gray-200">{inmueble}</td>
                      <td className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{item.amenidad_nombre}</td>
                      <td className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{formatDateVe(item.fecha_reserva)}</td>
                      <td className="p-3 text-right text-sm font-black text-gray-900 dark:text-white">${formatUsd(item.monto_total_usd)}</td>
                      <td className="p-3 text-center">
                        {estadoNormalizado === 'PENDIENTE' ? (
                          <div className="inline-flex justify-center">
                            <button
                              type="button"
                              disabled={isRowUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setMenuAnchor((prev) =>
                                  prev?.id === item.id
                                    ? null
                                    : {
                                        id: item.id,
                                        top: rect.bottom + 6,
                                        left: rect.right - 150,
                                      }
                                );
                              }}
                              className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-60"
                            >
                              {isRowUpdating ? 'Actualizando...' : 'Opciones'}
                            </button>
                          </div>
                        ) : estadoNormalizado === 'PAGO_REPORTADO' ? (
                          <button
                            type="button"
                            onClick={() => setSolicitudAVerificar(item)}
                            className="rounded-lg bg-violet-100 dark:bg-violet-900/30 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                          >
                            Verificar Pago
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

          {!hasPendientes && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No hay solicitudes de alquiler pendientes.</p>
            </div>
          )}
        </div>
      )}

      {menuAnchor &&
        createPortal(
          <div
            className="fixed z-[140] min-w-[150px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
            style={{ top: menuAnchor.top, left: menuAnchor.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                void updateEstado(menuAnchor.id, 'Aprobada');
              }}
              className="w-full px-3 py-2 text-left text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => {
                void updateEstado(menuAnchor.id, 'Rechazada');
              }}
              className="w-full px-3 py-2 text-left text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              Negar
            </button>
          </div>,
          document.body
        )}

      <ModalVerificarPagoAlquiler
        isOpen={Boolean(solicitudAVerificar)}
        onClose={() => setSolicitudAVerificar(null)}
        solicitud={
          solicitudAVerificar
            ? {
                id: solicitudAVerificar.id,
                lugar: solicitudAVerificar.amenidad_nombre,
                fecha_alquiler: solicitudAVerificar.fecha_reserva,
                monto_total_usd: solicitudAVerificar.monto_total_usd,
                monto_bs_pagado: solicitudAVerificar.monto_bs_pagado || 0,
                tasa_cambio: solicitudAVerificar.tasa_cambio || 0,
                referencia: solicitudAVerificar.referencia || '',
                comprobante_url: solicitudAVerificar.comprobante_url || null,
                banco_destino_nombre: solicitudAVerificar.banco_destino_nombre || null,
              }
            : null
        }
        onSuccess={() => {
          setSolicitudAVerificar(null);
          void fetchSolicitudes();
        }}
      />
    </section>
  );
};

export default VistaSolicitudesAlquiler;
