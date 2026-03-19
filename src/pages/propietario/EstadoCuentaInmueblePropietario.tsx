import { useEffect, useMemo, useState, type FC } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { useOutletContext } from 'react-router-dom';
import ModalRegistrarPago from '../../components/ModalRegistrarPago';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';
import { formatDateTimeVE, formatDateVE } from '../../utils/datetime';
import 'react-datepicker/dist/react-datepicker.css';

interface PropiedadActiva {
  id_propiedad: number;
  id_condominio: number;
  identificador: string;
  nombre_condominio: string;
}

interface OutletContextType {
  userRole?: string;
  propiedadActiva?: PropiedadActiva | null;
}

interface EstadoCuentaMovimientoRaw {
  fecha_operacion: string;
  fecha_registro: string;
  tipo: string;
  concepto: string;
  monto_bs: string | number | null;
  tasa_cambio: string | number | null;
  cargo: string | number;
  abono: string | number;
}

interface EstadoCuentaMovimiento extends EstadoCuentaMovimientoRaw {
  saldoFila: number;
}

interface EstadoCuentaResponse {
  status: 'success' | 'error';
  data?: EstadoCuentaMovimientoRaw[];
  message?: string;
}

interface NotificacionPago {
  id: number;
  estado: string;
}

interface NotificacionesResponse {
  status: 'success' | 'error';
  data?: NotificacionPago[];
}

interface BcvApiResponse {
  promedio?: number | string;
}

interface PropiedadPreseleccionada {
  id: number;
  identificador: string;
  saldo_actual: string | number;
}

type SortDirection = 'asc' | 'desc';

