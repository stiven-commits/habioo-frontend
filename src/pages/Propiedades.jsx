import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';

export default function Propiedades() {
  const { userRole } = useOutletContext();
  const [propiedades, setPropiedades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Paginación y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [editingId, setEditingId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Estados Modales Secundarias
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [selectedPropAjuste, setSelectedPropAjuste] = useState(null);
  const [formAjuste, setFormAjuste] = useState({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });

  const [estadoCuentaModalOpen, setEstadoCuentaModalOpen] = useState(false);
  const [selectedPropCuenta, setSelectedPropCuenta] = useState(null);
  const [estadoCuentaData, setEstadoCuentaData] = useState([]);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const initialForm = {
    identificador: '', alicuota: '', prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '', tiene_inquilino: false, inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '', monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO'
  };

  const [form, setForm] = useState(initialForm);

  const fetchPropiedades = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch('https://auth.habioo.cloud/propiedades-admin', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPropiedades(); }, [userRole]);

  // Regresar a la página 1 si se hace una búsqueda
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchEstadoCuenta = async (propId) => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`https://auth.habioo.cloud/propiedades-admin/${propId}/estado-cuenta`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos);
    } catch (error) { console.error(error); } 
    finally { setLoadingCuenta(false); }
  };

  const handleOpenEstadoCuenta = (prop) => {
    setOpenDropdownId(null);
    setSelectedPropCuenta(prop);
    setFechaDesde(''); setFechaHasta('');
    fetchEstadoCuenta(prop.id);
    setEstadoCuentaModalOpen(true);
  };

  const handleOpenAjuste = (prop) => {
    setSelectedPropAjuste(prop);
    setFormAjuste({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });
    setAjusteModalOpen(true);
  };

  const formatCedula = (val) => {
    let raw = val.toUpperCase().replace(/[^VEJPG0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    if (!['V', 'E', 'J', 'P', 'G'].includes(letra)) return '';
    return `${letra}${raw.slice(1).replace(/[^0-9]/g, '').slice(0, 9)}`;
  };

  const formatAlicuotaDisplay = (value) => {
    if (!value) return '';
    const raw = String(value).replace(',', '.');
    const [entero = '', decimal = ''] = raw.split('.');
    if (!decimal) return entero;
    return `${entero},${decimal.slice(0, 3)}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') setForm({ ...form, [name]: checked });
    else if (name === 'prop_cedula' || name === 'inq_cedula') setForm({ ...form, [name]: formatCedula(value) });
    else if (name === 'alicuota' || name === 'monto_saldo_inicial') {
      let rawVal = value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
      const parts = rawVal.split(',');
      if (parts.length > 2) rawVal = `${parts[0]},${parts.slice(1).join('')}`;
      if (name === 'alicuota') {
         const [entero = '', decimal = ''] = rawVal.split(',');
         rawVal = rawVal.includes(',') ? `${entero},${decimal.slice(0, 3)}` : entero;
      }
      setForm({ ...form, [name]: rawVal });
    } else setForm({ ...form, [name]: value });
  };

  const handleEdit = (prop) => {
    setOpenDropdownId(null);
    setEditingId(prop.id);
    setForm({
      identificador: prop.identificador, alicuota: formatAlicuotaDisplay(prop.alicuota),
      prop_nombre: prop.prop_nombre || '', prop_cedula: prop.prop_cedula || '', prop_email: prop.prop_email || '', prop_telefono: prop.prop_telefono || '', prop_password: '', 
      tiene_inquilino: !!prop.inq_cedula, inq_nombre: prop.inq_nombre || '', inq_cedula: prop.inq_cedula || '', inq_email: prop.inq_email || '', inq_telefono: prop.inq_telefono || '', inq_password: '',
      monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO'
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => { setEditingId(null); setForm(initialForm); setIsModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const alicuotaNum = parseFloat(form.alicuota.toString().replace(',', '.'));
    if (isNaN(alicuotaNum) || alicuotaNum <= 0 || alicuotaNum > 100) return alert('⚠️ Error: La alícuota debe ser un porcentaje mayor a 0 y máximo 100.');
    
    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `https://auth.habioo.cloud/propiedades-admin/${editingId}` : 'https://auth.habioo.cloud/propiedades-admin';
    
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.status === 'success') { setIsModalOpen(false); fetchPropiedades(); } 
    else { alert(data.error || data.message); }
  };

  const handleSubmitAjuste = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Registrar ajuste para ${selectedPropAjuste.identificador}?`)) return;
    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`https://auth.habioo.cloud/propiedades-admin/${selectedPropAjuste.id}/ajustar-saldo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(formAjuste)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message); setAjusteModalOpen(false); fetchPropiedades();
      if (selectedPropCuenta?.id === selectedPropAjuste.id) fetchEstadoCuenta(selectedPropCuenta.id);
    } else alert(data.error);
  };

  // Cálculos de Estado de Cuenta
  let saldoAcumulado = 0;
  const dataConSaldo = estadoCuentaData.map(mov => {
    saldoAcumulado += parseFloat(mov.cargo) - parseFloat(mov.abono);
    return { ...mov, saldoFila: saldoAcumulado };
  });

  const estadoCuentaFiltrado = dataConSaldo.filter(m => {
    if (!fechaDesde && !fechaHasta) return true;
    const f = new Date(m.fecha_registro);
    if (fechaDesde && f < new Date(fechaDesde)) return false;
    if (fechaHasta && f > new Date(fechaHasta)) return false;
    return true;
  });

  const totalCargo = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.abono), 0);

  // Lógica de Paginación para la Tabla Principal
  const filteredProps = propiedades.filter(p => p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredProps.length / itemsPerPage);
  const currentProps = filteredProps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏠 Inmuebles y Residentes</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar apartamento o propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>
        <button onClick={handleCreateNew} className="bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-md">+ Registrar Inmueble</button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando...</p> : currentProps.length === 0 ? <p className="text-gray-500 text-center py-10">No hay inmuebles registrados.</p> : (
          <>
            {/* 💡 Agregado pb-32 para evitar que el dropdown de la última fila se esconda */}
            <div className="overflow-x-auto pb-32 pt-2 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="py-4 pr-3">Inmueble</th>
                    <th className="py-4 px-3 text-right">Alícuota</th>
                    <th className="py-4 px-3 text-right">Saldo Actual</th>
                    <th className="py-4 px-3">Propietario</th>
                    <th className="py-4 pl-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProps.map(p => {
                    const saldo = parseFloat(p.saldo_actual || 0);
                    const isDeuda = saldo > 0;
                    const isFavor = saldo < 0;
                    return (
                      <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 pr-3 font-bold text-gray-800 dark:text-white">{p.identificador}</td>
                        <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{formatAlicuotaDisplay(p.alicuota)}%</td>
                        <td className="py-3 px-3 text-right">
                          <div className={`font-black font-mono tracking-tight ${isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-400'}`}>${formatMoney(Math.abs(saldo))}</div>
                          <div className="text-[10px] uppercase font-bold text-gray-400">{isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Solvente'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre}</div>
                          <div className="text-xs text-gray-500">{p.prop_cedula}</div>
                        </td>
                        <td className="py-3 pl-3 text-center relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">
                            Opciones <span className="text-[9px]">▼</span>
                          </button>
                          {openDropdownId === p.id && (
                            <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn">
                               <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 transition-colors">✏️ Editar Datos</button>
                               <button onClick={(e) => { e.stopPropagation(); handleOpenEstadoCuenta(p); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400 font-bold transition-colors">📄 Estado de Cuenta</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  ← Anterior
                </button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL ESTADO DE CUENTA */}
      {estadoCuentaModalOpen && selectedPropCuenta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
               <div>
                  <h3 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                    {selectedPropCuenta.identificador} <span className="text-gray-300 font-normal">|</span> {selectedPropCuenta.prop_nombre}
                  </h3>
                  {selectedPropCuenta.inq_nombre && (
                    <p className="text-sm font-medium text-gray-500 mt-1">Inquilino Residente: <span className="text-gray-700 dark:text-gray-300">{selectedPropCuenta.inq_nombre}</span></p>
                  )}
               </div>
               <button onClick={() => setEstadoCuentaModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">✕</button>
            </div>

            <div className="px-6 py-4 flex flex-wrap justify-between items-end gap-4 bg-white dark:bg-donezo-card-dark border-b border-gray-100 dark:border-gray-800">
               <div className="flex gap-3 items-center">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
                    <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
                    <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
                  </div>
               </div>
               <button onClick={() => handleOpenAjuste(selectedPropCuenta)} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2">
                 ⚖️ Ajustar Saldo Manual
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-donezo-card-dark custom-scrollbar">
              {loadingCuenta ? <p className="text-center text-gray-400 py-10">Cargando movimientos...</p> : estadoCuentaFiltrado.length === 0 ? <p className="text-center text-gray-400 py-10">No hay movimientos en este rango de fechas.</p> : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-donezo-card-dark shadow-sm">
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                      <th className="p-3 font-bold uppercase text-[11px]">Fecha Op.</th>
                      <th className="p-3 font-bold uppercase text-[11px]">Fecha Sistema</th>
                      <th className="p-3 font-bold uppercase text-[11px]">Concepto</th>
                      <th className="p-3 font-bold uppercase text-[11px] text-right">Cargos (Deuda)</th>
                      <th className="p-3 font-bold uppercase text-[11px] text-right">Abonos (Pago)</th>
                      <th className="p-3 font-bold uppercase text-[11px] text-right text-donezo-primary">Saldo Fila</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estadoCuentaFiltrado.map((m, idx) => (
                      <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{new Date(m.fecha_operacion).toLocaleDateString()}</td>
                        <td className="p-3 text-gray-400 font-mono text-[10px]">{new Date(m.fecha_registro).toLocaleString()}</td>
                        <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{m.tipo === 'RECIBO' ? '📄 ' : m.tipo === 'PAGO' ? '💵 ' : '⚖️ '} {m.concepto}</td>
                        <td className="p-3 text-right text-red-500 font-mono font-medium">{m.cargo > 0 ? `$${formatMoney(m.cargo)}` : '-'}</td>
                        <td className="p-3 text-right text-green-500 font-mono font-medium">{m.abono > 0 ? `$${formatMoney(m.abono)}` : '-'}</td>
                        <td className="p-3 text-right font-mono font-black text-gray-800 dark:text-white">${formatMoney(m.saldoFila)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                      <td colSpan="3" className="p-4 text-right font-black uppercase text-xs text-gray-600 dark:text-gray-300 tracking-wider">TOTALES MOSTRADOS:</td>
                      <td className="p-4 text-right font-black text-red-600 font-mono">${formatMoney(totalCargo)}</td>
                      <td className="p-4 text-right font-black text-green-600 font-mono">${formatMoney(totalAbono)}</td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ISMODALOPEN (CREAR/EDITAR INMUEBLE) - [AQUÍ VA TU <form> IGUAL AL QUE YA TIENES] */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{editingId ? '✏️ Editar Inmueble' : '🏠 Nuevo Inmueble'}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-donezo-primary mb-3 text-sm uppercase tracking-wider">1. Datos del Inmueble</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Identificador *</label><input type="text" name="identificador" value={form.identificador} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Alícuota (%) *</label><input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" required /></div>
                  {!editingId && (
                    <div className="flex gap-2">
                       <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Saldo Inicial (USD)</label><input type="text" name="monto_saldo_inicial" value={form.monto_saldo_inicial} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
                       <div><label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label><select name="tipo_saldo_inicial" value={form.tipo_saldo_inicial} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-bold text-sm"><option value="CERO">Sin Saldo</option><option value="DEUDA">Deuda (-)</option><option value="FAVOR">A Favor (+)</option></select></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-3 text-sm uppercase tracking-wider">2. Datos del Propietario (Login)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Cédula (Usuario) *</label><input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase" required /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label><input type="text" name="prop_nombre" value={form.prop_nombre} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Email</label><input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Teléfono</label><input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
                  {editingId && (<div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800"><label className="block text-xs font-bold text-yellow-800 dark:text-yellow-500 mb-1">🔑 Restablecer Contraseña</label><input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Nueva clave..." className="w-full p-2.5 rounded-xl border border-yellow-300 dark:bg-gray-800 outline-none dark:text-white" /></div>)}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setForm({...form, tiene_inquilino: !form.tiene_inquilino})}><input type="checkbox" checked={form.tiene_inquilino} readOnly className="w-5 h-5 text-donezo-primary" /><h4 className="font-bold text-gray-700 dark:text-gray-300">¿Tiene Inquilino Residente?</h4></div>
                {form.tiene_inquilino && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><input type="text" name="inq_cedula" value={form.inq_cedula} onChange={handleChange} placeholder="Cédula *" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white uppercase" required /><input type="text" name="inq_nombre" value={form.inq_nombre} onChange={handleChange} placeholder="Nombre *" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" required /><input type="email" name="inq_email" value={form.inq_email} onChange={handleChange} placeholder="Email" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" /><input type="text" name="inq_telefono" value={form.inq_telefono} onChange={handleChange} placeholder="Teléfono" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800">Cancelar</button><button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white">{editingId ? 'Guardar Cambios' : 'Registrar Inmueble'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE DE SALDO */}
      {ajusteModalOpen && selectedPropAjuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setAjusteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">⚖️ Ajustar Saldo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inmueble: <strong className="text-donezo-primary">{selectedPropAjuste.identificador}</strong></p>

            <form onSubmit={handleSubmitAjuste} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción a realizar</label>
                <select value={formAjuste.tipo_ajuste} onChange={e => setFormAjuste({...formAjuste, tipo_ajuste: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
                  <option value="CARGAR_DEUDA">🔴 Cargar Deuda (+)</option>
                  <option value="AGREGAR_FAVOR">🟢 Agregar a Favor (-)</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label><input type="text" value={formAjuste.monto} onChange={e => setFormAjuste({...formAjuste, monto: e.target.value.replace(/\./g, ',').replace(/[^0-9,]/g, '')})} placeholder="Ej: 50,00" className="w-full p-3 rounded-xl border font-mono text-lg dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white" required /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (Auditoría) *</label><textarea value={formAjuste.nota} onChange={e => setFormAjuste({...formAjuste, nota: e.target.value})} placeholder="Ej: Cobro de multa" className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white text-sm min-h-[80px]" required /></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setAjusteModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800">Cancelar</button><button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-yellow-500 text-white">Aplicar Ajuste</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}