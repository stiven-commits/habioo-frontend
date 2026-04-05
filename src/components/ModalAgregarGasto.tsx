import React, { useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from './ui/ModalBase';
import DatePicker from './ui/DatePicker';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../config/api';

interface ModalAgregarGastoProps {
  onClose: () => void;
  onSuccess: () => void;
  proveedores: Proveedor[];
  zonas: Zona[];
  propiedades: Propiedad[];
  mode?: 'create' | 'edit';
  gastoId?: number | string | null;
  initialValues?: Partial<FormState>;
  existingFacturaUrl?: string | null;
  existingSoportesUrls?: string[];
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
const MAX_PDF_SIZE_BYTES = 1 * 1024 * 1024;

interface FormState {
  proveedor_id: string;
  concepto: string;
  numero_documento: string;
  monto_bs: string;
  tasa_cambio: string;
  total_cuotas: string;
  nota: string;
  clasificacion: ClasificacionGasto;
  asignacion_tipo: AsignacionTipo;
  zona_id: string;
  propiedad_id: string;
  fecha_gasto: string;
  cuotas_historicas: string;
  monto_historico_proveedor_usd: string;
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

const ModalAgregarGasto: FC<ModalAgregarGastoProps> = ({
  onClose,
  onSuccess,
  proveedores,
  zonas,
  propiedades,
  mode = 'create',
  gastoId = null,
  initialValues = {},
  existingFacturaUrl = null,
  existingSoportesUrls = [],
}) => {
  const [form, setForm] = useState<FormState>({
    proveedor_id: '', concepto: '', numero_documento: '', monto_bs: '', tasa_cambio: '', total_cuotas: '1', nota: '',
    clasificacion: 'Variable',
    asignacion_tipo: 'Comun',
    zona_id: '', propiedad_id: '',
    fecha_gasto: '',
    cuotas_historicas: '0',
    monto_historico_proveedor_usd: '',
  });

  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [soportesFiles, setSoportesFiles] = useState<File[]>([]);
  const [removeExistingFactura, setRemoveExistingFactura] = useState<boolean>(false);
  const [existingSoportesEdit, setExistingSoportesEdit] = useState<string[]>([]);
  
  // NUEVO: Estado para el loading de la tasa BCV
  const [loadingBCV, setLoadingBCV] = useState<boolean>(false);
  const [hasHistoricalContext, setHasHistoricalContext] = useState<boolean>(false);

  React.useEffect(() => {
    if (mode !== 'edit') {
      setHasHistoricalContext(false);
      return;
    }
    const merged = {
      ...form,
      ...initialValues,
    } as FormState;
    setForm(merged);
    const cuotasHist = parseInputNumber(String(merged.cuotas_historicas || '0'));
    const montoHist = parseInputNumber(String(merged.monto_historico_proveedor_usd || '0'));
    setHasHistoricalContext(cuotasHist > 0 || montoHist > 0);
    setRemoveExistingFactura(false);
    setFacturaFile(null);
    setSoportesFiles([]);
    setExistingSoportesEdit(Array.isArray(existingSoportesUrls) ? existingSoportesUrls : []);
    // Importante: solo inicializamos al cambiar el gasto en edición.
    // Evitamos depender de objetos/arrays recreados por re-renders del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gastoId]);

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
    const totalCuotasCanonico = Math.max(1, parseInt(String(form.total_cuotas || '1'), 10) || 1);
    const cuotasHistoricasCanonico = hasHistoricalContext
      ? Math.max(0, Math.trunc(parseInputNumber(form.cuotas_historicas || '0')))
      : 0;
    if (cuotasHistoricasCanonico >= totalCuotasCanonico) {
      alert('Las cuotas históricas deben ser menores al total de cuotas.');
      return;
    }
    const montoHistoricoProveedorCanonico = hasHistoricalContext
      ? parseInputNumber(form.monto_historico_proveedor_usd || '0')
      : 0;
    const equivalenteTotalUsd = tasaCanonica > 0 ? (montoCanonico / tasaCanonica) : 0;
    if (montoHistoricoProveedorCanonico < 0 || montoHistoricoProveedorCanonico > equivalenteTotalUsd + 0.005) {
      alert('El pago histórico del proveedor no puede superar el monto total en USD del gasto.');
      return;
    }
    
    const formData = new FormData();
    (Object.keys(form) as Array<keyof FormState>).forEach((key: keyof FormState) => {
      if (key === 'asignacion_tipo') formData.append('tipo', form[key]);
      else if (key === 'monto_bs') formData.append('monto_bs', montoCanonico.toFixed(2));
      else if (key === 'tasa_cambio') formData.append('tasa_cambio', tasaCanonica.toFixed(4));
      else if (key === 'cuotas_historicas') formData.append('cuotas_historicas', String(cuotasHistoricasCanonico));
      else if (key === 'monto_historico_proveedor_usd') formData.append('monto_historico_proveedor_usd', montoHistoricoProveedorCanonico.toFixed(2));
      else formData.append(key, form[key]);
    });
    
    if (facturaFile) formData.append('factura_img', facturaFile);
    if (removeExistingFactura) formData.append('remove_factura_img', '1');
    if (mode === 'edit') formData.append('keep_imagenes', JSON.stringify(existingSoportesEdit));
    soportesFiles.forEach((file: File) => formData.append('soportes', file));

    const endpoint = mode === 'edit' && gastoId ? `${API_BASE_URL}/gastos/${gastoId}` : `${API_BASE_URL}/gastos`;
    const method = mode === 'edit' ? 'PUT' : 'POST';
    const res = await fetch(endpoint, {
        method,
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
    <ModalBase onClose={onClose} title={mode === 'edit' ? 'Editar Gasto' : 'Registrar Gasto'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha factura / recibo</label>
              <DatePicker
                selected={ymdToDate(form.fecha_gasto)}
                onChange={(date: Date | null) => setForm((prev: FormState) => ({ ...prev, fecha_gasto: dateToYmd(date) }))}
                maxDate={new Date()}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Opcional (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-[50px] w-full rounded-xl border border-gray-200 bg-gray-50 p-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">N.º recibo / factura</label>
              <input
                type="text"
                name="numero_documento"
                value={form.numero_documento}
                onChange={handleChange}
                placeholder="Opcional"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </div>
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

          {mode === 'create' && (
            <div className="md:col-span-2 grid grid-cols-1 gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/40">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={hasHistoricalContext}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasHistoricalContext(checked);
                    if (!checked) {
                      setForm((prev: FormState) => ({ ...prev, cuotas_historicas: '0', monto_historico_proveedor_usd: '' }));
                    }
                  }}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                Tiene pagos/cuotas históricas previas al arranque
              </label>
              {hasHistoricalContext && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Cuotas ya transcurridas</label>
                    <div className="flex items-center border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                      <button
                        type="button"
                        onClick={() => setForm((prev: FormState) => ({ ...prev, cuotas_historicas: String(Math.max(0, (parseInt(prev.cuotas_historicas || '0', 10) || 0) - 1)) }))}
                        className="px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        readOnly
                        value={`${form.cuotas_historicas || '0'} cuota(s)`}
                        className="w-full text-center bg-transparent font-medium dark:text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev: FormState) => {
                            const current = parseInt(prev.cuotas_historicas || '0', 10) || 0;
                            const max = Math.max(0, (parseInt(prev.total_cuotas || '1', 10) || 1) - 1);
                            return { ...prev, cuotas_historicas: String(Math.min(max, current + 1)) };
                          })
                        }
                        className="px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Pago histórico al proveedor (USD)</label>
                    <input
                      type="text"
                      name="monto_historico_proveedor_usd"
                      value={form.monto_historico_proveedor_usd}
                      onChange={handleMonedaChange}
                      placeholder="0,00"
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white font-mono text-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna</label>
            <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows={2} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
            <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
              Archivos permitidos: Factura o recibo permite imagen o PDF. Soportes permiten imagen o PDF. Limites: maximo 4 soportes y cada PDF hasta 1 MB.
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📸 Factura o recibo (1 archivo)</label>
              {mode === 'edit' && existingFacturaUrl && !removeExistingFactura && (
                <div className="mb-2 rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                  <p className="mb-2 font-semibold text-gray-600 dark:text-gray-300">Archivo actual</p>
                  {String(existingFacturaUrl).toLowerCase().endsWith('.pdf') ? (
                    <a
                      href={`${API_BASE_URL}${existingFacturaUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      Ver PDF actual
                    </a>
                  ) : (
                    <a href={`${API_BASE_URL}${existingFacturaUrl}`} target="_blank" rel="noreferrer">
                      <img
                        src={`${API_BASE_URL}${existingFacturaUrl}`}
                        alt="Factura actual"
                        className="h-20 w-full max-w-[220px] rounded-md border border-gray-200 object-cover dark:border-gray-700"
                      />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveExistingFactura(true);
                      setFacturaFile(null);
                    }}
                    className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40"
                  >
                    Eliminar archivo actual
                  </button>
                </div>
              )}

              {mode === 'edit' && removeExistingFactura && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  El archivo actual sera eliminado al guardar.
                </div>
              )}

              {(mode !== 'edit' || !existingFacturaUrl || removeExistingFactura) && (
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const selected = e.target.files?.[0] || null;
                    setFacturaFile(selected);
                    if (selected) setRemoveExistingFactura(false);
                  }}
                  className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 text-xs cursor-pointer"
                />
              )}
              {mode === 'edit' && existingFacturaUrl && facturaFile && (
                <p className="mt-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  El nuevo archivo reemplazara al archivo actual al guardar.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">📎 Soportes (Máx 4, PDF hasta 1 MB)</label>
              {(mode === 'edit' && existingSoportesEdit.length > 0) && (
                <div className="mb-2 space-y-1 rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                  <p className="font-semibold text-gray-600 dark:text-gray-300">Soportes actuales ({existingSoportesEdit.length}/4)</p>
                  <div className="space-y-1">
                    {existingSoportesEdit.map((path, idx) => (
                      <div key={`${path}-${idx}`} className="flex items-center justify-between gap-2">
                        <a
                          href={`${API_BASE_URL}${path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-700 hover:underline dark:text-blue-300"
                          title={path}
                        >
                          {String(path).toLowerCase().endsWith('.pdf') ? `PDF ${idx + 1}` : `Imagen ${idx + 1}`}
                        </a>
                        <button
                          type="button"
                          onClick={() => setExistingSoportesEdit((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {soportesFiles.length > 0 && (
                <div className="mb-2 space-y-1 rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                  <p className="font-semibold text-gray-600 dark:text-gray-300">Nuevos soportes ({soportesFiles.length})</p>
                  {soportesFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2">
                      <span className="truncate text-gray-700 dark:text-gray-300" title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setSoportesFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const ocupados = (mode === 'edit' ? existingSoportesEdit.length : 0) + soportesFiles.length;
                const cupos = Math.max(0, 4 - ocupados);
                if (cupos <= 0) {
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      Ya tienes 4 soportes cargados. Elimina alguno para poder agregar otro.
                    </div>
                  );
                }
                return (
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const sel = Array.from(e.target.files || []);
                      if (sel.length > cupos) {
                        alert(`Solo puedes agregar ${cupos} soporte(s) adicional(es).`);
                        e.target.value = '';
                        return;
                      }
                      const pdfMayorA1Mb = sel.find((f) => f.type === 'application/pdf' && f.size > MAX_PDF_SIZE_BYTES);
                      if (pdfMayorA1Mb) {
                        alert(`El PDF "${pdfMayorA1Mb.name}" supera 1 MB.`);
                        e.target.value = '';
                        return;
                      }
                      setSoportesFiles((prev) => [...prev, ...sel]);
                      e.target.value = '';
                    }}
                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-300 text-xs cursor-pointer"
                  />
                );
              })()}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-bold transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all shadow-md">
              {mode === 'edit' ? 'Guardar Cambios' : 'Guardar Gasto'}
            </button>
          </div>
      </form>
    </ModalBase>
  );
};

// Pequeña función de apoyo para el render de la etiqueta verde del equivalente a USD
function formatMoneyDisplay(value: string | number): string {
  const parts = Number(value).toFixed(2).split('.');
  parts[0] = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
}

export default ModalAgregarGasto;




