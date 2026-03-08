import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalFondos from '../components/ModalFondos';
import { formatMoney } from '../utils/currency';

export default function Bancos() {
  const { userRole } = useOutletContext();
  const [bancos, setBancos] = useState([]);
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBancoForFondos, setSelectedBancoForFondos] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({
    tipo: 'Transferencia', 
    nombre_banco: '', 
    apodo: '', 
    nombre_titular: '', 
    cedula_rif: '', 
    numero_cuenta: '', 
    telefono: ''
  });

  // Lista oficial de Bancos de Venezuela
  const bancosVenezuela = [
    "0102 - Banco de Venezuela",
    "0104 - Banco Venezolano de Crédito",
    "0105 - Banco Mercantil",
    "0108 - Banco Provincial",
    "0114 - Banco del Caribe",
    "0115 - Banco Exterior",
    "0128 - Banco Caroní",
    "0134 - Banesco",
    "0137 - Banco Sofitasa",
    "0138 - Banco Plaza",
    "0146 - Banco de la Gente Emprendedora (Bangente)",
    "0151 - BFC Banco Fondo Común",
    "0156 - 100% Banco",
    "0157 - DelSur Banco Universal",
    "0163 - Banco del Tesoro",
    "0166 - Banco Agrícola de Venezuela",
    "0168 - Bancrecer",
    "0169 - Mi Banco",
    "0171 - Banco Activo",
    "0172 - Bancamiga",
    "0174 - Banplus",
    "0175 - Banco Bicentenario",
    "0177 - Banco de la Fuerza Armada Nacional Bolivariana",
    "0191 - Banco Nacional de Crédito (BNC)"
  ];

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resBancos, resFondos] = await Promise.all([
        fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/fondos', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const dataBancos = await resBancos.json();
      const dataFondos = await resFondos.json();

      if (dataBancos.status === 'success') setBancos(dataBancos.bancos);
      if (dataFondos.status === 'success') setFondos(dataFondos.fondos);
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el tipo, limpiamos el nombre del banco para evitar inconsistencias
    if (name === 'tipo') {
      setForm({ ...form, tipo: value, nombre_banco: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleCedulaChange = (e) => {
    let val = e.target.value.toUpperCase();
    val = val.replace(/[^JVEG0-9-]/g, '');
    if (val.length > 0 && !/^[JVEG]/.test(val[0])) val = '';
    if (val.length === 1 && /^[JVEG]$/.test(val)) val += '-';
    else if (val.length > 1 && val[1] !== '-') val = val[0] + '-' + val.slice(1).replace(/-/g, '');
    setForm({ ...form, cedula_rif: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/bancos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setForm({ tipo: 'Transferencia', nombre_banco: '', apodo: '', nombre_titular: '', cedula_rif: '', numero_cuenta: '', telefono: '' });
        setShowForm(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al guardar la cuenta');
      }
    } catch (error) { alert('Error de conexión al guardar el banco'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ ¿Estás seguro de eliminar esta cuenta bancaria? Solo se podrá si sus fondos no tienen movimientos.')) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/bancos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.status === 'success') fetchData();
      else alert(`Error: ${data.message || 'No se pudo eliminar la cuenta'}`);
    } catch (error) { alert('Error de conexión al eliminar'); }
  };

  const handleSetPredeterminada = async (id) => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/bancos/${id}/predeterminada`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) fetchData();
    } catch (error) { console.error('Error al actualizar cuenta principal:', error); }
  };

  const renderSaldosCuenta = (cuentaId) => {
    const fondosCuenta = fondos.filter(f => f.cuenta_bancaria_id === cuentaId);
    if (fondosCuenta.length === 0) return <p className="text-sm text-gray-400 italic text-center">Sin fondos registrados</p>;
    const saldos = fondosCuenta.reduce((acc, f) => {
      acc[f.moneda] = (acc[f.moneda] || 0) + parseFloat(f.saldo_actual || 0);
      return acc;
    }, {});

    return (
      <div className="space-y-1.5">
        {Object.entries(saldos).map(([moneda, monto]) => (
          <div key={moneda} className="flex justify-between items-center gap-6 border-b border-gray-200 dark:border-gray-700/50 pb-1 last:border-0 last:pb-0">
            <span className="text-xs font-bold text-gray-500">{moneda}</span>
            <span className={`font-black tracking-tight ${moneda === 'USD' || moneda === 'EUR' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
              {formatMoney(monto)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (userRole !== 'Administrador') return <p className="p-6 text-gray-500">No tienes permisos para ver esta sección.</p>;
  if (loading) return <p className="p-6 text-gray-500">Cargando cuentas...</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Cuentas Bancarias</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 font-bold py-2 px-5 rounded-xl transition-all shadow-md text-sm flex items-center gap-2">
          {showForm ? '✕ Cancelar' : '+ Agregar Cuenta'}
        </button>
      </div>

      {/* FORMULARIO DINÁMICO */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Nueva Cuenta Bancaria</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             {/* 1. TIPO DE CUENTA */}
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Cuenta *</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} required className="w-full p-3 bg-blue-50 dark:bg-gray-800 text-blue-800 dark:text-white border border-blue-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                  <option value="Transferencia" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Transferencia (Bs)</option>
                  <option value="Pago Movil" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Pago Móvil (Bs)</option>
                  <option value="Zelle" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Zelle (USD)</option>
                  <option value="Efectivo" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Efectivo / Caja Fuerte</option>
                </select>
             </div>

             {/* 2. SELECTOR DE BANCO O INPUT SEGÚN EL TIPO */}
             {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Institución Bancaria *</label>
                  <select name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
                    <option value="" disabled className="text-gray-400">Seleccione el banco...</option>
                    {bancosVenezuela.map(banco => (
                      <option key={banco} value={banco} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{banco}</option>
                    ))}
                  </select>
               </div>
             )}

             {form.tipo === 'Zelle' && (
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Banco (EEUU) *</label>
                  <input type="text" name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required placeholder="Ej: Wells Fargo, BofA..." className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
               </div>
             )}
             
             {/* Para Efectivo no mostramos el banco */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apodo (Referencia) *</label><input type="text" name="apodo" value={form.apodo} onChange={handleChange} required placeholder={form.tipo === 'Efectivo' ? 'Ej: Caja Chica Conserjería' : 'Ej: Principal / Pagos Bs'} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{form.tipo === 'Efectivo' ? 'Custodio / Responsable *' : 'Nombre del Titular *'}</label><input type="text" name="nombre_titular" value={form.nombre_titular} onChange={handleChange} required placeholder="Ej: Junta de Condominio" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>

            {/* Cédula RIF solo para transacciones nacionales */}
            {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cédula / RIF *</label><input type="text" name="cedula_rif" value={form.cedula_rif} onChange={handleCedulaChange} required placeholder="Ej: J-123456789" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {/* Campos condicionales específicos */}
            {form.tipo === 'Transferencia' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de Cuenta *</label><input type="text" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="20 dígitos" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {form.tipo === 'Pago Movil' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono *</label><input type="text" name="telefono" value={form.telefono} onChange={handleChange} required placeholder="Ej: 0414-1234567" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {form.tipo === 'Zelle' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico *</label><input type="email" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="correo@zelle.com" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
            )}
          </div>
          <button type="submit" className="w-full md:w-auto bg-donezo-primary hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg">Guardar Configuración</button>
        </form>
      )}

      {/* TARJETAS DE BANCOS */}
      {bancos.length === 0 ? <p className="text-gray-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">No hay cuentas registradas.</p> : (
        <div className="flex flex-col gap-5">
          {bancos.map(b => (
            <div key={b.id} className={`bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-6 justify-between xl:items-center transition-all ${b.es_predeterminada ? 'border-green-400 dark:border-green-600 bg-green-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{b.nombre_banco || 'Efectivo'}</h3>
                  <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] uppercase font-bold px-2.5 py-1 rounded-md shadow-sm">{b.tipo || 'N/A'}</span>
                  <span className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-[11px] uppercase font-bold px-2.5 py-1 rounded-md">{b.apodo}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong className="text-gray-800 dark:text-gray-300 font-medium">Titular/Custodio:</strong> {b.nombre_titular}</p>
                  {b.cedula_rif && <p><strong className="text-gray-800 dark:text-gray-300 font-medium">CI/RIF:</strong> {b.cedula_rif}</p>}
                  {b.numero_cuenta && <p><strong className="text-gray-800 dark:text-gray-300 font-medium">{b.tipo === 'Zelle' ? 'Correo:' : 'N° Cuenta:'}</strong> {b.numero_cuenta}</p>}
                  {b.telefono && <p><strong className="text-gray-800 dark:text-gray-300 font-medium">Teléfono:</strong> {b.telefono}</p>}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-w-[240px] border border-gray-100 dark:border-gray-700/50">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3 flex items-center justify-center gap-1.5">
                   <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                   Saldos Virtuales
                </p>
                {renderSaldosCuenta(b.id)}
              </div>

              <div className="flex flex-col gap-2 min-w-[220px]">
                <button onClick={() => setSelectedBancoForFondos(b)} className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 text-[11px] uppercase tracking-wide font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  Gestionar Fondos
                </button>

                <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  {b.es_predeterminada ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[11px] font-bold px-3 py-2.5 cursor-default border-r border-gray-200 dark:border-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Principal
                    </div>
                  ) : (
                    <button onClick={() => handleSetPredeterminada(b.id)} className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 font-bold bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-3 py-2.5 transition-colors border-r border-gray-200 dark:border-gray-700">Hacer Principal</button>
                  )}
                  <button onClick={() => handleDelete(b.id)} className="flex items-center justify-center px-4 py-2 bg-gray-50 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-sm transition-colors" title="Eliminar cuenta">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBancoForFondos && <ModalFondos cuenta={selectedBancoForFondos} onClose={() => { setSelectedBancoForFondos(null); fetchData(); }} />}
    </div>
  );
}