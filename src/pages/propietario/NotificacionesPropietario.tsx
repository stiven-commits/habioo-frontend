import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';
import StatusBadge from '../../components/ui/StatusBadge';

interface PropiedadActiva {
  id_propiedad: number;
}

interface OutletContextType {
  userRole?: string;
  propiedadActiva?: PropiedadActiva | null;
}

interface NotificacionPago {
  id: number;
  referencia: string | null;
  monto_origen: string | number;
  monto_usd: string | number;
  tasa_cambio: string | number | null;
  moneda: string | null;
  metodo: string | null;
  estado: string;
  fecha_pago: string | null;
  nota: string | null;
  identificador: string;
  nombre_condominio: string;
}

interface NotificacionesResponse {
  status: 'success' | 'error';
  data?: NotificacionPago[];
  message?: string;
}

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const NotificacionesPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [items, setItems] = useState<NotificacionPago[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!propiedadActiva?.id_propiedad) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/notificaciones?propiedad_id=${propiedadActiva.id_propiedad}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: NotificacionesResponse = (await res.json()) as NotificacionesResponse;
        if (!res.ok || data.status !== 'success') {
          setItems([]);
          return;
        }
        setItems(Array.isArray(data.data) ? data.data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [propiedadActiva?.id_propiedad]);

  if (userRole !== 'Propietario') {
    return <p className="p-6 text-gray-500 dark:text-gray-400">No tienes permisos para ver esta seccion.</p>;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Notificaciones generadas por el sistema.
        </p>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando notificaciones...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay notificaciones por ahora.</p>
          ) : (
            items.map((n) => {
              const moneda = String(n.moneda || 'USD').toUpperCase() === 'USD' ? 'USD' : 'BS';
              const montoUsd = toNumber(n.monto_usd);
              const montoOrigen = toNumber(n.monto_origen);
              const tasa = toNumber(n.tasa_cambio);
              const estado =
                n.estado === 'PendienteAprobacion'
                  ? 'En aprobacion'
                  : n.estado === 'Validado'
                    ? 'Aprobado'
                    : n.estado === 'Rechazado'
                      ? 'Rechazado'
                      : n.estado;
              const badgeColor = n.estado === 'Validado' ? 'emerald' : n.estado === 'Rechazado' ? 'red' : 'amber';

              return (
                <article key={n.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {n.identificador} | {n.nombre_condominio}
                    </p>
                    <StatusBadge color={badgeColor} size="md" className="font-black">{estado}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Pago #{n.id} {n.referencia ? `· Ref: ${n.referencia}` : ''}
                  </p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    Monto reportado: {moneda === 'USD' ? '$' : 'Bs '}{formatMoney(moneda === 'USD' ? montoUsd : montoOrigen)} ({moneda})
                  </p>
                  {moneda === 'BS' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tasa: {tasa > 0 ? formatMoney(tasa) : '-'} · Equivalente USD: ${formatMoney(montoUsd)}
                    </p>
                  )}
                  {n.metodo && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Metodo: {n.metodo}</p>
                  )}
                  {n.fecha_pago && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fecha reportada: {String(n.fecha_pago).slice(0, 10)}</p>
                  )}
                  {n.estado === 'Rechazado' && n.nota && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                      Motivo: {n.nota}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default NotificacionesPropietario;