const toNumber = (value: unknown): number => Number.parseFloat(String(value ?? 0)) || 0;
const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const EstadoCuentaInmueblePropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [movimientosRaw, setMovimientosRaw] = useState<EstadoCuentaMovimientoRaw[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [selectedPropPago, setSelectedPropPago] = useState<PropiedadPreseleccionada | null>(null);
  const [tasaBcvActual, setTasaBcvActual] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchTasaBcvActual = async (): Promise<void> => {
      try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!response.ok) return;
        const json: BcvApiResponse = (await response.json()) as BcvApiResponse;
        const rate = toNumber(json?.promedio);
        if (isMounted && rate > 0) setTasaBcvActual(rate);
      } catch {
        // no-op
      }
    };

    void fetchTasaBcvActual();
    intervalId = setInterval(() => {
      void fetchTasaBcvActual();
    }, 2 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const fetchEstadoCuenta = async (): Promise<void> => {
      if (!propiedadActiva?.id_propiedad) {
        setMovimientosRaw([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/estado-cuenta-inmueble/${propiedadActiva.id_propiedad}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: EstadoCuentaResponse = (await res.json()) as EstadoCuentaResponse;
        if (!res.ok || data.status !== 'success') {
          setMovimientosRaw([]);
          return;
        }

        setMovimientosRaw(Array.isArray(data.data) ? data.data : []);
      } catch {
        setMovimientosRaw([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchEstadoCuenta();
  }, [propiedadActiva?.id_propiedad]);

  useEffect(() => {
    const fetchNotificaciones = async (): Promise<void> => {
      if (!propiedadActiva?.id_propiedad) {
        setPendingApprovals(0);
        return;
      }
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/notificaciones?propiedad_id=${propiedadActiva.id_propiedad}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: NotificacionesResponse = (await res.json()) as NotificacionesResponse;
        if (!res.ok || data.status !== 'success') {
          setPendingApprovals(0);
          return;
        }
        const rows = Array.isArray(data.data) ? data.data : [];
        setPendingApprovals(rows.filter((n) => n.estado === 'PendienteAprobacion').length);
      } catch {
        setPendingApprovals(0);
      }
    };

    void fetchNotificaciones();
  }, [propiedadActiva?.id_propiedad, showPayModal]);

  const toggleSortIngreso = (): void => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortIndicator = (): string => {
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const movimientosConSaldo = useMemo<EstadoCuentaMovimiento[]>(() => {
    const sortedByRegistro = [...movimientosRaw].sort(
      (a, b) => new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime(),
    );

    let saldo = 0;
    return sortedByRegistro.map((mov) => {
      const cargo = toNumber(mov.cargo);
      const abono = toNumber(mov.abono);
      saldo += cargo - abono;
      return { ...mov, saldoFila: saldo };
    });
  }, [movimientosRaw]);

  const movimientosFiltrados = useMemo<EstadoCuentaMovimiento[]>(() => {
    const search = searchTerm.trim().toLowerCase();
    const desde = fechaDesde ? startOfDay(fechaDesde) : null;
    const hasta = fechaHasta ? endOfDay(fechaHasta) : null;

    const filtered = movimientosConSaldo.filter((mov) => {
      const opDate = new Date(mov.fecha_operacion);
      if (desde && opDate < desde) return false;
      if (hasta && opDate > hasta) return false;
      if (!search) return true;
      return (
        String(mov.concepto || '').toLowerCase().includes(search)
        || String(mov.tipo || '').toLowerCase().includes(search)
      );
    });

    return [...filtered].sort((a, b) => {
      const cmp = new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime();
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [movimientosConSaldo, searchTerm, fechaDesde, fechaHasta, sortDirection]);

  const totalCargo = useMemo(() => movimientosFiltrados.reduce((acc, m) => acc + toNumber(m.cargo), 0), [movimientosFiltrados]);
  const totalAbono = useMemo(() => movimientosFiltrados.reduce((acc, m) => acc + toNumber(m.abono), 0), [movimientosFiltrados]);
  const saldoFinal = toNumber(movimientosFiltrados.at(-1)?.saldoFila);
  const saldoFinalClass = saldoFinal > 0
    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : saldoFinal < 0
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  const saldoActualInmueble = toNumber(movimientosConSaldo.at(-1)?.saldoFila);

  const openPagoModal = (): void => {
    if (!propiedadActiva) return;
    setSelectedPropPago({
      id: propiedadActiva.id_propiedad,
      identificador: propiedadActiva.identificador,
      saldo_actual: saldoActualInmueble,
    });
    setShowPayModal(true);
  };

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      {!loading && movimientosConSaldo.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
          {pendingApprovals > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
              Tienes {pendingApprovals} pago(s) en aprobación por la junta de condominio.
            </div>
          )}

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
                placeholder="Buscar por concepto o tipo..."
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={openPagoModal}
              disabled={saldoActualInmueble <= 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Registrar Pago
            </button>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 dark:bg-red-900/30 dark:text-red-300">Cargos: ${formatMoney(totalCargo)}</span>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700 dark:bg-green-900/30 dark:text-green-300">Abonos: ${formatMoney(totalAbono)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${saldoFinalClass}`}>Saldo: ${formatMoney(saldoFinal)}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        {loading ? (
          <p className="py-10 text-center text-gray-400">Cargando estado de cuenta...</p>
        ) : movimientosConSaldo.length === 0 ? (
          <p className="py-10 text-center text-gray-400">No hay movimientos para este inmueble.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white dark:bg-donezo-card-dark">
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="p-3 font-bold uppercase text-[11px]">
                    <button type="button" onClick={toggleSortIngreso} className="font-bold hover:text-donezo-primary">
                      Ingreso al Sistema {sortIndicator()}
                    </button>
                  </th>
                  <th className="p-3 font-bold uppercase text-[11px]">
                    Fecha Op.
                  </th>
                  <th className="p-3 font-bold uppercase text-[11px]">
                    Concepto
                  </th>
                  <th className="hidden p-3 text-right font-bold uppercase text-[11px] md:table-cell">
                    Cargos
                  </th>
                  <th className="hidden p-3 text-right font-bold uppercase text-[11px] md:table-cell">
                    Abonos
                  </th>
                  <th className="p-3 text-right font-bold uppercase text-[11px] text-donezo-primary">
                    Saldo Final
                  </th>
                  <th className="hidden p-3 text-right font-bold uppercase text-[11px] md:table-cell">Tasa BCV (hoy)</th>
                  <th className="hidden p-3 text-right font-bold uppercase text-[11px] md:table-cell">Monto Bs (BCV hoy)</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m, idx) => (
                  <tr key={`${m.tipo}-${m.fecha_registro}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                    <td className="p-3 text-xs font-mono text-gray-600 dark:text-gray-300">{formatDateTimeVE(m.fecha_registro)}</td>
                    <td className="p-3 text-[10px] font-mono text-gray-400">{formatDateVE(m.fecha_operacion)}</td>
                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200 break-words">
                      {m.tipo === 'RECIBO' ? m.concepto : `${m.tipo === 'PAGO' ? 'PAGO' : 'AJUSTE'} ${m.concepto}`}
                    </td>
                    <td className="hidden p-3 text-right font-mono font-medium text-red-500 md:table-cell">{toNumber(m.cargo) > 0 ? `$${formatMoney(toNumber(m.cargo))}` : '-'}</td>
                    <td className="hidden p-3 text-right font-mono font-medium text-green-500 md:table-cell">{toNumber(m.abono) > 0 ? `$${formatMoney(toNumber(m.abono))}` : '-'}</td>
                    <td
                      className={`p-3 text-right font-mono font-black ${
                        toNumber(m.saldoFila) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : toNumber(m.saldoFila) < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      ${formatMoney(toNumber(m.saldoFila))}
                    </td>
                    <td className="hidden p-3 text-right font-mono text-gray-700 dark:text-gray-300 md:table-cell">
                      {tasaBcvActual && tasaBcvActual > 0 ? formatMoney(tasaBcvActual) : '-'}
                    </td>
                    <td className="hidden p-3 text-right font-mono text-gray-700 dark:text-gray-300 md:table-cell">
                      {tasaBcvActual && tasaBcvActual > 0
                        ? `Bs ${formatMoney((toNumber(m.cargo) - toNumber(m.abono)) * tasaBcvActual)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movimientosFiltrados.length === 0 ? (
              <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">No hay movimientos con los filtros aplicados.</p>
            ) : null}
          </div>
        )}
      </div>

      {showPayModal && (
        <ModalRegistrarPago
          propiedadPreseleccionada={selectedPropPago}
          reciboId={null}
          soloCuentaPrincipal={true}
          condominioId={propiedadActiva?.id_condominio ?? null}
          onClose={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
          }}
          onSuccess={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
            if (!propiedadActiva?.id_propiedad) return;
            void (async () => {
              setLoading(true);
              try {
                const token = localStorage.getItem('habioo_token');
                const res = await fetch(`${API_BASE_URL}/api/propietario/estado-cuenta-inmueble/${propiedadActiva.id_propiedad}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const data: EstadoCuentaResponse = (await res.json()) as EstadoCuentaResponse;
                if (!res.ok || data.status !== 'success') {
                  setMovimientosRaw([]);
                  return;
                }
                setMovimientosRaw(Array.isArray(data.data) ? data.data : []);
              } catch {
                setMovimientosRaw([]);
              } finally {
                setLoading(false);
              }
            })();
          }}
        />
      )}
    </section>
  );
};

export default EstadoCuentaInmueblePropietario;
