import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Gastos() {
  const { userRole } = useOutletContext();
  const [gastosAgrupados, setGastosAgrupados] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales y Acordeón
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState(null); 
  const [expandedRows, setExpandedRows] = useState({}); // Controla qué filas están abiertas

  const [form, setForm] = useState({
    proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: ''
  });

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resGastos, resProv] = await Promise.all([
        fetch('https://auth.habioo.cloud/gastos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/proveedores', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const dataGastos = await resGastos.json();
      const dataProv = await resProv.json();

      if (dataGastos.status === 'success') {
        // Motor Agrupador: Convierte las cuotas planas en padres e hijos
        const agrupados = dataGastos.gastos.reduce((acc, curr) => {
          if (!acc[curr.gasto_id]) {
            acc[curr.gasto_id] = {
              gasto_id: curr.gasto_id,
              proveedor: curr.proveedor,
              concepto: curr.concepto,
              fecha: curr.fecha || 'N/A',
              monto_bs: curr.monto_bs,
              tasa_cambio: curr.tasa_cambio,
              monto_total_usd: curr.monto_total_usd,
              total_cuotas: curr.total_cuotas,
              nota: curr.nota,
              cuotas: [],
              canDelete: true
            };
          }
          acc[curr.gasto_id].cuotas.push(curr);
          if (curr.estado !== 'Pendiente') {
            acc[curr.gasto_id].canDelete = false; // Bloquea eliminación si hay procesados o pagados
          }
          return acc;
        }, {});
        setGastosAgrupados(Object.values(agrupados));
      }
      if (dataProv.status === 'success') setProveedores(dataProv.proveedores);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  const toggleRow = (id, e) => {
    e.stopPropagation();
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleMonedaChange = (e) => setForm({ ...form, [e.target.name]: formatCurrencyInput(e.target.value) });
  const handleCuotasChange = (delta) => {
    let next = (parseInt(form.total_cuotas) || 1) + delta;
    if (next >= 1 && next <= 24) setForm({ ...form, total_cuotas: next.toString() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message);
      setForm({ proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '' });
      setIsModalOpen(false);
      fetchData();
    } else {
      alert(data.message);
    }
  };

  const handleDelete = async (gasto_id, e) => {
    e.stopPropagation(); // Evita que se abra la modal de detalles
    if (!window.confirm('⚠️ ¿Estás completamente seguro de eliminar este gasto y todas sus cuotas? Esta acción es irreversible.')) return;
    
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/gastos/${gasto_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.status === 'success') {
        fetchData();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const filteredGastos = gastosAgrupados.filter(g => 
    g.concepto.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.proveedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🧾 Historial de Gastos</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input 
            type="text" placeholder="Buscar concepto o proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
          />
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap">
          + Nuevo Gasto
        </button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <p className="text-sm text-gray-400 mb-4">💡 Haz doble clic en una fila para ver los detalles y notas del administrador.</p>
        
        {loading ? <p className="text-gray-500">Cargando...</p> : filteredGastos.length === 0 ? <p className="text-gray-500 text-center py-4">No hay gastos registrados.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Cargado</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-center">Cuotas</th>
                  <th className="p-3 text-right">Monto Total</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredGastos.map((g) => (
                  <React.Fragment key={g.gasto_id}>
                    {/* FILA PRINCIPAL (PADRE) */}
                    <tr 
                      onDoubleClick={() => setSelectedGasto(g)} 
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-center" onClick={(e) => toggleRow(g.gasto_id, e)}>
                        <button className="text-gray-400 hover:text-donezo-primary transition-colors text-lg">
                          {expandedRows[g.gasto_id] ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-3 text-gray-500 text-sm">{g.fecha}</td>
                      <td className="p-3 font-bold text-gray-800 dark:text-gray-300">{g.proveedor}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={g.concepto}>{g.concepto}</td>
                      <td className="p-3 text-center">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-3 rounded-full text-xs font-bold">
                          {g.total_cuotas} Mes{g.total_cuotas > 1 ? 'es' : ''}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">${g.monto_total_usd}</td>
                      <td className="p-3 text-center">
                        {g.canDelete ? (
                          <button onClick={(e) => handleDelete(g.gasto_id, e)} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-all" title="Eliminar Gasto">🗑️</button>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 cursor-not-allowed" title="Auditoría: Bloqueado por tener cuotas procesadas">🔒</span>
                        )}
                      </td>
                    </tr>

                    {/* FILAS SECUNDARIAS (HIJOS / CUOTAS) */}
                    {expandedRows[g.gasto_id] && g.cuotas.map((c) => (
                      <tr key={c.cuota_id} className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-50 dark:border-gray-800/50">
                        <td className="p-3 border-l-2 border-donezo-primary"></td>
                        <td className="p-3 text-gray-500 text-sm" colSpan="2">
                          ↳ Proyección: <strong className="text-gray-700 dark:text-gray-300">Ciclo #{c.ciclo_asignado}</strong>
                        </td>
                        <td className="p-3 text-gray-500 text-sm">Fracción {c.numero_cuota} de {g.total_cuotas}</td>
                        <td className="p-3 text-center">
                          <span className={`py-1 px-3 rounded-full text-xs font-bold ${
                            c.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                            c.estado === 'Procesado' || c.estado === 'En Preliminar' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400 font-medium">${c.monto_cuota_usd}</td>
                        <td className="p-3"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR GASTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrar Gasto</h3>
            <p className="text-sm text-gray-500 mb-6">Campos con (<span className="text-red-500">*</span>) son obligatorios.</p>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
                <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white">
                  <option value="">Seleccione un proveedor...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.identificador})</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto / Descripción <span className="text-red-500">*</span></label>
                <input type="text" name="concepto" value={form.concepto} onChange={handleChange} placeholder="Ej: Mantenimiento de Ascensores" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto de la Factura (Bs) <span className="text-red-500">*</span></label>
                <input type="text" name="monto_bs" value={form.monto_bs} onChange={handleMonedaChange} placeholder="Ej: 1.500,50" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tasa de Cambio (BCV) <span className="text-red-500">*</span></label>
                <input type="text" name="tasa_cambio" value={form.tasa_cambio} onChange={handleMonedaChange} placeholder="Ej: 36,45" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Cuotas (Meses) <span className="text-red-500">*</span></label>
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800">
                  <button type="button" onClick={() => handleCuotasChange(-1)} className="px-5 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-colors w-14">-</button>
                  <input type="text" readOnly name="total_cuotas" value={form.total_cuotas} className="w-full text-center py-3 bg-transparent outline-none dark:text-white font-bold" />
                  <button type="button" onClick={() => handleCuotasChange(1)} className="px-5 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-colors w-14">+</button>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna (Opcional)</label>
                <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Ej: Factura Nro 12345, pagado con transferencia..." rows="2" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 transition-all shadow-md">Guardar Gasto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER DETALLES (DOBLE CLIC) */}
      {selectedGasto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative">
            <button onClick={() => setSelectedGasto(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inspección de Gasto</h3>
            
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p><strong className="text-gray-800 dark:text-white">Fecha de Carga:</strong> {selectedGasto.fecha}</p>
              <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> {selectedGasto.proveedor}</p>
              <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {selectedGasto.concepto}</p>
              
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
                <p><strong>Monto Original (Bs):</strong> {selectedGasto.monto_bs}</p>
                <p><strong>Tasa BCV Aplicada:</strong> {selectedGasto.tasa_cambio}</p>
                <p className="text-lg mt-1"><strong className="text-donezo-primary">Total USD:</strong> ${selectedGasto.monto_total_usd}</p>
              </div>
              
              <p><strong className="text-gray-800 dark:text-white">Total Cuotas Creadas:</strong> {selectedGasto.total_cuotas}</p>
              
              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                <strong className="text-gray-800 dark:text-white block mb-1">Nota Adjunta:</strong>
                <p className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl italic text-gray-700 dark:text-gray-300">
                  {selectedGasto.nota || "Sin notas adicionales."}
                </p>
              </div>
            </div>
            <button onClick={() => setSelectedGasto(null)} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition-all">Cerrar Inspección</button>
          </div>
        </div>
      )}
    </div>
  );
}