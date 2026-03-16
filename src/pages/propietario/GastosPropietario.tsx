import { useEffect, useMemo, useState } from 'react';
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

interface GastoPropietario {
  id: number;
  concepto: string;
  monto_bs: string | number;
  monto_usd: string | number;
  total_cuotas: number;
  fecha_gasto: string;
  nota?: string | null;
  clasificacion?: string | null;
}

interface GastosResponse {
  status: 'success' | 'error';
  data?: GastoPropietario[];
}

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const GastosPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [gastos, setGastos] = useState<GastoPropietario[]>([]);

  useEffect(() => {
    const fetchGastos = async (): Promise<void> => {
      if (!propiedadActiva?.id_condominio) {
        setGastos([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/gastos/${propiedadActiva.id_condominio}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: GastosResponse = (await res.json()) as GastosResponse;
        if (!res.ok || data.status !== 'success') {
          setGastos([]);
          return;
        }
        setGastos(Array.isArray(data.data) ? data.data : []);
      } catch {
        setGastos([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchGastos();
  }, [propiedadActiva?.id_condominio]);

  const totalUsd = useMemo(() => gastos.reduce((acc, item) => acc + toNumber(item.monto_usd), 0), [gastos]);

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">Cartelera de Gastos</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {propiedadActiva ? `${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}` : 'Selecciona un inmueble.'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando gastos...</p>
        ) : gastos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay gastos comunes para este condominio.</p>
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Total: ${formatMoney(totalUsd)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="p-3 font-bold">Fecha</th>
                    <th className="p-3 font-bold">Concepto</th>
                    <th className="p-3 font-bold">Etiqueta</th>
                    <th className="p-3 text-right font-bold">Monto ($)</th>
                    <th className="p-3 text-right font-bold">Monto (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="border-b border-gray-50 dark:border-gray-800/70">
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-300">{String(gasto.fecha_gasto).slice(0, 10)}</td>
                      <td className="p-3">
                        <p className="font-bold text-gray-800 dark:text-gray-200">{gasto.concepto}</p>
                        {gasto.nota ? <p className="text-xs text-gray-500 dark:text-gray-400">{gasto.nota}</p> : null}
                      </td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-300">{gasto.clasificacion || 'Variable'}</td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-gray-200">${formatMoney(toNumber(gasto.monto_usd))}</td>
                      <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-300">Bs {formatMoney(toNumber(gasto.monto_bs))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default GastosPropietario;

