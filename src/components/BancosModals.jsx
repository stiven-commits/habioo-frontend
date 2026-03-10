import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';

// ==========================================
// 1. MODAL: PAGAR A PROVEEDOR
// ==========================================
export function ModalPagoProveedor({ onClose, onSuccess }) {
  const [fondos, setFondos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    gasto_id: '', fondo_id: '', monto_origen: '', tasa_cambio: '', 
    referencia: '', fecha_pago: new Date().toISOString().split('T')[0], nota: ''
  });

  const [isFetchingBCV, setIsFetchingBCV] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('habioo_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      try {
        const [resFondos, resGastos] = await Promise.all([
          fetch(`${API_BASE_URL}/fondos`, { headers }),
          fetch(`${API_BASE_URL}/gastos-pendientes-pago`, { headers })
        ]);
        const dataFondos = await resFondos.json();
        const dataGastos = await resGastos.json();
        
        if (dataFondos.status === 'success') setFondos(dataFondos.fondos);
        if (dataGastos.status === 'success') setGastos(dataGastos.gastos);
      } catch (error) { console.error("Error cargando datos", error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const selectedFondo = fondos.find(f => f.id.toString() === form.fondo_id);
  const selectedGasto = gastos.find(g => g.id.toString() === form.gasto_id);
  const isBs = selectedFondo?.moneda === 'BS';

  const fetchBCV = async () => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json = await response.json();
      if (json?.promedio) setForm(prev => ({ ...prev, tasa_cambio: json.promedio.toString() }));
    } catch { alert('Error obteniendo BCV'); } 
    finally { setIsFetchingBCV(false); }
  };

  const calcularMontoUSD = () => {
    const monto = parseFloat(form.monto_origen) || 0;
    const tasa = parseFloat(form.tasa_cambio) || 1;
    return isBs ? (monto / tasa).toFixed(2) : monto.toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const usd = calcularMontoUSD();
    if (!window.confirm(`¿Confirmar pago de $${formatMoney(usd)} al proveedor?`)) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/pagos-proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...form, monto_usd: usd, monto_bs: isBs ? form.monto_origen : null })
      });
      const result = await res.json();
      if (result.status === 'success') {
        alert(result.message);
        onSuccess();
      } else alert(result.error);
    } catch (error) { alert("Error de red"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">💸 Pagar a Proveedor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Factura Pendiente</label>
              <select required value={form.gasto_id} onChange={(e) => setForm({...form, gasto_id: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione una factura...</option>
                {gastos.map(g => (
                  <option key={g.id} value={g.id}>{g.proveedor} - {g.concepto} (Debe: ${g.deuda_restante})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fondo de Origen (Desde donde se paga)</label>
              <select required value={form.fondo_id} onChange={(e) => setForm({...form, fondo_id: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione un fondo...</option>
                {fondos.map(f => (
                  <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto Pagado ({selectedFondo ? selectedFondo.moneda : '?'})</label>
                <input required type="number" step="0.01" value={form.monto_origen} onChange={(e) => setForm({...form, monto_origen: e.target.value})} placeholder="0.00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
              
              {isBs && (
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa de Cambio</label>
                  <div className="flex gap-2">
                    <input required type="number" step="0.01" value={form.tasa_cambio} onChange={(e) => setForm({...form, tasa_cambio: e.target.value})} placeholder="Ej: 36.5" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
                    <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-3 rounded-xl font-bold border border-blue-200 dark:border-blue-800" title="Obtener BCV">🔄</button>
                  </div>
                </div>
              )}
            </div>

            {selectedFondo && form.monto_origen && (
               <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/50 flex justify-between items-center">
                 <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Se descontará de la deuda:</span>
                 <span className="font-black text-red-600 dark:text-red-400 text-lg">${formatMoney(calcularMontoUSD())}</span>
               </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia</label>
                <input required type="text" value={form.referencia} onChange={(e) => setForm({...form, referencia: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                <input required type="date" max={new Date().toISOString().split('T')[0]} value={form.fecha_pago} onChange={(e) => setForm({...form, fecha_pago: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg">Confirmar Pago a Proveedor</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. MODAL: TRANSFERENCIA ENTRE FONDOS
// ==========================================
export function ModalTransferencia({ onClose, onSuccess }) {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingBCV, setIsFetchingBCV] = useState(false);

  const [form, setForm] = useState({
    fondo_origen_id: '', fondo_destino_id: '', monto_origen: '', tasa_cambio: '', 
    referencia: '', fecha: new Date().toISOString().split('T')[0], nota: ''
  });

  useEffect(() => {
    const fetchFondos = async () => {
      const token = localStorage.getItem('habioo_token');
      try {
        const res = await fetch(`${API_BASE_URL}/fondos`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'success') setFondos(data.fondos);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchFondos();
  }, []);

  const fondoOrigen = fondos.find(f => f.id.toString() === form.fondo_origen_id);
  // 💡 Filtramos para que el origen no salga en el destino
  const fondosDestino = fondos.filter(f => f.id.toString() !== form.fondo_origen_id);
  const fondoDestino = fondos.find(f => f.id.toString() === form.fondo_destino_id);

  // Lógica de cálculo cruzado automático
  const isDifferentCurrency = fondoOrigen && fondoDestino && fondoOrigen.moneda !== fondoDestino.moneda;
  const involvesBs = fondoOrigen && fondoDestino && (fondoOrigen.moneda === 'BS' || fondoDestino.moneda === 'BS');
  
  // 💡 FORMATEADOR VISUAL: "10000,50" -> "10.000,50"
  const formatNumberInput = (value, maxDecimals = 2) => {
    let cleaned = value.replace(/[^0-9,]/g, ''); // Solo números y coma
    const parts = cleaned.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Puntos de miles
    const integerPart = parts[0];
    const decimalPart = (parts[1] || '').slice(0, maxDecimals);
    return decimalPart ? `${integerPart},${decimalPart}` : integerPart;
  };

  // 💡 PARSEADOR MATEMÁTICO: "10.000,50" -> 10000.50 (Para cálculos y DB)
  const parseNumber = (val) => parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;

  let montoDestinoFinal = parseNumber(form.monto_origen); // Por defecto es igual
  if (isDifferentCurrency && form.monto_origen && form.tasa_cambio) {
      const monto = parseNumber(form.monto_origen);
      const tasa = parseNumber(form.tasa_cambio);
      if (fondoOrigen.moneda === 'BS' && fondoDestino.moneda === 'USD') montoDestinoFinal = (monto / tasa).toFixed(2);
      if (fondoOrigen.moneda === 'USD' && fondoDestino.moneda === 'BS') montoDestinoFinal = (monto * tasa).toFixed(2);
  }

  const montoOrigenNum = parseNumber(form.monto_origen);
  const tasaNum = parseNumber(form.tasa_cambio);
  const montoUsdEquivalente = fondoOrigen
    ? (fondoOrigen.moneda === 'USD'
      ? montoOrigenNum
      : (tasaNum > 0 ? (montoOrigenNum / tasaNum) : 0))
    : 0;

  const isTransferFormValid = Boolean(
    form.fondo_origen_id &&
    form.fondo_destino_id &&
    montoOrigenNum > 0 &&
    form.referencia.trim() &&
    form.fecha &&
    (!involvesBs || tasaNum > 0)
  );

  // 💡 BOTÓN BCV
  const fetchBCV = async () => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json = await response.json();
      if (json?.promedio) setForm(prev => ({ ...prev, tasa_cambio: json.promedio.toString().replace('.', ',') }));
    } catch { alert('Error obteniendo BCV'); } 
    finally { setIsFetchingBCV(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fondo_origen_id || !form.fondo_destino_id) return alert("Seleccione el fondo de origen y destino.");
    
    const numMontoOrigen = parseNumber(form.monto_origen);
    const numTasa = form.tasa_cambio ? parseNumber(form.tasa_cambio) : null;

    if (numMontoOrigen <= 0) return alert("El monto a transferir debe ser mayor a 0.");
    if (involvesBs && (!numTasa || numTasa <= 0)) return alert("Debe indicar una tasa BCV valida para calcular equivalente USD.");
    if (!window.confirm(`¿Confirmar transferencia de ${form.monto_origen} ${fondoOrigen.moneda} hacia ${fondoDestino.nombre}?`)) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/transferencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        // Enviamos los datos matemáticamente limpios al backend
        body: JSON.stringify({ 
            ...form, 
            monto_origen: numMontoOrigen,
            tasa_cambio: numTasa,
            monto_destino: montoDestinoFinal 
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        alert(result.message);
        onSuccess();
      } else alert(result.error);
    } catch (error) { alert("Error de red"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 custom-scrollbar max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">🔄 Transferir Dinero</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando fondos...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. SELECT ORIGEN */}
            <div>
              <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Sale de: (Origen) *</label>
              <select required value={form.fondo_origen_id} onChange={(e) => setForm({...form, fondo_origen_id: e.target.value, fondo_destino_id: ''})} className="w-full p-3 rounded-xl border border-blue-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-blue-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400 font-semibold">
                <option value="">Seleccione fondo origen...</option>
                {fondos.map(f => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>)}
              </select>
            </div>

            {/* 2. SELECT DESTINO (Solo aparece si hay origen) */}
            {fondoOrigen && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Entra a: (Destino) *</label>
                <select required value={form.fondo_destino_id} onChange={(e) => setForm({...form, fondo_destino_id: e.target.value})} className="w-full p-3 rounded-xl border border-purple-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-purple-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-400 font-semibold">
                  <option value="">Seleccione fondo destino...</option>
                  {fondosDestino.map(f => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda})</option>)}
                </select>
              </div>
            )}

            {/* MONTOS Y TASAS */}
            {fondoOrigen && fondoDestino && (
              <div className="animate-fadeIn space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a Enviar *</label>
                    <input required type="text" value={form.monto_origen} onChange={(e) => setForm({...form, monto_origen: formatNumberInput(e.target.value, 2)})} placeholder="Ej: 1.500,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                  
                  {involvesBs && (
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa de Cambio *</label>
                      <div className="flex gap-2">
                        <input required type="text" value={form.tasa_cambio} onChange={(e) => setForm({...form, tasa_cambio: formatNumberInput(e.target.value, 2)})} placeholder="Ej: 36,50" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
                        {/* 💡 BOTON BCV */}
                        <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-3 rounded-xl font-bold border border-blue-200 dark:border-blue-800 transition-all hover:bg-blue-100" title="Obtener BCV">🔄</button>
                      </div>
                    </div>
                  )}
                </div>

                {form.monto_origen && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Destino Recibe (Equiv. USD):</span>
                    <span className="font-black text-green-600 dark:text-green-400 text-lg">${formatMoney(montoUsdEquivalente)}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                    <input required type="text" value={form.referencia} onChange={(e) => setForm({...form, referencia: e.target.value.replace(/\s/g, '')})} placeholder="Sin espacios" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                    <input required type="date" max={new Date().toISOString().split('T')[0]} value={form.fecha} onChange={(e) => setForm({...form, fecha: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                </div>

                {/* 💡 CAMPO DE NOTA */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota / Razón (Opcional)</label>
                  <textarea rows="2" value={form.nota} onChange={(e) => setForm({...form, nota: e.target.value})} placeholder="Ej: Traspaso mensual para reservas..." className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary resize-none"></textarea>
                </div>

                <button type="submit" disabled={!isTransferFormValid} className="w-full py-3 mt-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Procesar Transferencia</button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
