import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';
import 'react-datepicker/dist/react-datepicker.css';

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

type SortColumn = 'fecha_gasto' | 'concepto' | 'clasificacion' | 'monto_usd' | 'monto_bs';
type SortDirection = 'asc' | 'desc';

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const getDateFromYmd = (ymd: string): Date | null => {
  const match = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const getGastoDate = (fechaGasto: string): Date | null => {
  const ymd = String(fechaGasto || '').slice(0, 10);
  const parsed = getDateFromYmd(ymd);
  if (parsed) return parsed;
  const fallback = new Date(fechaGasto);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const GastosPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [gastos, setGastos] = useState<GastoPropietario[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('fecha_gasto');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const toggleSort = (column: SortColumn): void => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const sortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const gastosFiltrados = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const desde = fechaDesde ? startOfDay(fechaDesde) : null;
    const hasta = fechaHasta ? endOfDay(fechaHasta) : null;

    const filtered = gastos.filter((gasto) => {
      const gastoDate = getGastoDate(gasto.fecha_gasto);
      if (desde && gastoDate && gastoDate < desde) return false;
      if (hasta && gastoDate && gastoDate > hasta) return false;
      if (!search) return true;
      return (
        String(gasto.concepto || '').toLowerCase().includes(search) ||
        String(gasto.nota || '').toLowerCase().includes(search) ||
        String(gasto.clasificacion || '').toLowerCase().includes(search)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'fecha_gasto') {
        cmp = String(a.fecha_gasto || '').localeCompare(String(b.fecha_gasto || ''));
      } else if (sortColumn === 'concepto') {
        cmp = String(a.concepto || '').localeCompare(String(b.concepto || ''), 'es', { sensitivity: 'base' });
      } else if (sortColumn === 'clasificacion') {
        cmp = String(a.clasificacion || '').localeCompare(String(b.clasificacion || ''), 'es', { sensitivity: 'base' });
      } else if (sortColumn === 'monto_usd') {
        cmp = toNumber(a.monto_usd) - toNumber(b.monto_usd);
      } else if (sortColumn === 'monto_bs') {
        cmp = toNumber(a.monto_bs) - toNumber(b.monto_bs);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [gastos, searchTerm, fechaDesde, fechaHasta, sortColumn, sortDirection]);

  const totalUsd = useMemo(
    () => gastosFiltrados.reduce((acc, item) => acc + toNumber(item.monto_usd), 0),
    [gastosFiltrados]
  );

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">Cartelera de Gastos</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {propiedadActiva ? `${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}` : 'Selecciona un inmueble.'}
        </p>
      </div>

      {!loading && gastos.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
          <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M10 2a8 8 0 1 1 5.293 14.002l4.352 4.353-1.414 1.414-4.353-4.352A8 8 0 0 1 10 2Zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 10 4Z" />
                </svg>
              </span>
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por concepto, nota o etiqueta..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pl-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="lg:col-span-2 flex flex-col xl:flex-row xl:items-center gap-2">
              <DatePicker
                selected={fechaDesde}
                onChange={(date: Date | Date[] | null) => setFechaDesde(Array.isArray(date) ? (date[0] ?? null) : date)}
                selectsStart
                startDate={fechaDesde}
                endDate={fechaHasta}
                {...(fechaHasta ? { maxDate: fechaHasta } : {})}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Desde (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <span className="hidden xl:inline text-sm text-gray-500 dark:text-gray-400 px-1">a</span>
              <DatePicker
                selected={fechaHasta}
                onChange={(date: Date | Date[] | null) => setFechaHasta(Array.isArray(date) ? (date[0] ?? null) : date)}
                selectsEnd
                startDate={fechaDesde}
                endDate={fechaHasta}
                {...(fechaDesde ? { minDate: fechaDesde } : {})}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Hasta (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFechaDesde(null);
                setFechaHasta(null);
              }}
              className="h-11 w-full rounded-xl bg-gray-100 px-4 text-sm font-bold hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 lg:col-span-1"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Total: ${formatMoney(totalUsd)}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando gastos...</p>
        ) : gastos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay gastos comunes para este condominio.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-20 bg-white dark:bg-donezo-card-dark">
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="p-3 font-bold">
                      <button type="button" onClick={() => toggleSort('fecha_gasto')} className="font-bold hover:text-donezo-primary">
                        Fecha {sortIndicator('fecha_gasto')}
                      </button>
                    </th>
                    <th className="p-3 font-bold">
                      <button type="button" onClick={() => toggleSort('concepto')} className="font-bold hover:text-donezo-primary">
                        Concepto {sortIndicator('concepto')}
                      </button>
                    </th>
                    <th className="p-3 font-bold">
                      <button type="button" onClick={() => toggleSort('clasificacion')} className="font-bold hover:text-donezo-primary">
                        Etiqueta {sortIndicator('clasificacion')}
                      </button>
                    </th>
                    <th className="p-3 text-right font-bold">
                      <button type="button" onClick={() => toggleSort('monto_usd')} className="font-bold hover:text-donezo-primary">
                        Monto ($) {sortIndicator('monto_usd')}
                      </button>
                    </th>
                    <th className="p-3 text-right font-bold">
                      <button type="button" onClick={() => toggleSort('monto_bs')} className="font-bold hover:text-donezo-primary">
                        Monto (Bs) {sortIndicator('monto_bs')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFiltrados.map((gasto) => (
                    <tr key={gasto.id} className="border-b border-gray-50 dark:border-gray-800/70">
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-300">
                        {getGastoDate(gasto.fecha_gasto)?.toLocaleDateString('es-VE') || String(gasto.fecha_gasto).slice(0, 10)}
                      </td>
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
            {gastosFiltrados.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No hay resultados con los filtros aplicados.</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

export default GastosPropietario;
