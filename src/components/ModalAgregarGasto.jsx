import React, { useState } from 'react';

export default function ModalAgregarGasto({ onClose, onSuccess, proveedores, zonas, propiedades }) {
  const todayString = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '',
    asignacion_tipo: 'Comun', 
    zona_id: '', propiedad_id: '',
    fecha_gasto: todayString
  });

  const [facturaFile, setFacturaFile] = useState(null);
  const [soportesFiles, setSoportesFiles] = useState([]);

  const montoBsNum = parseFloat(form.monto_bs.replace(/\./g, '').replace(',', '.')) || 0;
  const tasaNum = parseFloat(form.tasa_cambio.replace(/\./g, '').replace(',', '.')) || 0;
  const equivalenteUSD = tasaNum > 0 ? (montoBsNum / tasaNum).toFixed(2) : '0.00';

  const formatCurrencyInput = (value) => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = parts[0] + ',' + parts.slice(1).join('');
    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (decimalPart !== undefined) return `${integerPart},${decimalPart.slice(0, 2)}`;
    return integerPart;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (['concepto', 'nota'].includes(name) && value.length > 0) setForm({ ...form, [name]: value.charAt(0).toUpperCase() + value.slice(1) });
    else setForm({ ...form, [name]: value });
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
    Object.keys(form).forEach(key => {
      if (key === 'asignacion_tipo') formData.append('tipo', form[key]);
      else formData.append(key, form[key]);
    });
    
    if (facturaFile) formData.append('factura_img', facturaFile);
    soportesFiles.forEach(file => formData.append('soportes', file));

    const res = await fetch('https://auth.habioo.cloud/gastos', { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` }, 
        body: formData 
    });

    if (res.ok) {
      onSuccess(); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrar Gasto</h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white">
              <option value="">Seleccione...</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.identificador})</option>)}
            </select>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto <span className="text-red-500">*</span></label>
              <input type="text" name="concepto" value={form.concepto} onChange={handleChange} placeholder="Ej: Reparación de tubería..." required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Factura <span className="text-red-500">*</span></label>
              <input type="date" name="fecha_gasto" value={form.fecha_gasto} onChange={handleChange} max={todayString} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto (Bs) <span className="text-red-500">*</span></label>
              <input type="text" name="monto_bs" value={form.monto_bs} onChange={handleMonedaChange} placeholder="0,00" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tasa BCV <span className="text-red-500">*</span></label>
              <input type="text" name="tasa_cambio" value={form.tasa_cambio} onChange={handleMonedaChange} placeholder="0,00" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
            </div>
            <div className="md:col-span-2 flex justify-end -mt-3 mb-2">
                <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-green-200 dark:border-green-800/50">Equivalente: ${equivalenteUSD} USD</span>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Diferir en Cuotas</label>
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                <button type="button" onClick={() => handleCuotasChange(-1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-lg font-bold">-</button>
                <input type="text" readOnly value={`${form.total_cuotas} Mes(es)`} className="w-full text-center bg-transparent font-medium dark:text-white" />
                <button type="button" onClick={() => handleCuotasChange(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-lg font-bold">+</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Distribución (Asignación)</label>
              
              <div className="flex gap-1 mb-3 bg-gray-200 dark:bg-gray-900 p-1 rounded-xl w-full">
                  <button type="button" onClick={() => setForm({...form, asignacion_tipo: 'Comun', zona_id: '', propiedad_id: ''})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Comun' ? 'bg-white dark:bg-gray-700 shadow text-donezo-primary dark:text-green-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`}>Común</button>
                  <button type="button" onClick={() => setForm({...form, asignacion_tipo: 'Zona', propiedad_id: ''})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Zona' ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`}>Por Zona</button>
                  <button type="button" onClick={() => setForm({...form, asignacion_tipo: 'Individual', zona_id: ''})} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Individual' ? 'bg-white dark:bg-gray-700 shadow text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`}>Individual</button>
              </div>

              {form.asignacion_tipo === 'Zona' && (
                <select name="zona_id" value={form.zona_id} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white text-sm" required>
                  <option value="">Seleccione la zona...</option>
                  {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              )}
              {form.asignacion_tipo === 'Individual' && (
                <select name="propiedad_id" value={form.propiedad_id} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 dark:text-white text-sm" required>
                  <option value="">Seleccione el inmueble...</option>
                  {propiedades.map(p => <option key={p.id} value={p.id}>{p.identificador}</option>)}
                </select>
              )}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna</label>
            <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows="2" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📸 Factura Principal (1 foto)</label>
              <input type="file" accept="image/*" onChange={(e) => setFacturaFile(e.target.files[0] || null)} className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 text-xs"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📎 Soportes (Máx 4)</label>
              <input type="file" multiple accept="image/*" onChange={(e) => {
                  const sel = Array.from(e.target.files);
                  if (sel.length > 4) { alert("Máximo 4."); e.target.value = ""; setSoportesFiles([]); } else setSoportesFiles(sel);
                }} className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 text-xs"/>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 dark:text-gray-300 font-bold">Cancelar</button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 shadow-md">Guardar Gasto</button>
          </div>
        </form>
      </div>
    </div>
  );
}
