import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

// Helper para dar formato a los meses en la tabla
const formatMonthText = (yyyy_mm) => {
    if (!yyyy_mm) return '';
    const [year, month] = yyyy_mm.split('-');
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${meses[parseInt(month) - 1]} ${year}`;
};
export default function Gastos() {
  const { userRole } = useOutletContext();
  const [gastosAgrupados, setGastosAgrupados] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- NUEVOS ESTADOS: Pestañas y Paginación ---
  const [activeTab, setActiveTab] = useState('Todos'); // 'Todos', 'Comun', 'No Comun'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modales y Acordeón
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState(null); 
  const [expandedRows, setExpandedRows] = useState({});
  const [facturaFile, setFacturaFile] = useState(null); // Para la factura (1)
  const [soportesFiles, setSoportesFiles] = useState([]); // Para soportes (Máx 4)
  const todayString = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '',
    zona_id: '',
    fecha_gasto: todayString // Por defecto, hoy
  });
  // === NUEVO: CALCULADORA EN TIEMPO REAL ===
  const montoBsNum = parseFloat(form.monto_bs.replace(/\./g, '').replace(',', '.')) || 0;
  const tasaNum = parseFloat(form.tasa_cambio.replace(/\./g, '').replace(',', '.')) || 0;
  const equivalenteUSD = tasaNum > 0 ? (montoBsNum / tasaNum).toFixed(2) : '0.00';
  
  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resGastos, resProv, resZonas] = await Promise.all([
        fetch('https://auth.habioo.cloud/gastos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/proveedores', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/zonas', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const dataGastos = await resGastos.json();
      const dataProv = await resProv.json();
      const dataZonas = await resZonas.json();

      if (dataGastos.status === 'success') {
        const agrupados = dataGastos.gastos.reduce((acc, curr) => {
          if (!acc[curr.gasto_id]) {
            acc[curr.gasto_id] = {
              gasto_id: curr.gasto_id,
              proveedor: curr.proveedor,
              concepto: curr.concepto,
              fecha: curr.fecha_factura || curr.fecha || 'N/A',
              fecha_factura: curr.fecha_factura || curr.fecha || 'N/A',
              fecha_registro: curr.fecha_registro || 'N/A',
              imagenes: Array.isArray(curr.imagenes) ? curr.imagenes : [],
              monto_bs: curr.monto_bs,
              tasa_cambio: curr.tasa_cambio,
              monto_total_usd: curr.monto_total_usd,
              total_cuotas: curr.total_cuotas,
              nota: curr.nota,
              tipo: curr.tipo || 'Comun', // Aquí recibimos el dato corregido del backend
              zona_nombre: curr.zona_nombre,
              cuotas: [],
              canDelete: true
            };
          }
          acc[curr.gasto_id].cuotas.push(curr);
          if (curr.estado !== 'Pendiente') acc[curr.gasto_id].canDelete = false;
          return acc;
        }, {});
        setGastosAgrupados(Object.values(agrupados));
      }
      
      if (dataProv.status === 'success') setProveedores(dataProv.proveedores);
      if (dataZonas.status === 'success') setZonas(dataZonas.zonas.filter(z => z.activa));

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  // --- LÓGICA DE FILTRADO Y PAGINACIÓN ---
  
  // Resetear a página 1 si cambia el filtro
  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab]);

  const filteredGastos = gastosAgrupados.filter(g => {
    const matchesSearch = g.concepto.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          g.proveedor.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'Todos') return matchesSearch;
    return matchesSearch && g.tipo === activeTab;
  });

  const totalPages = Math.ceil(filteredGastos.length / ITEMS_PER_PAGE);
  const paginatedGastos = filteredGastos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  // --- HANDLERS ---

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (['concepto', 'nota'].includes(name) && value.length > 0) {
      setForm({ ...form, [name]: value.charAt(0).toUpperCase() + value.slice(1) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleMonedaChange = (e) => setForm({ ...form, [e.target.name]: formatCurrencyInput(e.target.value) });
  
  const handleCuotasChange = (delta) => {
    let next = (parseInt(form.total_cuotas) || 1) + delta;
    if (next >= 1 && next <= 24) setForm({ ...form, total_cuotas: next.toString() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    
    const formData = new FormData();
    Object.keys(form).forEach(key => formData.append(key, form[key]));
    
    // Adjuntamos la Factura (Solo 1)
    if (facturaFile) formData.append('factura_img', facturaFile);
    
    // Adjuntamos los Soportes Adicionales
    soportesFiles.forEach(file => formData.append('soportes', file));

    const res = await fetch('https://auth.habioo.cloud/gastos', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }, 
      body: formData
    });

    if (res.ok) {
      setForm({ proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '', zona_id: '', fecha_gasto: todayString });
      setFacturaFile(null);
      setSoportesFiles([]);
      setIsModalOpen(false);
      fetchData(); // <--- CÁMBIALO AL NOMBRE CORRECTO (Generalmente es fetchData)
    }
  };

  const handleDelete = async (gasto_id, e) => {
    e.stopPropagation();
    if (!window.confirm('?? ¿Eliminar este gasto y todas sus cuotas?')) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/gastos/${gasto_id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const result = await res.json();
      if (result.status === 'success') fetchData();
      else alert(result.message);
    } catch (error) { alert('Error de conexión'); }
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  return (
    <div className="space-y-6 relative">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">?? Historial de Gastos</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">??</span>
          <input 
            type="text" placeholder="Buscar concepto, proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
          />
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap">
          + Nuevo Gasto
        </button>
      </div>

      {/* TABLA CON PESTAÑAS */}
      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        
        {/* PESTAÑAS SUPERIORES */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-4 gap-6">
          {['Todos', 'Comun', 'No Comun'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 font-bold text-sm transition-all relative ${
                activeTab === tab 
                  ? 'text-donezo-primary' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'Comun' ? 'Gastos Comunes' : tab === 'No Comun' ? 'Gastos No Comunes' : 'Todos'}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary rounded-t-full"></span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? <p className="text-gray-500">Cargando...</p> : filteredGastos.length === 0 ? <p className="text-gray-500 text-center py-8">No se encontraron gastos en esta categoría.</p> : (
            <>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse select-none">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Fechas</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3 text-center">Cuotas</th>
                      <th className="p-3 text-right">Por Pagar</th>
                      <th className="p-3 text-right">Monto Total</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGastos.map((g) => (
                      <React.Fragment key={g.gasto_id}>
                        <tr onDoubleClick={() => setSelectedGasto(g)} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                          <td className="p-3 text-center" onClick={(e) => toggleRow(g.gasto_id, e)}>
                            <button className="text-gray-400 hover:text-donezo-primary transition-colors text-lg">
                              {expandedRows[g.gasto_id] ? '▼' : '▶'}
                            </button>
                          </td>
                          
                          {/* AQUÍ ESTÁ LA CELDA DE FECHAS CORREGIDA (Ya no hay otra celda de fecha suelta) */}
                          <td className="p-3">
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-300" title="Fecha de Factura">📄 {g.fecha_factura || 'N/A'}</span>
                            <span className="block text-[10px] text-gray-400" title="Fecha de Registro en Sistema">💻 {g.fecha_registro}</span>
                          </td>
                          
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-300">{g.proveedor}</td>
                          
                          <td className="p-3">
                            <div className="text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={g.concepto}>{g.concepto}</div>
                            {g.tipo === 'No Comun' && (
                              <span className="inline-block mt-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Zona: {g.zona_nombre || 'Específica'}
                              </span>
                            )}
                          </td>
                          
                          <td className="p-3 text-center">
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-3 rounded-full text-xs font-bold">
                              {g.total_cuotas} Mes{g.total_cuotas > 1 ? 'es' : ''}
                            </span>
                          </td>
                          
                          <td className="p-3 text-right font-medium text-orange-400 dark:text-orange-300">
                            ${parseFloat(g.cuotas[0]?.saldo_pendiente || 0).toFixed(2)}
                          </td>
                          
                          <td className="p-3 text-right font-bold text-gray-800 dark:text-white">${g.monto_total_usd}</td>
                          
                          <td className="p-3 text-center">
                            {g.canDelete ? (
                              <button onClick={(e) => handleDelete(g.gasto_id, e)} className="text-red-400 hover:text-red-600 p-2" title="Eliminar">🗑️</button>
                            ) : <span className="text-gray-300 cursor-not-allowed" title="Bloqueado">🔒</span>}
                          </td>
                        </tr>
                        
                        {/* FILAS HIJAS (Desglose de Cuotas) */}
                        {expandedRows[g.gasto_id] && g.cuotas.map((c) => (
                          <tr key={c.cuota_id} className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-50 dark:border-gray-800/50">
                            <td className="p-3 border-l-2 border-donezo-primary"></td>
                            <td className="p-3 text-gray-500 text-sm" colSpan="2">↳ Cobro en: <strong>{formatMonthText(c.mes_asignado)}</strong></td>
                            <td className="p-3 text-gray-500 text-sm">Fracción {c.numero_cuota}/{g.total_cuotas}</td>
                            <td className="p-3 text-center"><span className="text-xs font-bold bg-white dark:bg-gray-700 px-2 py-1 rounded">{c.estado}</span></td>
                            
                            <td className="p-3 text-right text-gray-400 text-xs">
                              Restan: ${(parseFloat(c.saldo_pendiente)).toFixed(2)}
                            </td>

                            <td className="p-3 text-right text-gray-600 dark:text-gray-400 font-medium">${c.monto_cuota_usd}</td>
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-sm text-gray-500">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* MODAL REGISTRO (Mismo que antes) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">?</button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrar Gasto</h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
                <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white">
                  <option value="">Seleccione...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.identificador})</option>)}
                </select>
              </div>

              {/* Concepto y Fecha */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto <span className="text-red-500">*</span></label>
                  <input type="text" name="concepto" value={form.concepto} onChange={handleChange} placeholder="Ej: Reparación de tubería..." required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Factura <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      name="fecha_gasto" 
                      value={form.fecha_gasto} 
                      onChange={handleChange} 
                      max={todayString} /* ESTA ES LA MAGIA QUE BLOQUEA EL FUTURO */
                      required 
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" 
                    />
                </div>
              </div>

              {/* MONTO, TASA Y CALCULADORA */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto (Bs) <span className="text-red-500">*</span></label>
                  <input type="text" name="monto_bs" value={form.monto_bs} onChange={handleMonedaChange} placeholder="0,00" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tasa BCV <span className="text-red-500">*</span></label>
                  <input type="text" name="tasa_cambio" value={form.tasa_cambio} onChange={handleMonedaChange} placeholder="0,00" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
                </div>
                
                {/* WIDGET DEL EQUIVALENTE EN USD */}
                <div className="md:col-span-2 flex justify-end -mt-3 mb-2">
                   <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-green-200 dark:border-green-800/50">
                     Equivalente: ${equivalenteUSD} USD
                   </span>
                </div>
              </div>

              {/* SECCIÓN CUOTAS Y ZONAS */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                
                {/* WIDGET CUOTAS */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Diferir en Cuotas</label>
                  <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                    <button type="button" onClick={() => handleCuotasChange(-1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-lg font-bold">-</button>
                    <input type="text" readOnly value={`${form.total_cuotas} Mes(es)`} className="w-full text-center bg-transparent font-medium dark:text-white" />
                    <button type="button" onClick={() => handleCuotasChange(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-lg font-bold">+</button>
                  </div>
                </div>

                {/* SELECTOR DE ZONA */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                    Asignación
                    {form.zona_id && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 rounded-full">Gasto No Común</span>}
                  </label>
                  
                  {form.zona_id === '' ? (
                    <button 
                      type="button" 
                      onClick={() => setForm({...form, zona_id: zonas[0]?.id || 'error'})} 
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-donezo-primary hover:text-donezo-primary transition-all font-medium text-sm flex items-center justify-center gap-2"
                    >
                      ?? Asignar a Zona
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <select 
                        name="zona_id" 
                        value={form.zona_id} 
                        onChange={handleChange} 
                        className="flex-1 p-2.5 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                        required
                      >
                        {zonas.length === 0 && <option value="error">No hay zonas</option>}
                        {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                      </select>
                      <button 
                        type="button" 
                        onClick={() => setForm({...form, zona_id: ''})} 
                        className="px-3 bg-red-100 text-red-500 hover:bg-red-200 rounded-xl font-bold"
                      >?</button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna</label>
                <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows="2" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
              </div>

              {/* SECCIÓN DE FOTOS */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
                {/* FACTURA PRINCIPAL */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    📸 Factura Principal (1 foto)
                  </label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setFacturaFile(e.target.files[0] || null)}
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-xs"
                  />
                </div>

                {/* SOPORTES ADICIONALES */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    📎 Soportes Adicionales (Máx 4)
                  </label>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={(e) => {
                      const seleccionadas = Array.from(e.target.files);
                      if (seleccionadas.length > 4) {
                          alert("Solo se permiten 4 soportes como máximo.");
                          e.target.value = "";
                          setSoportesFiles([]);
                      } else {
                          setSoportesFiles(seleccionadas);
                      }
                    }}
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 text-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 dark:text-gray-300">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 shadow-md">Guardar Gasto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLES */}
      {selectedGasto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setSelectedGasto(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inspección de Gasto</h3>
            
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              
              {/* ENCABEZADO Y FECHAS */}
              <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-3">
                <div>
                  <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> <br/>{selectedGasto.proveedor}</p>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-gray-500">Factura: <strong className="text-gray-800 dark:text-gray-300">{selectedGasto.fecha_factura || 'N/A'}</strong></span>
                  <span className="block text-[10px] text-gray-400">Sistema: {selectedGasto.fecha_registro}</span>
                </div>
              </div>
              
              <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {selectedGasto.concepto}</p>
              
              {/* DESGLOSE CONTABLE */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 text-xs">
                   <p className="text-gray-500">Monto Base: <br/><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {selectedGasto.monto_bs}</strong></p>
                   <span className="text-gray-300 dark:text-gray-600">÷</span>
                   <p className="text-right text-gray-500">Tasa Aplicada: <br/><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {selectedGasto.tasa_cambio}</strong></p>
                </div>
                <p className="flex justify-between">
                  <strong>Monto Total de Factura:</strong> 
                  <span className="text-lg font-black text-gray-800 dark:text-white">${selectedGasto.monto_total_usd}</span>
                </p>
              </div>

            </div>

            {/* FOTOS Y SOPORTES */}
            <div className="mt-4 space-y-4">
              {selectedGasto.factura_img && (
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Factura Original</p>
                  <a href={`https://auth.habioo.cloud${selectedGasto.factura_img}`} target="_blank" rel="noreferrer">
                    <img src={`https://auth.habioo.cloud${selectedGasto.factura_img}`} alt="Factura" className="w-full h-32 object-cover rounded-xl border border-blue-200 shadow-sm hover:opacity-90 transition-opacity"/>
                  </a>
                </div>
              )}
              {selectedGasto.imagenes && selectedGasto.imagenes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Soportes Adjuntos</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {selectedGasto.imagenes.map((img, idx) => (
                      <a key={idx} href={`https://auth.habioo.cloud${img}`} target="_blank" rel="noreferrer" className="flex-shrink-0">
                        <img src={`https://auth.habioo.cloud${img}`} alt={`Soporte ${idx+1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm hover:scale-105 transition-transform"/>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setSelectedGasto(null)} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
