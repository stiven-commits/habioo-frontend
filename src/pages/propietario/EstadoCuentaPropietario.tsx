import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';

interface PropiedadActiva {
  id_condominio: number;
  identificador: string;
  nombre_condominio: string;
}

interface OutletContextType {
  userRole?: string;
  propiedadActiva?: PropiedadActiva | null;
}

interface MovimientoRow {
  id: number;
  fecha: string;
  tipo: string;
  monto: string | number;
  nota?: string | null;
  fondo_nombre: string;
  fondo_moneda?: string | null;
  banco_nombre?: string | null;
  banco_apodo?: string | null;
}

interface EstadoCuentaResponse {
  status: 'success' | 'error';
  data?: MovimientoRow[];
}

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const EstadoCuentaPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);

  useEffect(() => {
    const fetchEstado = async (): Promise<void> => {
      if (!propiedadActiva?.id_condominio) {
        setMovimientos([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/estado-cuenta/${propiedadActiva.id_condominio}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: EstadoCuentaResponse = (await res.json()) as EstadoCuentaResponse;
        if (!res.ok || data.status !== 'success') {
          setMovimientos([]);
          return;
        }
        setMovimientos(Array.isArray(data.data) ? data.data : []);
      } catch {
        setMovimientos([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchEstado();
  }, [propiedadActiva?.id_condominio]);

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">Estado de Cuenta Edificio</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {propiedadActiva ? `${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}` : 'Selecciona un inmueble.'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando estado de cuenta...</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay movimientos disponibles para este condominio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="p-3 font-bold">Fecha</th>
                  <th className="p-3 font-bold">Tipo</th>
                  <th className="p-3 font-bold">Fondo / Banco</th>
                  <th className="p-3 text-right font-bold">Monto</th>
                  <th className="p-3 font-bold">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="border-b border-gray-50 dark:border-gray-800/70">
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-300">{String(mov.fecha).slice(0, 10)}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                      <p className="font-semibold">{mov.fondo_nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{mov.banco_nombre || mov.banco_apodo || 'Sin banco'}</p>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-800 dark:text-gray-200">
                      {mov.fondo_moneda?.toUpperCase() === 'BS' ? 'Bs ' : '$ '}
                      {formatMoney(toNumber(mov.monto))}
                    </td>
                    <td className="p-3 text-sm text-gray-500 dark:text-gray-400">{mov.nota || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default EstadoCuentaPropietario;

