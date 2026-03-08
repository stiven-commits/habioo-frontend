import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/currency';

export default function ModalFondos({ cuenta, onClose }) {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nombre: '',
    moneda: 'BS', // O USD/EUR según necesiten
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
        // Filtramos solo los fondos de la cuenta seleccionada
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
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  // --- NUEVAS FUNCIONES PARA FORMATEO DE MONEDA ---
  const formatCurrencyInput = (value) => {
    let rawValue = value.replace(/[^0-9,]/g, '');
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
  // ------------------------------------------------

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
        body: JSON.stringify({
          ...form,
          cuenta_bancaria_id: cuenta.id
        })
      });
      
      if (res.ok) {
        setForm({ nombre: '', moneda: 'BS', porcentaje: '', saldo_inicial: '0', es_operativo: false });
        fetchFondos(); // Recargar la lista de fondos
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.message || 'No se pudo crear el fondo'}`);
      }
    } catch (error) {
      alert('Error de conexión al crear el fondo.');
    }
  };

  // Cálculo del porcentaje restante
  const porcentajeUsado = fondos.reduce((acc, curr) => acc + parseFloat(curr.porcentaje_asignacion || 0), 0);
  const porcentajeRestante = Math.max(0, 100 - porcentajeUsado).toFixed(2);
  const tieneOperativo = fondos.some(f => f.es_operativo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Fondos Virtuales</h3>
        <p className="text-sm text-gray-500 mb-6">Cuenta anclada: <strong className="text-donezo-primary">{cuenta.nombre_banco} ({cuenta.apodo})</strong></p>

        {/* LISTA DE FONDOS ACTUALES */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-3">
             <h4 className="font-bold text-gray-700 dark:text-gray-300">Distribución Actual</h4>
             <span className={`text-xs font-bold px-3 py-1 rounded-full ${porcentajeRestante > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {porcentajeRestante}% Sin asignar
             </span>
          </div>
          
          {loading ? <p className="text-sm text-gray-500">Cargando fondos...</p> : fondos.length === 0 ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
               No hay fondos creados en esta cuenta. El dinero ingresará pero no se distribuirá.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {fondos.map(f => (
                <div key={f.id} className={`p-4 rounded-xl border ${f.es_operativo ? 'border-donezo-primary bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} flex justify-between items-center shadow-sm`}>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1">
                       {f.nombre}
                       {f.es_operativo && <span className="bg-donezo-primary text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Operativo (Resto)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Asignación: <strong className="text-gray-700 dark:text-gray-300">{f.es_operativo ? 'Automática' : `${f.porcentaje_asignacion}%`}</strong></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Saldo Virtual</p>
                    <p className={`font-black text-lg ${f.moneda === 'USD' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                       {formatMoney(f.saldo_actual)} <span className="text-xs font-normal">{f.moneda}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FORMULARIO NUEVO FONDO */}
        <form onSubmit={handleSubmit} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 text-sm flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
             Aperturar Nuevo Fondo Virtual
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Nombre del Fondo *</label>
              <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Fondo de Reserva" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Moneda Base</label>
              <select name="moneda" value={form.moneda} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white">
                <option value="BS">Bolívares (BS)</option>
                <option value="USD">Dólares (USD)</option>
                <option value="EUR">Euros (EUR)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">% de Ingresos</label>
              <input type="number" step="0.01" min="0" max={porcentajeRestante} name="porcentaje" value={form.porcentaje} onChange={handleChange} disabled={form.es_operativo} required={!form.es_operativo} placeholder="Ej: 10" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white disabled:opacity-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Saldo de Apertura</label>
              <input 
                type="text" 
                name="saldo_inicial" 
                value={form.saldo_inicial} 
                onChange={handleMonedaChange} 
                placeholder="0,00"
                required 
                className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white font-mono" 
              />
            </div>

            <div className="flex items-center mt-6">
              <label className={`flex items-center gap-2 cursor-pointer text-sm font-bold ${tieneOperativo ? 'opacity-50 text-gray-400' : 'text-gray-700 dark:text-gray-300'}`} title={tieneOperativo ? "Ya existe un fondo operativo" : "Este fondo recibirá todo el porcentaje sobrante"}>
                <input type="checkbox" name="es_operativo" checked={form.es_operativo} onChange={handleChange} disabled={tieneOperativo} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                Es Fondo Operativo
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
             <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 px-6 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all">
                Crear Fondo
             </button>
          </div>
        </form>

      </div>
    </div>
  );
}
