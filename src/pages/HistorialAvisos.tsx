import { useEffect, useRef, useState } from 'react';
import type { FC, ChangeEvent } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import VistaAvisoCobro from '../components/recibos/VistaAvisoCobro';
import 'react-datepicker/dist/react-datepicker.css';

interface HistorialAvisosProps {}

interface OutletContextType {
  userRole?: string;
}

type EstadoFiltro = 'Todos' | 'Pagados' | 'Abonado' | 'Pendiente';

interface Recibo {
  id: number | string;
  apto?: string;
  propietario?: string;
  mes_cobro?: string;
  estado: string;
  fecha?: string;
  deuda_pendiente?: number | string;
  monto_usd?: number | string;
}

interface RecibosResponse {
  status: string;
  recibos?: Recibo[];
}

const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((v) => Number(v));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const HistorialAvisos: FC<HistorialAvisosProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();

  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 15;

  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>('Todos');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedReciboId, setSelectedReciboId] = useState<number | string | null>(null);
  const avisoPrintRef = useRef<HTMLDivElement | null>(null);

  const handlePrintAviso = (): void => {
    const target = avisoPrintRef.current;
    if (!target) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Aviso de Cobro</title>
          ${styles}
          <style>
            @page { size: auto; margin: 6mm; }
            html, body { background: #ffffff; margin: 0; padding: 0; }
            .print-shell { padding: 0; zoom: 80%; }
            @supports not (zoom: 1) {
              .print-shell {
                transform: scale(0.8);
                transform-origin: top left;
                width: 125%;
              }
            }
            .print-shell > .min-h-screen {
              min-height: auto !important;
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-shell > .min-h-screen > .mx-auto {
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 4mm !important;
            }
            .print-shell .shadow-sm,
            .print-shell .shadow-lg,
            .print-shell .shadow-2xl {
              box-shadow: none !important;
            }
            .print-shell .aviso-header {
              display: flex !important;
              flex-direction: row !important;
              align-items: flex-start !important;
              justify-content: space-between !important;
              gap: 12px !important;
            }
            .print-shell .aviso-header-left {
              width: 25% !important;
            }
            .print-shell .aviso-header-center {
              width: 50% !important;
              text-align: center !important;
            }
            .print-shell .aviso-header-right {
              width: 25% !important;
              text-align: right !important;
            }
            .print-shell .aviso-top-grid,
            .print-shell .aviso-mensajes-grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 12px !important;
            }
          </style>
        </head>
        <body>
          <div class="print-shell">${target.innerHTML}</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const resRecibos = await fetch('https://auth.habioo.cloud/recibos-historial', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resRecibos.status === 401) {
        localStorage.removeItem('habioo_token');
        localStorage.removeItem('habioo_user');
        navigate('/');
        return;
      }

      const dataR: RecibosResponse = await resRecibos.json();
      if (dataR.status === 'success') setRecibos(dataR.recibos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') void fetchData();
  }, [userRole]);

  const mapEstadoTab = (estado: string): Exclude<EstadoFiltro, 'Todos'> => {
    if (['Pagado', 'Solvente', 'Validado', 'Recibo'].includes(estado)) return 'Pagados';
    if (['Abonado', 'Abonado Parcial', 'Parcial'].includes(estado)) return 'Abonado';
    return 'Pendiente';
  };

  const parseFechaRecibo = (r: Recibo): Date | null => {
    if (r.fecha && r.fecha.includes('/')) {
      const [dd, mm, yyyy] = r.fecha.split('/');
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    return null;
  };

  const recibosFiltrados = recibos.filter((r: Recibo) => {
    const q = search.trim().toLowerCase();
    const coincideTexto =
      q === '' ||
      r.apto?.toLowerCase().includes(q) ||
      r.propietario?.toLowerCase().includes(q) ||
      r.mes_cobro?.toLowerCase().includes(q);

    const coincideEstado = filtroEstado === 'Todos' || mapEstadoTab(r.estado) === filtroEstado;

    let coincideFecha = true;
    if (fechaDesde || fechaHasta) {
      const fechaRecibo = parseFechaRecibo(r);
      if (!fechaRecibo) return false;
      if (fechaDesde && fechaRecibo < new Date(`${fechaDesde}T00:00:00`)) coincideFecha = false;
      if (fechaHasta && fechaRecibo > new Date(`${fechaHasta}T23:59:59`)) coincideFecha = false;
    }

    return coincideTexto && coincideEstado && coincideFecha;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filtroEstado, fechaDesde, fechaHasta]);

  const totalPages = Math.ceil(recibosFiltrados.length / ITEMS_PER_PAGE);
  const paginatedData = recibosFiltrados.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (userRole !== 'Administrador') return <p className="p-6">Acceso Denegado</p>;

  return (
    <div className="space-y-6 relative">
      <div className="bg-white dark:bg-donezo-card-dark p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 space-y-5">
        <div className="flex flex-col xl:flex-row justify-between gap-4 items-end">
          <div className="flex-1 w-full xl:w-auto">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Buscar Inmueble</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar por apartamento o casa..."
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary text-sm font-medium dark:text-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
            <div className="flex-1 xl:flex-none">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Desde</label>
              <DatePicker
                selected={ymdToDate(fechaDesde)}
                onChange={(date: Date | null) => setFechaDesde(dateToYmd(date))}
                selectsStart
                startDate={ymdToDate(fechaDesde)}
                endDate={ymdToDate(fechaHasta)}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Desde (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pr-10 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex-1 xl:flex-none">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Hasta</label>
              <DatePicker
                selected={ymdToDate(fechaHasta)}
                onChange={(date: Date | null) => setFechaHasta(dateToYmd(date))}
                selectsEnd
                startDate={ymdToDate(fechaDesde)}
                endDate={ymdToDate(fechaHasta)}
                {...(fechaDesde ? { minDate: ymdToDate(fechaDesde) || undefined } : {})}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Hasta (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pr-10 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            {(fechaDesde || fechaHasta) && (
              <button
                onClick={() => {
                  setFechaDesde('');
                  setFechaHasta('');
                }}
                className="mb-1 text-gray-400 hover:text-red-500 font-bold p-2 text-xl transition-colors"
                title="Limpiar Fechas"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-4 gap-6 overflow-x-auto">
          {(['Todos', 'Pagados', 'Abonado', 'Pendiente'] as EstadoFiltro[]).map((estado: EstadoFiltro) => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`pb-3 font-bold text-sm transition-all relative whitespace-nowrap ${
                filtroEstado === estado
                  ? 'text-donezo-primary dark:text-white'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {estado === 'Abonado' ? 'Abonados' : estado}
              {filtroEstado === estado && <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary dark:bg-white rounded-t-full"></span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
          ) : recibosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-center py-4 dark:text-gray-400">No hay recibos para esos filtros.</p>
          ) : (
            <>
              <div className="w-full">
                <table className="w-full text-left border-collapse select-none">
                  <thead className="sticky top-0 bg-white dark:bg-donezo-card-dark z-20 shadow-sm">
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 text-sm dark:text-gray-400">
                      <th className="p-3 pl-6">Recibo</th>
                      <th className="p-3">Inmueble</th>
                      <th className="p-3">Propietario</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-right text-red-500">Deuda</th>
                      <th className="p-3 pr-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((r: Recibo) => (
                      <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                        <td className="p-3 pl-6">
                          <span className="font-mono text-gray-400 block">#{r.id}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{r.fecha}</span>
                        </td>
                        <td className="p-3 font-bold text-gray-800 dark:text-white">
                          {r.apto}
                          <div className="text-[10px] font-normal text-gray-400">{r.mes_cobro}</div>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{r.propietario || 'Sin asignar'}</td>
                        <td className="p-3 text-center">
                          {mapEstadoTab(r.estado) === 'Pagados' ? (
                            <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm border border-green-200 dark:border-green-800/50">
                              Pagado
                            </span>
                          ) : mapEstadoTab(r.estado) === 'Abonado' ? (
                            <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm border border-yellow-200 dark:border-yellow-800/50">
                              Abonado
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm border border-red-200 dark:border-red-800/50">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-800 dark:text-white">
                          ${formatMoney(r.deuda_pendiente ?? r.monto_usd)}
                        </td>
                        <td className="p-3 pr-6 flex justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedReciboId(r.id);
                              setShowPrintModal(true);
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg"
                            title="Ver / Imprimir"
                          >
                            🖨️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-sm text-gray-500">Página {currentPage} de {totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto print:hidden">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900/95">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Aviso de Cobro {selectedReciboId ? `#${selectedReciboId}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAviso}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedReciboId(null);
                  }}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div ref={avisoPrintRef} className="max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
              <VistaAvisoCobro reciboId={selectedReciboId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialAvisos;
