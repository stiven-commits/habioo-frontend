import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalRegistrarPago from '../components/ModalRegistrarPago';

export default function HistorialAvisos() {
  const { userRole } = useOutletContext();
  const [recibos, setRecibos] = useState([]);
  const [bancos, setBancos] = useState([]); // Cargamos los bancos para el selector
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modales
  const [showPrintModal, setShowPrintModal] = useState(null);
  const [showPayModal, setShowPayModal] = useState(null); // ID del recibo a pagar



  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resRecibos, resBancos] = await Promise.all([
        fetch('https://auth.habioo.cloud/recibos-historial', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const dataR = await resRecibos.json();
      const dataB = await resBancos.json();

      if (dataR.status === 'success') setRecibos(dataR.recibos);
      if (dataB.status === 'success') setBancos(dataB.bancos);

    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);



  // Helpers de Renderizado
  const filteredRecibos = recibos.filter(r => 
    r.apto.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.propietario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mes_cobro.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRecibos.length / ITEMS_PER_PAGE);
  const paginatedData = filteredRecibos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getFinancials = (r) => {
    const total = parseFloat(r.monto_usd);
    const estado = r.estado || 'Aviso de Cobro';
    // Lógica simplificada: Si está solvente asumimos 100% pagado. (En futuro conectaremos a tabla pagos real)
    const pagado = ['Solvente', 'Validado'].includes(estado) ? total : (estado === 'Abonado Parcial' ? total / 2 : 0); 
    return { total, pagado, falta: total - pagado };
  };



  if (userRole !== 'Administrador') return <p className="p-6">Acceso Denegado</p>;

  return (
    <div className="space-y-6 relative">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🗂️ Historial de avisos y recibos</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input 
            type="text" placeholder="Buscar apartamento, propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white transition-all"
          />
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 dark:text-gray-400">Cargando...</p> : filteredRecibos.length === 0 ? <p className="text-gray-500 text-center py-4 dark:text-gray-400">No hay recibos emitidos.</p> : (
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
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          r.estado === 'Solvente' ? 'bg-green-100 text-green-800' :
                          r.estado === 'Abonado Parcial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">${r.monto_usd}</td>
                      <td className="p-3 flex justify-center gap-2">
                        <button onClick={() => setShowPrintModal(r)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg" title="Ver / Imprimir">🖨️</button>
                        {r.estado !== 'Solvente' && (
                          <button onClick={() => setShowPayModal(r)} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-lg" title="Registrar Pago">💵</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Paginación aquí (igual que antes)... */}
          </>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {showPayModal && (
        <ModalRegistrarPago
          recibo={showPayModal}
          bancos={bancos}
          onClose={() => setShowPayModal(null)}
          onSuccess={() => {
            setShowPayModal(null);
            fetchData();
          }}
        />
      )}

      {/* MODAL IMPRESIÓN (Mismo de antes) */}
      {showPrintModal && (
        // ... (Tu modal de impresión existente) ...
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-lg shadow-2xl text-center">
             <h3 className="font-bold text-gray-800 dark:text-white mb-4">Vista Previa</h3>
             <p className="text-gray-500 mb-6 dark:text-gray-400">Recibo #{showPrintModal.id}</p>
             <button onClick={() => setShowPrintModal(null)} className="px-6 py-2 bg-gray-200 rounded-xl font-bold">Cerrar</button>
           </div>
        </div>
      )}
    </div>
  );
}