import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import ModalRegistrarPago from '../components/ModalRegistrarPago';
import { ModalEstadoCuenta } from '../components/propiedades/PropiedadesModals';

export default function CuentasPorCobrar() {
  const { userRole } = useOutletContext();
  const [propiedades, setPropiedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 💡 NUEVO ESTADO PARA LAS PESTAÑAS
  const [activeTab, setActiveTab] = useState('Deudores'); 

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 13;

  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPropPago, setSelectedPropPago] = useState(null);

  const [estadoCuentaModalOpen, setEstadoCuentaModalOpen] = useState(false);
  const [selectedPropCuenta, setSelectedPropCuenta] = useState(null);
  const [estadoCuentaData, setEstadoCuentaData] = useState([]);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const toLocalYmd = (dateLike) => {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades || []);
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
  }, [searchTerm, activeTab]); // 💡 Resetea la paginación si cambia el buscador o la pestaña

  const handleOpenRegistrarPago = (prop) => {
    setSelectedPropPago(prop);
    setShowPayModal(true);
  };

  const fetchEstadoCuenta = async (propId) => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${propId}/estado-cuenta`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCuenta(false);
    }
  };

  const handleOpenEstadoCuenta = (prop) => {
    setSelectedPropCuenta(prop);
    setFechaDesde('');
    setFechaHasta('');
    fetchEstadoCuenta(prop.id);
    setEstadoCuentaModalOpen(true);
  };

  // 💡 LÓGICA DE FILTRADO POR PESTAÑAS
  const baseProperties = activeTab === 'Deudores' 
    ? propiedades.filter((p) => parseFloat(p.saldo_actual || 0) > 0) 
    : propiedades;

  const filteredProperties = baseProperties.filter(
    (p) =>
      p.identificador?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = filteredProperties.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  let saldoAcumulado = 0;
  const dataConSaldo = estadoCuentaData.map((mov) => {
    saldoAcumulado += parseFloat(mov.cargo) - parseFloat(mov.abono);
    return { ...mov, saldoFila: saldoAcumulado };
  });

  const estadoCuentaFiltrado = dataConSaldo.filter((m) => {
    if (!fechaDesde && !fechaHasta) return true;
    const movYmd = toLocalYmd(m.fecha_registro || m.fecha_operacion);
    if (!movYmd) return false;
    if (fechaDesde && movYmd < fechaDesde) return false;
    if (fechaHasta && movYmd > fechaHasta) return false;
    return true;
  });

  const totalCargo = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.abono), 0);

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  if (loading) return <p className="text-gray-500 dark:text-gray-400">Cargando cuentas por cobrar...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Cobranza de Inmuebles</h3>
          <div className="flex-1 w-full max-w-md relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Buscar inmueble o propietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"
            />
          </div>
        </div>

        {/* 💡 PESTAÑAS DE NAVEGACIÓN */}
        <div className="flex gap-6 border-b border-gray-100 dark:border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('Deudores')}
            className={`py-3 px-2 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'Deudores'
                ? 'border-donezo-primary text-donezo-primary dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            ⚠️ Con Deuda Pendiente
          </button>
          <button
            onClick={() => setActiveTab('Todos')}
            className={`py-3 px-2 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'Todos'
                ? 'border-donezo-primary text-donezo-primary dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            🏢 Todos los Inmuebles
          </button>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {activeTab === 'Deudores' ? '🎉 ¡Genial! No hay inmuebles con deuda pendiente.' : 'No se encontraron inmuebles.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="p-3">Inmueble</th>
                  <th className="p-3 text-right">Alícuota</th>
                  <th className="p-3">Propietario</th>
                  <th className="p-3 text-right">Saldo Actual</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProperties.map((p) => {
                  const saldo = parseFloat(p.saldo_actual || 0);
                  
                  // 💡 LÓGICA DE COLORES DINÁMICOS PARA EL SALDO
                  const isDeuda = saldo > 0;
                  const isFavor = saldo < 0;
                  const colorClass = isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-500 dark:text-gray-400';
                  const label = isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Al Día';

                  return (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-bold text-gray-800 dark:text-white text-base">{p.identificador}</td>
                      <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{String(p.alicuota || 0).replace('.', ',')}%</td>
                      <td className="p-3">
                        <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre || 'Sin asignar'}</div>
                        <div className="text-xs text-gray-500">{p.prop_cedula || '-'}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-black font-mono tracking-tight text-lg ${colorClass}`}>
                          {isFavor ? '+' : ''}${formatMoney(Math.abs(saldo))}
                        </div>
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${isDeuda ? 'text-red-400' : isFavor ? 'text-green-400' : 'text-gray-400'}`}>
                          {label}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEstadoCuenta(p)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                          >
                            Estado de Cuenta
                          </button>
                          <button
                            onClick={() => handleOpenRegistrarPago(p)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors"
                          >
                            Registrar Pago
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</p>
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
      </div>

      {showPayModal && (
        <ModalRegistrarPago
          propiedadPreseleccionada={selectedPropPago}
          onClose={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
          }}
          onSuccess={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
            fetchData();
          }}
        />
      )}

      <ModalEstadoCuenta
        isOpen={estadoCuentaModalOpen}
        selectedPropCuenta={selectedPropCuenta}
        setEstadoCuentaModalOpen={setEstadoCuentaModalOpen}
        selectedPropAjuste={null}
        fechaDesde={fechaDesde}
        setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        setFechaHasta={setFechaHasta}
        handleOpenAjuste={() => {}}
        loadingCuenta={loadingCuenta}
        estadoCuentaFiltrado={estadoCuentaFiltrado}
        totalCargo={totalCargo}
        totalAbono={totalAbono}
        showAjuste={false}
      />
    </div>
  );
}
