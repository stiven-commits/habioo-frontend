import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function HistorialRecibos() {
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

  // Formulario de Pago
  const [formPago, setFormPago] = useState({
    cuenta_id: '',
    monto_origen: '',
    tasa_cambio: '',
    referencia: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    nota: ''
  });

  // Calculadora visual
  const [conversionUSD, setConversionUSD] = useState('0.00');

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

  // Formateador de Moneda Input
  const formatCurrencyInput = (value) => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = parts[0] + ',' + parts.slice(1).join('');
    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (decimalPart !== undefined) {
      decimalPart = decimalPart.slice(0, 2);
      return `${integerPart},${decimalPart}`;
    }
    return integerPart;
  };

  // Manejar cambios en el formulario de pago
  const handlePagoChange = (e) => {
    const { name, value } = e.target;
    let newVal = value;

    // Aplicar formato de miles/decimales a los inputs numéricos
    if (name === 'monto_origen' || name === 'tasa_cambio') {
      newVal = formatCurrencyInput(value);
    }

    const updatedForm = { ...formPago, [name]: newVal };
    setFormPago(updatedForm);

    // --- LÓGICA DE CONVERSIÓN CORREGIDA ---
    if (updatedForm.monto_origen && updatedForm.cuenta_id) {
      const banco = bancos.find(b => b.id.toString() === updatedForm.cuenta_id);
      
      // Limpiamos los puntos y comas para tener un número JS válido
      const monto = parseFloat(updatedForm.monto_origen.replace(/\./g, '').replace(',', '.')) || 0;
      
      // Detectamos si es moneda extranjera
      const isForeign = banco && (
        banco.tipo.includes('Zelle') || 
        banco.tipo.includes('USD') || 
        banco.tipo.includes('EUR') || 
        banco.tipo.includes('Panamá') ||
        banco.tipo.includes('Paypal')
      );

      // Obtenemos la tasa limpia
      const tasaRaw = parseFloat(updatedForm.tasa_cambio.replace(/\./g, '').replace(',', '.'));

      if (isForeign) {
        // Si es divisa, es 1 a 1 siempre
        setConversionUSD(monto.toFixed(2));
      } else {
        // Si es Bs, SOLO calculamos si hay una tasa válida mayor a 0
        if (tasaRaw && tasaRaw > 0) {
          setConversionUSD((monto / tasaRaw).toFixed(2));
        } else {
          setConversionUSD('0.00'); // Esperando tasa...
        }
      }
    }
  };

  const handleSubmitPago = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Confirmar pago por $${conversionUSD}?`)) return;

    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/pagos-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...formPago, recibo_id: showPayModal.id })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
      alert(result.message);
      setShowPayModal(null);
      setFormPago({ cuenta_id: '', monto_origen: '', tasa_cambio: '', referencia: '', fecha_pago: new Date().toISOString().split('T')[0], nota: '' });
      setConversionUSD('0.00');
      fetchData(); // Recargar tabla para ver nuevo estado
    } else {
      alert(result.error);
    }
  };

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

  // Detectar si la cuenta seleccionada requiere tasa
  const selectedBank = bancos.find(b => b.id.toString() === formPago.cuenta_id);
  const requiresTasa = selectedBank && (selectedBank.tipo.includes('Bs') || selectedBank.tipo.includes('Móvil'));

  if (userRole !== 'Administrador') return <p className="p-6">Acceso Denegado</p>;

  return (
    <div className="space-y-6 relative">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🗂️ Historial de Recibos</h3>
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
        {loading ? <p className="text-gray-500">Cargando...</p> : filteredRecibos.length === 0 ? <p className="text-gray-500 text-center py-4">No hay recibos emitidos.</p> : (
          <>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 text-sm">
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
                        <span className="text-xs text-gray-500">{r.fecha}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Registrar Pago</h3>
              <button onClick={() => setShowPayModal(null)} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-4 text-center">
              <p className="text-xs text-blue-600 dark:text-blue-300 mb-1">Deuda Total</p>
              <p className="text-2xl font-black text-blue-800 dark:text-blue-200">${showPayModal.monto_usd}</p>
              <p className="text-xs text-gray-500">{showPayModal.apto} - {showPayModal.mes_cobro}</p>
            </div>

            <form onSubmit={handleSubmitPago} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cuenta Destino</label>
                <select name="cuenta_id" value={formPago.cuenta_id} onChange={handlePagoChange} className="w-full p-3 rounded-xl border bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none" required>
                  <option value="">Seleccione Banco...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre_banco} ({b.tipo})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto Pagado</label>
                  <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none" required />
                </div>
                {requiresTasa && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa Cambio</label>
                    <input type="text" name="tasa_cambio" value={formPago.tasa_cambio} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none" required />
                  </div>
                )}
              </div>

              {/* VISOR DE CONVERSIÓN */}
              <div className="flex justify-between items-center px-2 py-1">
                <span className="text-xs text-gray-400">Equivalente en USD:</span>
                <span className="font-bold text-green-600">${conversionUSD}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="text" name="referencia" value={formPago.referencia} onChange={handlePagoChange} placeholder="Ref / Comprobante" className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none" required />
                <input type="date" name="fecha_pago" value={formPago.fecha_pago} onChange={handlePagoChange} className="w-full p-3 rounded-xl border dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none" required />
              </div>

              <button type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all">
                Procesar Pago
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPRESIÓN (Mismo de antes) */}
      {showPrintModal && (
        // ... (Tu modal de impresión existente) ...
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-lg shadow-2xl text-center">
             <h3 className="font-bold text-gray-800 dark:text-white mb-4">Vista Previa</h3>
             <p className="text-gray-500 mb-6">Recibo #{showPrintModal.id}</p>
             <button onClick={() => setShowPrintModal(null)} className="px-6 py-2 bg-gray-200 rounded-xl font-bold">Cerrar</button>
           </div>
        </div>
      )}
    </div>
  );
}