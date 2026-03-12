import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalAgregarGasto from '../components/ModalAgregarGasto';
import ModalDetallesGasto from '../components/ModalDetallesGasto';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';

const formatMonthText = (yyyyMm) => {
  if (!yyyyMm) return '';
  const [year, month] = yyyyMm.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(month, 10) - 1]} ${year}`;
};

const parseDisplayDate = (ddmmyyyy) => {
  if (!ddmmyyyy || ddmmyyyy === 'N/A') return null;
  const [dd, mm, yyyy] = String(ddmmyyyy).split('/');
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function Gastos() {
  const { userRole } = useOutletContext();
  const { showConfirm } = useDialog();

  const [gastosAgrupados, setGastosAgrupados] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 13;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resGastos, resProv, resZonas, resProps] = await Promise.all([
        fetch(`${API_BASE_URL}/gastos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/proveedores`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/zonas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataGastos = await resGastos.json();
      const dataProv = await resProv.json();
      const dataZonas = await resZonas.json();
      const dataProps = await resProps.json();

      if (dataGastos.status === 'success') {
        const agrupados = dataGastos.gastos.reduce((acc, curr) => {
          if (!acc[curr.gasto_id]) {
            acc[curr.gasto_id] = {
              gasto_id: curr.gasto_id,
              proveedor: curr.proveedor,
              concepto: curr.concepto,
              fecha_factura: curr.fecha_factura || 'N/A',
              fecha_registro: curr.fecha_registro || 'N/A',
              factura_img: curr.factura_img,
              imagenes: Array.isArray(curr.imagenes) ? curr.imagenes : [],
              monto_bs: curr.monto_bs,
              tasa_cambio: curr.tasa_cambio,
              monto_total_usd: curr.monto_total_usd,
              total_cuotas: curr.total_cuotas,
              nota: curr.nota,
              tipo: curr.tipo || 'Comun',
              zona_nombre: curr.zona_nombre,
              propiedad_identificador: curr.propiedad_identificador,
              cuotas: [],
              canDelete: true,
            };
          }
          acc[curr.gasto_id].cuotas.push(curr);
          if (curr.estado !== 'Pendiente') acc[curr.gasto_id].canDelete = false;
          return acc;
        }, {});
        setGastosAgrupados(Object.values(agrupados));
      }

      if (dataProv.status === 'success') setProveedores(dataProv.proveedores);
      if (dataZonas.status === 'success') setZonas((dataZonas.zonas || []).filter((z) => z.activa));
      if (dataProps.status === 'success') setPropiedades(dataProps.propiedades || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, fechaDesde, fechaHasta]);

  const filteredBySearchAndDate = useMemo(() => {
    return gastosAgrupados.filter((g) => {
      const matchesSearch =
        g.concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const fecha = parseDisplayDate(g.fecha_factura);
      if (fechaDesde) {
        const desde = new Date(`${fechaDesde}T00:00:00`);
        if (!fecha || fecha < desde) return false;
      }
      if (fechaHasta) {
        const hasta = new Date(`${fechaHasta}T23:59:59`);
        if (!fecha || fecha > hasta) return false;
      }
      return true;
    });
  }, [gastosAgrupados, searchTerm, fechaDesde, fechaHasta]);

  const filteredGastos = useMemo(() => {
    return filteredBySearchAndDate.filter((g) => {
      if (activeTab === 'Todos') return true;
      if (activeTab === 'Zona') return g.tipo === 'Zona' || g.tipo === 'No Comun';
      return g.tipo === activeTab;
    });
  }, [filteredBySearchAndDate, activeTab]);

  const totalByType = useMemo(() => {
    const sum = (arr) => arr.reduce((acc, g) => acc + parseFloat(g.monto_total_usd || 0), 0);
    return {
      Comun: sum(filteredBySearchAndDate.filter((g) => g.tipo === 'Comun')),
      Zona: sum(filteredBySearchAndDate.filter((g) => g.tipo === 'Zona' || g.tipo === 'No Comun')),
      Individual: sum(filteredBySearchAndDate.filter((g) => g.tipo === 'Individual')),
      Extra: sum(filteredBySearchAndDate.filter((g) => g.tipo === 'Extra')),
    };
  }, [filteredBySearchAndDate]);

  const totalPages = Math.ceil(filteredGastos.length / ITEMS_PER_PAGE);
  const paginatedGastos = filteredGastos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleRow = (id, e) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (gastoId, e) => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: 'Eliminar gasto',
      message: '¿Eliminar este gasto y todas sus cuotas?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`${API_BASE_URL}/gastos/${gastoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchData();
    else alert('No se pudo eliminar');
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🗂️ Gastos</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar concepto, proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"
          />
        </div>
        <div className="flex items-end gap-2 w-full sm:w-auto">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-xs [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-xs [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFechaDesde('');
              setFechaHasta('');
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          >
            Limpiar
          </button>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap shadow-md"
        >
          + Nuevo Gasto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Común</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Comun)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Por Zona</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Zona)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Individual</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Individual)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Extra</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Extra)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-4 gap-6">
          {['Todos', 'Comun', 'Zona', 'Individual', 'Extra'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 font-bold text-sm transition-all relative rounded-t-lg ${
                activeTab === tab
                  ? 'text-donezo-primary dark:text-white bg-blue-50 dark:bg-blue-900/40'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {tab === 'Comun' ? 'Comunes' : tab === 'Zona' ? 'Por Zona' : tab === 'Individual' ? 'Individuales' : tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary rounded-t-full"></span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
          ) : filteredGastos.length === 0 ? (
            <p className="text-gray-500 text-center py-8 dark:text-gray-400">No se encontraron gastos.</p>
          ) : (
            <>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse select-none">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 text-sm dark:text-gray-400">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Fechas</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3 text-right">Monto Total</th>
                      <th className="p-3 text-center">Cuotas</th>
                      <th className="p-3 text-right">Por Pagar</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGastos.map((g) => (
                      <React.Fragment key={g.gasto_id}>
                        <tr
                          onDoubleClick={() => setSelectedGasto(g)}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3 text-center" onClick={(e) => toggleRow(g.gasto_id, e)}>
                            <button className="text-gray-400 hover:text-donezo-primary transition-colors text-lg">
                              {expandedRows[g.gasto_id] ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="p-3">
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-300">📄 {g.fecha_factura}</span>
                            <span className="block text-[10px] text-gray-400">💻 {g.fecha_registro}</span>
                          </td>
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-300 text-sm">{g.proveedor}</td>
                          <td className="p-3">
                            <div className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] text-sm" title={g.concepto}>
                              {g.concepto}
                            </div>
                            {(g.tipo === 'Zona' || g.tipo === 'No Comun') && (
                              <span className="inline-block mt-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Zona: {g.zona_nombre || 'Especifica'}
                              </span>
                            )}
                            {g.tipo === 'Individual' && (
                              <span className="inline-block mt-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Apto/Casa: {g.propiedad_identificador}
                              </span>
                            )}
                            {g.tipo === 'Extra' && (
                              <span className="inline-block mt-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Extra
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-gray-800 dark:text-white text-sm">${formatMoney(g.monto_total_usd)}</td>
                          <td className="p-3 text-center">
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-3 rounded-full text-xs font-bold">
                              {g.total_cuotas} Mes{g.total_cuotas > 1 ? 'es' : ''}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-orange-500 dark:text-orange-300 text-sm">
                            ${formatMoney(g.cuotas[0]?.saldo_pendiente || 0)}
                          </td>
                          <td className="p-3 text-center">
                            {g.canDelete ? (
                              <button onClick={(e) => handleDelete(g.gasto_id, e)} className="text-red-400 hover:text-red-600 p-2">
                                🗑️
                              </button>
                            ) : (
                              <span className="text-gray-300">🔒</span>
                            )}
                          </td>
                        </tr>
                        {expandedRows[g.gasto_id] &&
                          g.cuotas.map((c) => (
                            <tr key={c.cuota_id} className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-50 dark:border-gray-800/50">
                              <td className="p-3 border-l-2 border-donezo-primary"></td>
                              <td className="p-3 text-gray-500 text-xs dark:text-gray-400" colSpan="2">
                                Cobro en: <strong>{formatMonthText(c.mes_asignado)}</strong>
                              </td>
                              <td className="p-3 text-gray-500 text-xs dark:text-gray-400">
                                Fracción {c.numero_cuota}/{g.total_cuotas}
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-[10px] font-bold bg-white dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                                  {c.estado}
                                </span>
                              </td>
                              <td className="p-3 text-right text-gray-400 text-xs">Restan: ${formatMoney(c.saldo_pendiente)}</td>
                              <td className="p-3 text-right text-gray-600 dark:text-gray-400 font-medium text-sm">
                                ${formatMoney(c.monto_cuota_usd)}
                              </td>
                              <td></td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 disabled:opacity-50 text-sm font-bold"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 disabled:opacity-50 text-sm font-bold"
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

      {isModalOpen && (
        <ModalAgregarGasto
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
          }}
          proveedores={proveedores}
          zonas={zonas}
          propiedades={propiedades}
        />
      )}

      {selectedGasto && <ModalDetallesGasto gasto={selectedGasto} onClose={() => setSelectedGasto(null)} />}
    </div>
  );
}
