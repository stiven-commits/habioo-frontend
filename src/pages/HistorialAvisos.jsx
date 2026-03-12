import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/currency';

export default function HistorialAvisos() {
  const { userRole } = useOutletContext();
  const navigate = useNavigate();

  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [showPrintModal, setShowPrintModal] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const resRecibos = await fetch('https://auth.habioo.cloud/recibos-historial', { headers: { Authorization: `Bearer ${token}` } });

      if (resRecibos.status === 401) {
        localStorage.removeItem('habioo_token');
        localStorage.removeItem('habioo_user');
        navigate('/');
        return;
      }

      const dataR = await resRecibos.json();

      if (dataR.status === 'success') setRecibos(dataR.recibos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  const mapEstadoTab = (estado) => {
    if (['Pagado', 'Solvente', 'Validado'].includes(estado)) return 'Recibos';
    if (['Abonado', 'Abonado Parcial', 'Parcial'].includes(estado)) return 'Abonado';
    return 'Pendiente';
  };

  const parseFechaRecibo = (r) => {
    if (r.fecha && r.fecha.includes('/')) {
      const [dd, mm, yyyy] = r.fecha.split('/');
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    return null;
  };

  const recibosFiltrados = recibos.filter((r) => {
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
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary text-sm font-medium dark:text-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
            <div className="flex-1 xl:flex-none">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary text-sm dark:text-white cursor-pointer font-mono"
              />
            </div>
            <div className="flex-1 xl:flex-none">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary text-sm dark:text-white cursor-pointer font-mono"
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
          {['Todos', 'Recibos', 'Abonado', 'Pendiente'].map((estado) => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`pb-3 font-bold text-sm transition-all relative whitespace-nowrap ${
                filtroEstado === estado ? 'text-donezo-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {estado === 'Abonado' ? 'Abonados' : estado}
              {filtroEstado === estado && <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary rounded-t-full"></span>}
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
              <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 text-sm dark:text-gray-400">
                    <th className="p-3">Recibo</th>
                    <th className="p-3">Inmueble</th>
                    <th className="p-3">Propietario</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-right text-red-500">Deuda</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                      <td className="p-3">
                        <span className="font-mono text-gray-400 block">#{r.id}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{r.fecha}</span>
                      </td>
                      <td className="p-3 font-bold text-gray-800 dark:text-white">
                        {r.apto}
                        <div className="text-[10px] font-normal text-gray-400">{r.mes_cobro}</div>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{r.propietario || 'Sin asignar'}</td>
                      <td className="p-3 text-center">
                        {mapEstadoTab(r.estado) === 'Recibos' ? (
                          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm border border-green-200 dark:border-green-800/50">
                            Recibo
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
                      <td className="p-3 flex justify-center gap-2">
                        <button onClick={() => setShowPrintModal(r)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg" title="Ver / Imprimir">🖨️</button>
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
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-lg shadow-2xl text-center my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Vista Previa</h3>
            <p className="text-gray-500 mb-6 dark:text-gray-400">Recibo #{showPrintModal.id}</p>
            <button onClick={() => setShowPrintModal(null)} className="px-6 py-2 bg-gray-200 rounded-xl font-bold">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

