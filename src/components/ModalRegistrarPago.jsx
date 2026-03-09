import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/currency';

// 💡 Recibe la propiedad en lugar del recibo
export default function ModalRegistrarPago({ propiedadPreseleccionada, onClose, onSuccess }) {
  const [bancos, setBancos] = useState([]); // 💡 Estado para guardar los bancos
  const [loadingBancos, setLoadingBancos] = useState(true);

  const [formPago, setFormPago] = useState({
    cuenta_id: '', monto_origen: '', tasa_cambio: '', referencia: '',
    fecha_pago: new Date().toISOString().split('T')[0], nota: '', cedula_origen: '', banco_origen: ''
  });

  const BANCOS_VENEZUELA = [
    "Banco de Venezuela (BDV)", "Banesco Banco Universal", "Banco Mercantil", "BBVA Provincial",
    "Banco Nacional de Crédito (BNC)", "Bancamiga Banco Universal", "Banplus Banco Universal",
    "Banco del Tesoro", "Banco del Caribe (Bancaribe)", "Banco Fondo Común (BFC)", "Banco Caroní",
    "Banco Activo", "Banco Venezolano de Crédito (BVC)", "Banco Sofitasa", "100% Banco",
    "Delsur Banco Universal", "Banco Agrícola de Venezuela", "Banco Bicentenario", "Banco Plaza",
    "Banco Exterior", "Banco de la Fuerza Armada Nacional Bolivariana (Banfanb)",
    "Banco Digital de los Trabajadores (BDT)", "N58 Banco Digital", "Bancrecer", "Bangente", "R4 Banco Microfinanciero"
  ];

  const [conversionUSD, setConversionUSD] = useState('0.00');

  // 💡 Buscar los bancos al abrir la modal
  useEffect(() => {
    const fetchBancos = async () => {
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'success') setBancos(data.bancos);
      } catch (error) { console.error("Error al cargar bancos", error); }
      finally { setLoadingBancos(false); }
    };
    fetchBancos();
  }, []);

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

  const handlePagoChange = (e) => {
    const { name, value } = e.target;
    let newVal = value;

    if (name === 'monto_origen' || name === 'tasa_cambio') newVal = formatCurrencyInput(value);

    const updatedForm = { ...formPago, [name]: newVal };
    setFormPago(updatedForm);

    if (updatedForm.monto_origen && updatedForm.cuenta_id) {
      const banco = bancos.find(b => b.id.toString() === updatedForm.cuenta_id);
      const monto = parseFloat(updatedForm.monto_origen.replace(/\./g, '').replace(',', '.')) || 0;
      const isForeign = banco && ['Zelle', 'Efectivo'].includes(banco.tipo);
      const tasaRaw = parseFloat(updatedForm.tasa_cambio.replace(/\./g, '').replace(',', '.'));

      if (isForeign) setConversionUSD(monto.toFixed(2));
      else if (tasaRaw && tasaRaw > 0) setConversionUSD((monto / tasaRaw).toFixed(2));
      else setConversionUSD('0.00');
    }
  };

  const [isFetchingBCV, setIsFetchingBCV] = useState(false);

  const fetchBCV = async () => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('API Error');
      const json = await response.json();
      if (json && json.promedio) {
        const usdRate = json.promedio.toString().replace('.', ',');
        handlePagoChange({ target: { name: 'tasa_cambio', value: formatCurrencyInput(usdRate) } });
      } else alert('No se pudo encontrar la tasa del BCV actual.');
    } catch { alert('Error de conexión o API. No se pudo obtener la tasa BCV.'); } 
    finally { setIsFetchingBCV(false); }
  };

  const selectedBank = bancos.find(b => b.id.toString() === formPago.cuenta_id);
  const requiresTasa = selectedBank && ['Transferencia', 'Pago Movil'].includes(selectedBank.tipo);

  const handleSubmitPago = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Confirmar abono por $${formatMoney(conversionUSD)} a la cuenta de ${propiedadPreseleccionada.identificador}?`)) return;

    const monedaReal = requiresTasa ? 'BS' : 'USD';
    const token = localStorage.getItem('habioo_token');
    
    // 💡 Enviamos propiedad_id para que el backend haga la cascada
    const payload = { 
      ...formPago, 
      propiedad_id: propiedadPreseleccionada.id, 
      moneda: monedaReal 
    };

    const res = await fetch('https://auth.habioo.cloud/pagos-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (result.status === 'success') {
      alert(result.message);
      onSuccess();
    } else alert(result.error);
  };

  if (!propiedadPreseleccionada) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Registrar Pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-xl font-bold transition-colors">✕</button>
        </div>

        {/* 💡 Panel que muestra el saldo global del apartamento */}
        <div className={`p-4 rounded-xl mb-4 text-center border ${propiedadPreseleccionada.saldo_actual > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/50' : 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/50'}`}>
          <p className={`text-xs font-bold mb-1 uppercase tracking-wider ${propiedadPreseleccionada.saldo_actual > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
             {propiedadPreseleccionada.saldo_actual > 0 ? 'Deuda Pendiente' : 'Saldo a Favor'}
          </p>
          <p className={`text-3xl font-black font-mono ${propiedadPreseleccionada.saldo_actual > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            ${formatMoney(Math.abs(propiedadPreseleccionada.saldo_actual || 0))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-2">
            Inmueble: <span className="text-gray-800 dark:text-white">{propiedadPreseleccionada.identificador}</span>
          </p>
        </div>

        <form onSubmit={handleSubmitPago} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Cuenta Destino</label>
            <select name="cuenta_id" value={formPago.cuenta_id} onChange={handlePagoChange} className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required disabled={loadingBancos}>
              <option value="">{loadingBancos ? 'Cargando bancos...' : 'Seleccione Banco...'}</option>
              {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre_banco || b.tipo} ({b.apodo})</option>)}
            </select>
          </div>

          {requiresTasa ? (
            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Monto Pagado</label>
                  <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Tasa de Cambio <span className="text-red-500">*</span></label>
                  <input type="text" name="tasa_cambio" value={formPago.tasa_cambio} onChange={handlePagoChange} placeholder="Ej: 36,50" required className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" />
                </div>
              </div>
              <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="h-full min-h-[118px] w-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-60" title="Consultar tasa actual del BCV">
                {isFetchingBCV ? '⌛...' : '🔄 BCV'}
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Monto Pagado</label>
              <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
          )}

          {requiresTasa && (
            <div className="grid grid-cols-2 gap-3 mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Banco de Origen</label>
                <select name="banco_origen" value={formPago.banco_origen} onChange={handlePagoChange} className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required>
                  <option value="">Seleccione...</option>
                  {BANCOS_VENEZUELA.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Cédula Origen</label>
                <input type="text" name="cedula_origen" value={formPago.cedula_origen} onChange={handlePagoChange} placeholder="V12345678" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center px-2 py-1 mt-1 mb-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
            <span className="text-xs text-green-700 dark:text-green-500 font-bold uppercase tracking-wider">Abono Equivalente:</span>
            <span className="font-black text-green-600 dark:text-green-400 text-lg">+ ${formatMoney(conversionUSD)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Referencia</label>
              <input type="text" name="referencia" value={formPago.referencia} onChange={handlePagoChange} placeholder="Ref / Comprobante" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Fecha Pago</label>
              <input type="date" name="fecha_pago" value={formPago.fecha_pago} onChange={handlePagoChange} max={new Date().toISOString().split('T')[0]} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all">
              Procesar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}