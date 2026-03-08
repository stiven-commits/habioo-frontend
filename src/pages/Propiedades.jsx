import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';

export default function Propiedades() {
  const { userRole } = useOutletContext();
  const [propiedades, setPropiedades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState(null);

  // Estados para la Modal de Ajuste de Saldo
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [selectedPropAjuste, setSelectedPropAjuste] = useState(null);
  const [formAjuste, setFormAjuste] = useState({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });

  const initialForm = {
    identificador: '', alicuota: '',
    prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false,
    inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '',
    monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO' // <-- Nuevos campos para creación
  };

  const [form, setForm] = useState(initialForm);

  const fetchPropiedades = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchPropiedades();
  }, [userRole]);

  const formatCedula = (val) => {
    let raw = val.toUpperCase().replace(/[^VEJPG0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    if (!['V', 'E', 'J', 'P', 'G'].includes(letra)) return '';
    const numeros = raw.slice(1).replace(/[^0-9]/g, '').slice(0, 9);
    return `${letra}${numeros}`;
  };

  const formatAlicuotaDisplay = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const raw = String(value).replace(',', '.');
    const [entero = '', decimal = ''] = raw.split('.');
    if (!decimal) return entero;
    return `${entero},${decimal.slice(0, 3)}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setForm({ ...form, [name]: checked });
    } else if (name === 'prop_cedula' || name === 'inq_cedula') {
      setForm({ ...form, [name]: formatCedula(value) });
    } else if (name === 'alicuota' || name === 'monto_saldo_inicial') {
      // Comparte la misma limpieza de números
      let rawVal = value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
      const parts = rawVal.split(',');
      if (parts.length > 2) rawVal = `${parts[0]},${parts.slice(1).join('')}`;
      
      if (name === 'alicuota') {
         const [entero = '', decimal = ''] = rawVal.split(',');
         const hasComma = rawVal.includes(',');
         rawVal = hasComma ? `${entero},${decimal.slice(0, 3)}` : entero;
      }
      setForm({ ...form, [name]: rawVal });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleEdit = (prop) => {
    setEditingId(prop.id);
    setForm({
      identificador: prop.identificador,
      alicuota: (prop.alicuota ?? '').toString().replace('.', ','),
      prop_nombre: prop.prop_nombre || '',
      prop_cedula: prop.prop_cedula || '',
      prop_email: prop.prop_email || '',
      prop_telefono: prop.prop_telefono || '',
      prop_password: '', 
      tiene_inquilino: !!prop.inq_cedula, 
      inq_nombre: prop.inq_nombre || '',
      inq_cedula: prop.inq_cedula || '',
      inq_email: prop.inq_email || '',
      inq_telefono: prop.inq_telefono || '',
      inq_password: '',
      monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO'
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const alicuotaStr = form.alicuota.toString().replace(',', '.');
    const alicuotaNum = parseFloat(alicuotaStr);

    if (isNaN(alicuotaNum) || alicuotaNum <= 0 || alicuotaNum > 100) {
      alert('Error: La alícuota debe ser un porcentaje mayor a 0 y máximo 100.');
      return;
    }

    const decimalParts = alicuotaStr.split('.');
    if (decimalParts.length > 1 && decimalParts[1].length > 3) {
      alert('Error: La alícuota no puede tener más de 3 decimales (Ejemplo válido: 2,555).');
      return;
    }

    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `${API_BASE_URL}/propiedades-admin/${editingId}` : `${API_BASE_URL}/propiedades-admin`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.status === 'success') {
      setIsModalOpen(false);
      fetchPropiedades();
    } else { alert(data.message || data.error); }
  };

  // --- LÓGICA DE AJUSTE DE SALDO ---
  const handleOpenAjuste = (prop) => {
    setSelectedPropAjuste(prop);
    setFormAjuste({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });
    setAjusteModalOpen(true);
  };

  const handleSubmitAjuste = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Está seguro de registrar este ajuste para ${selectedPropAjuste.identificador}? Quedará guardado en la auditoría.`)) return;

    try {
      const token = localStorage.getItem('habioo_token');
      const endpoint = `${API_BASE_URL}/propiedades-admin/${selectedPropAjuste.id}/ajustar-saldo`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formAjuste)
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : { error: await res.text() };

      if (!res.ok) {
        const message = payload?.message || payload?.error || `Error ${res.status}`;
        throw new Error(message);
      }

      if (payload.status === 'success') {
        alert(payload.message);
        setAjusteModalOpen(false);
        fetchPropiedades();
      } else {
        throw new Error(payload?.message || payload?.error || 'No se pudo aplicar el ajuste.');
      }
    } catch (err) {
      console.error('Error al aplicar ajuste de saldo:', err);
      alert(`No se pudo aplicar el ajuste.\n${err.message}`);
    }
  };

  const filteredProps = propiedades.filter(p => p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏠 Inmuebles y Residentes</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar apartamento o propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>
        <button onClick={handleCreateNew} className="bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap shadow-md">+ Registrar Inmueble</button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 dark:text-gray-400">Cargando...</p> : filteredProps.length === 0 ? <p className="text-gray-500 text-center py-4 dark:text-gray-400">No hay inmuebles registrados.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="p-3">Inmueble</th>
                  <th className="p-3 text-right">Alícuota</th>
                  <th className="p-3 text-right">Saldo Actual</th>
                  <th className="p-3">Propietario</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProps.map(p => {
                  const saldo = parseFloat(p.saldo_actual || 0);
                  const isDeuda = saldo > 0;
                  const isFavor = saldo < 0;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-bold text-gray-800 dark:text-white">{p.identificador}</td>
                      <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{formatAlicuotaDisplay(p.alicuota)}%</td>
                      
                      {/* COLUMNA DE SALDO */}
                      <td className="p-3 text-right">
                        <div className={`font-black font-mono tracking-tight ${isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-400'}`}>
                          ${formatMoney(Math.abs(saldo))}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-gray-400">
                          {isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Solvente'}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.prop_cedula} • {p.prop_telefono || 'Sin Tlf'}</div>
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEdit(p)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold uppercase" title="Editar Datos">
                          ✏️ Editar
                        </button>
                        <button onClick={() => handleOpenAjuste(p)} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold uppercase border border-yellow-200 dark:border-yellow-800/50" title="Ajustar Saldo Manualmente">
                          ⚖️ Ajustar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PRINCIPAL: REGISTRO / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
              {editingId ? '✏️ Editar Inmueble' : '🏠 Nuevo Inmueble'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-donezo-primary mb-3 text-sm uppercase tracking-wider">1. Datos del Inmueble</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Identificador <span className="text-red-500">*</span></label>
                    <input type="text" name="identificador" value={form.identificador} onChange={handleChange} placeholder="Ej: Apto 5B" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Alícuota (%) <span className="text-red-500">*</span></label>
                    <input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} placeholder="Ej: 2,555" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" required />
                  </div>

                  {/* SALDO INICIAL SOLO AL CREAR */}
                  {!editingId && (
                    <div className="flex gap-2">
                       <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Saldo Inicial (USD)</label>
                          <input type="text" name="monto_saldo_inicial" value={form.monto_saldo_inicial} onChange={handleChange} placeholder="0,00" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
                          <select name="tipo_saldo_inicial" value={form.tipo_saldo_inicial} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-bold text-sm">
                             <option value="CERO">Sin Saldo</option>
                             <option value="DEUDA">Deuda (-)</option>
                             <option value="FAVOR">A Favor (+)</option>
                          </select>
                       </div>
                    </div>
                  )}
                </div>
              </div>

              {/* [SE MANTIENE IGUAL EL CÓDIGO DE PROPIETARIO E INQUILINO] */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-3 text-sm uppercase tracking-wider">2. Datos del Propietario (Login)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Cédula (Usuario) <span className="text-red-500">*</span></label>
                    <input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} placeholder="Ej: V12345678" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                    <input type="text" name="prop_nombre" value={form.prop_nombre} onChange={handleChange} placeholder="Ej: Juan Pérez" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Email</label>
                    <input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} placeholder="juan@gmail.com" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Teléfono</label>
                    <input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} placeholder="0414-1234567" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                  </div>
                  {editingId && (
                    <div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800">
                      <label className="block text-xs font-bold text-yellow-800 dark:text-yellow-500 mb-1">🔑 Restablecer Contraseña (Opcional)</label>
                      <input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Escriba nueva clave solo si desea cambiarla" className="w-full p-2.5 rounded-xl border border-yellow-300 dark:border-yellow-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-yellow-500 dark:text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN INQUILINO */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setForm({...form, tiene_inquilino: !form.tiene_inquilino})}>
                  <input type="checkbox" name="tiene_inquilino" checked={form.tiene_inquilino} readOnly className="w-5 h-5 text-donezo-primary rounded cursor-pointer" />
                  <h4 className="font-bold text-gray-700 dark:text-gray-300 select-none">¿Tiene Inquilino Residente?</h4>
                </div>
                {form.tiene_inquilino && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fadeIn">
                    {/* ... (Los inputs del inquilino igual que los tenías) ... */}
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Cédula Inquilino *</label><input type="text" name="inq_cedula" value={form.inq_cedula} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase" required /></div>
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Nombre Inquilino *</label><input type="text" name="inq_nombre" value={form.inq_nombre} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required /></div>
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Email</label><input type="email" name="inq_email" value={form.inq_email} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Teléfono</label><input type="text" name="inq_telefono" value={form.inq_telefono} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 shadow-md transition-all">
                  {editingId ? 'Guardar Cambios' : 'Registrar Inmueble'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE DE SALDO */}
      {ajusteModalOpen && selectedPropAjuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative">
            <button onClick={() => setAjusteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">⚖️ Ajustar Saldo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inmueble: <strong className="text-donezo-primary">{selectedPropAjuste.identificador}</strong></p>

            <form onSubmit={handleSubmitAjuste} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción a realizar</label>
                <select 
                  value={formAjuste.tipo_ajuste} 
                  onChange={e => setFormAjuste({...formAjuste, tipo_ajuste: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                >
                  <option value="CARGAR_DEUDA">🔴 Aumentar Deuda (Cargo)</option>
                  <option value="AGREGAR_FAVOR">🟢 Aumentar Saldo a Favor (Abono)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto del Ajuste ($)</label>
                <input 
                  type="text" 
                  value={formAjuste.monto} 
                  onChange={e => {
                    let val = e.target.value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
                    setFormAjuste({...formAjuste, monto: val})
                  }} 
                  placeholder="Ej: 50,00" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-lg" required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota Justificativa (Auditoría) *</label>
                <textarea 
                  value={formAjuste.nota} 
                  onChange={e => setFormAjuste({...formAjuste, nota: e.target.value})} 
                  placeholder="Ej: Cobro de multa por ruido / Devolución por pago doble" 
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white text-sm min-h-[80px]" required 
                />
              </div>

              <div className="pt-4 flex gap-3">
                 <button type="button" onClick={() => setAjusteModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">Cancelar</button>
                 <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-yellow-500 text-white hover:bg-yellow-600 shadow-md shadow-yellow-500/30">Aplicar Ajuste</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}


