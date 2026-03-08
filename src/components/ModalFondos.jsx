import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/currency';

export default function ModalFondos({ cuenta, onClose }) {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nombre: '',
    moneda: 'BS', 
    porcentaje: '',
    saldo_inicial: '0',
    es_operativo: false
  });

  const fetchFondos = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/fondos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        const fondosCuenta = data.fondos.filter(f => f.cuenta_bancaria_id === cuenta.id);
        setFondos(fondosCuenta);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFondos();
  }, [cuenta.id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // 💡 SOLUCIÓN: Si activan el toggle, vaciamos el campo porcentaje automáticamente
    if (name === 'es_operativo' && checked) {
        setForm({ ...form, es_operativo: true, porcentaje: '' });
    } else {
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const formatCurrencyInput = (value) => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    if (rawValue.startsWith('0') && rawValue.length > 1 && rawValue[1] !== ',') {
      rawValue = rawValue.replace(/^0+/, '');
      if (rawValue === '') rawValue = '0';
    }
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = parts[0] + ',' + parts.slice(1).join('');
    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (decimalPart !== undefined) return `${integerPart},${decimalPart.slice(0, 2)}`;
    return integerPart;
  };

  const handleMonedaChange = (e) => {
    setForm({ ...form, [e.target.name]: formatCurrencyInput(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/fondos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...form, cuenta_bancaria_id: cuenta.id })
      });
      if (res.ok) {
        setForm({ nombre: '', moneda: 'BS', porcentaje: '', saldo_inicial: '0', es_operativo: false });
        fetchFondos(); 
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.message || 'No se pudo crear el fondo'}`);
      }
    } catch (error) { alert('Error de conexión al crear el fondo.'); }
  };

  const handleDeleteFondo = async (id) => {
    if (!window.confirm('⚠️ ¿Estás seguro de que deseas eliminar este fondo?')) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/fondos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') fetchFondos();
      else alert(`Error: ${data.message || 'No se pudo eliminar el fondo'}`);
    } catch (error) { alert('Error de conexión al eliminar el fondo.'); }
  };

  const porcentajeUsado = fondos.reduce((acc, curr) => acc + parseFloat(curr.porcentaje_asignacion || 0), 0);
  const porcentajeRestante = Math.max(0, 100 - porcentajeUsado).toFixed(2);
  const tieneOperativo = fondos.some(f => f.es_operativo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Configuración de Fondos</h3>
        <p className="text-sm text-gray-500 mb-6">Cuenta bancaria: <strong className="text-donezo-primary">{cuenta.nombre_banco} ({cuenta.apodo})</strong></p>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-3">
             <h4 className="font-bold text-gray-700 dark:text-gray-300">Distribución de Ingresos</h4>
             <span className={`text-xs font-bold px-3 py-1 rounded-full ${porcentajeRestante > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                {porcentajeRestante > 0 ? `${porcentajeRestante}% asignado al Fondo Principal` : `100% distribuido`}
             </span>
          </div>
          
          {loading ? <p className="text-sm text-gray-500">Cargando...</p> : fondos.length === 0 ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
               No hay fondos virtuales. Agregue uno abajo para empezar.
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${fondos.length > 1 ? 'md:grid-cols-2' : ''} gap-3 max-h-[22rem] overflow-y-auto custom-scrollbar pr-2`}>
              {fondos.map(f => (
                <div key={f.id} className={`p-4 rounded-xl border flex flex-col gap-3 shadow-sm transition-all ${f.es_operativo ? 'border-donezo-primary bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                         {f.nombre}
                         {f.es_operativo && <span className="bg-donezo-primary text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black">Principal</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Entrada: <strong className="text-gray-700 dark:text-gray-300">{f.es_operativo ? 'Remanente Automático' : `${f.porcentaje_asignacion}%`}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Saldo Actual</p>
                      <p className={`font-black text-lg ${f.moneda === 'USD' || f.moneda === 'EUR' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                         {formatMoney(f.saldo_actual)} <span className="text-xs font-normal">{f.moneda}</span>
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2 flex justify-end">
                    <button onClick={() => handleDeleteFondo(f.id)} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
          
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2 uppercase tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Aperturar Nuevo Fondo
             </h4>

             {/* EL TOGGLE ESTILO IOS */}
             <label className={`flex items-center gap-2 cursor-pointer text-xs font-bold ${tieneOperativo ? 'opacity-30 cursor-not-allowed' : 'text-donezo-primary'}`} title={tieneOperativo ? "Ya existe un fondo principal" : "Marque aquí si este fondo absorberá todo el dinero sobrante"}>
               <span className="uppercase tracking-wider">¿Es el Fondo Principal?</span>
               <div className="relative">
                 <input 
                   type="checkbox" 
                   name="es_operativo" 
                   checked={form.es_operativo} 
                   onChange={handleChange} 
                   disabled={tieneOperativo} 
                   className="sr-only peer" 
                 />
                 {/* El "riel" del toggle */}
                 <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-donezo-primary"></div>
               </div>
             </label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${form.es_operativo ? 'md:col-span-3' : 'md:col-span-2'}`}>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Nombre del Fondo *</label>
              <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Fondo de Reserva" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
            </div>
            
            {/* SI NO ES EL PRINCIPAL, PEDIMOS PORCENTAJE */}
            {!form.es_operativo && (
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">% de Ingresos *</label>
                <input type="number" step="0.01" min="0" max={porcentajeRestante} name="porcentaje" value={form.porcentaje} onChange={handleChange} required placeholder="Ej: 10" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Moneda Base</label>
              <select name="moneda" value={form.moneda} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white">
                <option value="BS" className="bg-white dark:bg-gray-800">Bolívares (BS)</option>
                <option value="USD" className="bg-white dark:bg-gray-800">Dólares (USD)</option>
                <option value="EUR" className="bg-white dark:bg-gray-800">Euros (EUR)</option>
              </select>
            </div>

            <div className={`${!form.es_operativo ? 'md:col-span-2' : ''}`}>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Saldo de Apertura</label>
              <input type="text" name="saldo_inicial" value={form.saldo_inicial} onChange={handleMonedaChange} required placeholder="0,00" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white font-mono" />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
             <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 px-8 py-3 rounded-xl text-sm font-bold shadow-md transition-all">
                Crear Fondo Virtual
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}