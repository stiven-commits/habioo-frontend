import React, { useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../config/api';
import 'react-datepicker/dist/react-datepicker.css';

interface ModalAgregarGastoProps {
  onClose: () => void;
  onSuccess: () => void;
  proveedores: Proveedor[];
  zonas: Zona[];
  propiedades: Propiedad[];
}

interface Proveedor {
  id: number | string;
  nombre: string;
  identificador: string;
}

interface Zona {
  id: number | string;
  nombre: string;
}

interface Propiedad {
  id: number | string;
  identificador: string;
}

type AsignacionTipo = 'Comun' | 'Zona' | 'Individual' | 'Extra';
type ClasificacionGasto = 'Fijo' | 'Variable';

interface FormState {
  proveedor_id: string;
  concepto: string;
  monto_bs: string;
  tasa_cambio: string;
  total_cuotas: string;
  nota: string;
  clasificacion: ClasificacionGasto;
  asignacion_tipo: AsignacionTipo;
  zona_id: string;
  propiedad_id: string;
  fecha_gasto: string;
}

interface ApiErrorResponse {
  error?: string;
}

const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((v) => Number(v));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ModalAgregarGasto: FC<ModalAgregarGastoProps> = ({ onClose, onSuccess, proveedores, zonas, propiedades }) => {
  const todayString = new Date().toISOString().split('T')[0] ?? '';

  const [form, setForm] = useState<FormState>({
    proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '',
    clasificacion: 'Variable',
    asignacion_tipo: 'Comun',
    zona_id: '', propiedad_id: '',
    fecha_gasto: todayString
  });

  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [soportesFiles, setSoportesFiles] = useState<File[]>([]);
  
  // NUEVO: Estado para el loading de la tasa BCV
  const [loadingBCV, setLoadingBCV] = useState<boolean>(false);

  const parseInputNumber = (txt: string): number => {
    const cleaned = String(txt || '').trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const montoBsNum = parseInputNumber(form.monto_bs);
  const tasaNum = parseInputNumber(form.tasa_cambio);
  const equivalenteUSD = tasaNum > 0 ? (montoBsNum / tasaNum).toFixed(2) : '0.00';

  const formatCurrencyInput = (value: string, maxDecimals = 2): string => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = parts[0] + ',' + parts.slice(1).join('');
    let [integerPart = '', decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimalPart !== undefined) return `${integerPart},${decimalPart.slice(0, maxDecimals)}`;
    return integerPart ?? '';
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const field = name as keyof FormState;
    if (['concepto', 'nota'].includes(name) && value.length > 0) {
      setForm((prev: FormState) => ({ ...prev, [field]: (value.charAt(0).toUpperCase() + value.slice(1)) as FormState[typeof field] }));
    } else {
      setForm((prev: FormState) => ({ ...prev, [field]: value as FormState[typeof field] }));
    }
  };

  const handleMonedaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const field = e.target.name as keyof FormState;
    const maxDecimals = field === 'tasa_cambio' ? 3 : 2;
    setForm((prev: FormState) => ({ ...prev, [field]: formatCurrencyInput(e.target.value, maxDecimals) as FormState[typeof field] }));
  };

  const handleCuotasChange = (delta: number): void => {
    let next = (parseInt(form.total_cuotas, 10) || 1) + delta;
    if (next >= 1 && next <= 24) setForm((prev: FormState) => ({ ...prev, total_cuotas: next.toString() }));
  };

  // NUEVA FUNCION: Obtener Tasa del BCV Automaticamente
  const handleFetchBCV = async (): Promise<void> => {
    setLoadingBCV(true);
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const data: { promedio?: number | string } = await res.json();
      if (data && data.promedio) {
        // Convertimos el punto en coma y lo pasamos por nuestro formateador
        const rateNumber = parseFloat(String(data.promedio));
        const tasaRaw = Number.isFinite(rateNumber) ? rateNumber.toFixed(3).replace('.', ',') : String(data.promedio).replace('.', ',');
        const formattedTasa = formatCurrencyInput(tasaRaw, 3);
        setForm((prev: FormState) => ({ ...prev, tasa_cambio: formattedTasa }));
      } else {
        alert('No se pudo obtener la tasa oficial en este momento.');
      }
    } catch (error) {
      console.error('Error obteniendo BCV:', error);
      alert('Error de conexión al consultar el BCV.');
    } finally {
      setLoadingBCV(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    const montoCanonico = parseInputNumber(form.monto_bs);
    const tasaCanonica = parseInputNumber(form.tasa_cambio);
    if (montoCanonico <= 0 || tasaCanonica <= 0) {
      alert('Monto y tasa deben ser mayores a 0.');
      return;
    }
    
    const formData = new FormData();
    (Object.keys(form) as Array<keyof FormState>).forEach((key: keyof FormState) => {
      if (key === 'asignacion_tipo') formData.append('tipo', form[key]);
      else if (key === 'monto_bs') formData.append('monto_bs', montoCanonico.toFixed(2));
      else if (key === 'tasa_cambio') formData.append('tasa_cambio', tasaCanonica.toFixed(4));
      else formData.append(key, form[key]);
    });
    
    if (facturaFile) formData.append('factura_img', facturaFile);
    soportesFiles.forEach((file: File) => formData.append('soportes', file));

    const res = await fetch(`${API_BASE_URL}/gastos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
      onSuccess();
    } else {
      const errorData: ApiErrorResponse = await res.json();
      alert(`Error al guardar: ${errorData.error || 'Verifique los datos.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrar Gasto</h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
              <option value="">Seleccione...</option>
              {proveedores.map((p: Proveedor) => <option key={p.id} value={p.id}>{p.nombre} ({p.identificador})</option>)}
            </select>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto <span className="text-red-500">*</span></label>
              <input type="text" name="concepto" value={form.concepto} onChange={handleChange} placeholder="Ej: Reparación de tubería..." required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Factura <span className="text-red-500">*</span></label>
              <DatePicker
                selected={ymdToDate(form.fecha_gasto)}
                onChange={(date: Date | null) => setForm((prev: FormState) => ({ ...prev, fecha_gasto: dateToYmd(date) }))}
                maxDate={ymdToDate(todayString) || undefined}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Fecha (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-[50px] w-full rounded-xl border border-gray-200 bg-gray-50 p-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etiqueta</label>
            <select
              name="clasificacion"
              value={form.clasificacion}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
            >
              <option value="Fijo">Gasto fijo</option>
              <option value="Variable">Gasto variable</option>
            </select>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto (Bs) <span className="text-red-500">*</span></label>
              <input type="text" name="monto_bs" value={form.monto_bs} onChange={handleMonedaChange} placeholder="0,00" required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-lg" />
            </div>
            
            {/* SECCION ACTUALIZADA CON EL BOTON BCV */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tasa BCV <span className="text-red-500">*</span></label>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" name="tasa_cambio" value={form.tasa_cambio} onChange={handleMonedaChange} 
                  placeholder="0,00" required 
                  className="w-full max-w-[190px] p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-lg" 
                />
                <button 
                  type="button" 
                  onClick={handleFetchBCV} 
                  disabled={loadingBCV}
                  title="Obtener tasa oficial del BCV actual"
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 dark:hover:bg-blue-900/50 w-[92px] h-[50px] rounded-xl font-bold transition-all shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {loadingBCV ? (
                    <svg
                      className="w-5 h-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M20 12a8 8 0 1 1-2.34-5.66"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20 4v6h-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span>BCV</span>
                  )}
                </button>
              </div>
            </div>
            {/* FIN SECCION BCV */}

            <div className="md:col-span-2 flex justify-end -mt-3 mb-2">
                <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-green-200 dark:border-green-800/50">
                  Equivalente: ${formatMoneyDisplay(equivalenteUSD)} USD
                </span>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Diferir en Cuotas</label>
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                <button type="button" onClick={() => handleCuotasChange(-1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-lg font-bold text-gray-600 dark:text-gray-300 transition-colors">-</button>
                <input type="text" readOnly value={`${form.total_cuotas} Mes(es)`} className="w-full text-center bg-transparent font-medium dark:text-white outline-none" />
                <button type="button" onClick={() => handleCuotasChange(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-lg font-bold text-gray-600 dark:text-gray-300 transition-colors">+</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo de gasto</label>
              
              <div className="flex gap-1 mb-3 bg-gray-200 dark:bg-gray-900 p-1 rounded-xl w-full">
                  <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Comun', zona_id: '', propiedad_id: '' }))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Comun' ? 'bg-white dark:bg-gray-700 shadow text-donezo-primary dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800'}`}>Común</button>
                  <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Zona', propiedad_id: '' }))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Zona' ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800'}`}>Por Área</button>
                  <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Individual', zona_id: '' }))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Individual' ? 'bg-white dark:bg-gray-700 shadow text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800'}`}>Individual</button>
                  <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Extra', zona_id: '', propiedad_id: '' }))} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.asignacion_tipo === 'Extra' ? 'bg-white dark:bg-gray-700 shadow text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800'}`}>Extra</button>
              </div>

              {form.asignacion_tipo === 'Zona' && (
                <select name="zona_id" value={form.zona_id} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white text-sm" required>
                  <option value="">Seleccione el área...</option>
                  {zonas.map((z: Zona) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              )}
              {form.asignacion_tipo === 'Individual' && (
                <select name="propiedad_id" value={form.propiedad_id} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 dark:text-white text-sm" required>
                  <option value="">Seleccione el inmueble...</option>
                  {propiedades.map((p: Propiedad) => <option key={p.id} value={p.id}>{p.identificador}</option>)}
                </select>
              )}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna</label>
            <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows={2} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📸 Factura Principal (1 foto)</label>
              <input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => setFacturaFile(e.target.files?.[0] || null)} className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 text-xs cursor-pointer"/>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📎 Soportes (Máx 4)</label>
              <input type="file" multiple accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const sel = Array.from(e.target.files || []);
                  if (sel.length > 4) { alert('Máximo 4 archivos de soporte permitidos.'); e.target.value = ''; setSoportesFiles([]); } else setSoportesFiles(sel);
                }} className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-300 text-xs cursor-pointer"/>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-bold transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all shadow-md">Guardar Gasto</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Pequeña función de apoyo para el render de la etiqueta verde del equivalente a USD
function formatMoneyDisplay(value: string | number): string {
  const parts = Number(value).toFixed(2).split('.');
  parts[0] = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
}

export default ModalAgregarGasto;


