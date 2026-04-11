import React, { useMemo, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from './ui/ModalBase';
import DatePicker from './ui/DatePicker';
import SearchableCombobox from './ui/SearchableCombobox';
import type { SearchableComboboxOption } from './ui/SearchableCombobox';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../config/api';

interface ModalAgregarGastoProps {
  onClose: () => void;
  onSuccess: () => void;
  proveedores: Proveedor[];
  zonas: Zona[];
  propiedades: Propiedad[];
  bancos: BancoCuenta[];
  fondos: Fondo[];
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

interface BancoCuenta {
  id: number | string;
  nombre?: string;
  banco?: string;
}

interface Fondo {
  id: number | string;
  nombre: string;
  moneda?: string;
  cuenta_bancaria_id: number | string;
  nombre_banco?: string;
  apodo?: string | null;
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
  monto_historico_proveedor_bs: string;
  monto_historico_recaudado_usd: string;
  monto_historico_recaudado_bs: string;
  historico_en_cuenta: boolean;
  historico_cuenta_bancaria_id: string;
  historico_fondo_id: string;
  tasa_historica: string;
}

type TipoRegistroGasto = 'nuevo' | 'historico';

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
  bancos,
  fondos,
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
    monto_historico_proveedor_bs: '',
    monto_historico_recaudado_usd: '',
    monto_historico_recaudado_bs: '',
    historico_en_cuenta: false,
    historico_cuenta_bancaria_id: '',
    historico_fondo_id: '',
    tasa_historica: '',
  });

  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [soportesFiles, setSoportesFiles] = useState<File[]>([]);
  const [removeExistingFactura, setRemoveExistingFactura] = useState<boolean>(false);
  const [existingSoportesEdit, setExistingSoportesEdit] = useState<string[]>([]);
  
  // NUEVO: Estado para el loading de la tasa BCV
  const [loadingBCV, setLoadingBCV] = useState<boolean>(false);
  const [hasHistoricalContext, setHasHistoricalContext] = useState<boolean>(false);
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistroGasto>('nuevo');
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState<boolean>(false);
  const facturaInputRef = React.useRef<HTMLInputElement | null>(null);
  const soportesInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (mode !== 'edit') {
      setHasHistoricalContext(false);
      return;
    }
    const merged = {
      ...form,
      ...initialValues,
      historico_en_cuenta: Boolean(initialValues?.historico_en_cuenta),
      historico_cuenta_bancaria_id: String(initialValues?.historico_cuenta_bancaria_id || ''),
      historico_fondo_id: String(initialValues?.historico_fondo_id || ''),
    } as FormState;
    setForm(merged);
    const esHistoricoInitial = Boolean((initialValues as { es_historico?: boolean | string | number })?.es_historico);
    setTipoRegistro(esHistoricoInitial ? 'historico' : 'nuevo');
    const cuotasHist = parseInputNumber(String(merged.cuotas_historicas || '0'));
    const montoHistUsd = parseInputNumber(String(merged.monto_historico_proveedor_usd || '0'));
    const montoHistBs = parseInputNumber(String(merged.monto_historico_proveedor_bs || '0'));
    const montoRecaudadoHistUsd = parseInputNumber(String(merged.monto_historico_recaudado_usd || '0'));
    const montoRecaudadoHistBs = parseInputNumber(String(merged.monto_historico_recaudado_bs || '0'));
    setHasHistoricalContext(cuotasHist > 0 || montoHistUsd > 0 || montoHistBs > 0 || montoRecaudadoHistUsd > 0 || montoRecaudadoHistBs > 0);
    setRemoveExistingFactura(false);
    setFacturaFile(null);
    setSoportesFiles([]);
    setExistingSoportesEdit(Array.isArray(existingSoportesUrls) ? existingSoportesUrls : []);
    // Importante: solo inicializamos al cambiar el gasto en edición.
    // Evitamos depender de objetos/arrays recreados por re-renders del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gastoId]);



  React.useEffect(() => {
    if (tipoRegistro !== 'historico') return;
    setHasHistoricalContext(true);
    setForm((prev: FormState) => ({ ...prev, cuotas_historicas: String(Math.max(1, parseInt(prev.total_cuotas || '1', 10) || 1)) }));
  }, [tipoRegistro]);

  React.useEffect(() => {
    if (tipoRegistro !== 'historico') return;
    setForm((prev: FormState) => ({ ...prev, cuotas_historicas: String(Math.max(1, parseInt(prev.total_cuotas || '1', 10) || 1)) }));
  }, [form.total_cuotas, tipoRegistro]);

  const parseInputNumber = (txt: string): number => {
    const cleaned = String(txt || '').trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const montoBsNum = parseInputNumber(form.monto_bs);
  const tasaNum = parseInputNumber(form.tasa_cambio);
  const equivalenteUSD = tasaNum > 0 ? (montoBsNum / tasaNum).toFixed(2) : '0.00';
  const montoHistProvUsdNum = parseInputNumber(form.monto_historico_proveedor_usd);
  const montoHistProvBsNum = parseInputNumber(form.monto_historico_proveedor_bs);
  const montoHistRecUsdNum = parseInputNumber(form.monto_historico_recaudado_usd);
  const montoHistRecBsNum = parseInputNumber(form.monto_historico_recaudado_bs);
  const cuotasHistoricasNum = Math.max(0, parseInt(form.cuotas_historicas || '0', 10) || 0);
  const showHistoricoCuenta = montoHistRecUsdNum > 0 || montoHistRecBsNum > 0;

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

  const handleCuotasHistoricasChange = (delta: number): void => {
    if (tipoRegistro === 'historico') return;
    setForm((prev: FormState) => {
      const total = Math.max(1, parseInt(prev.total_cuotas || '1', 10) || 1);
      const current = Math.max(0, parseInt(prev.cuotas_historicas || '0', 10) || 0);
      const max = Math.max(0, total - 1);
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, cuotas_historicas: String(next) };
    });
  };

  const cuentaOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (bancos || []).map((b) => {
        const id = String(b.id);
        const nombre = String(b.nombre || b.banco || `Cuenta ${id}`);
        const banco = String(b.banco || '');
        const label = banco ? `${nombre} (${banco})` : nombre;
        return { value: id, label, searchText: `${nombre} ${banco}` };
      }),
    [bancos]
  );

  const fondosCuentaSeleccionada = useMemo(
    () => (fondos || []).filter((f) => String(f.cuenta_bancaria_id) === String(form.historico_cuenta_bancaria_id || '')),
    [fondos, form.historico_cuenta_bancaria_id]
  );

  const fondoOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      fondosCuentaSeleccionada.map((f) => {
        const moneda = String(f.moneda || '').toUpperCase();
        const banco = String(f.nombre_banco || f.apodo || '');
        const labelBase = `${f.nombre}${moneda ? ` (${moneda})` : ''}`;
        const label = banco ? `${labelBase} - ${banco}` : labelBase;
        return { value: String(f.id), label, searchText: `${f.nombre} ${moneda} ${banco}` };
      }),
    [fondosCuentaSeleccionada]
  );

  React.useEffect(() => {
    if (!form.historico_fondo_id) return;
    const exists = fondoOptions.some((opt) => opt.value === form.historico_fondo_id);
    if (!exists) setForm((prev: FormState) => ({ ...prev, historico_fondo_id: '' }));
  }, [fondoOptions, form.historico_fondo_id]);

  React.useEffect(() => {
    if (showHistoricoCuenta) return;
    setForm((prev: FormState) => ({
      ...prev,
      historico_en_cuenta: false,
      historico_cuenta_bancaria_id: '',
      historico_fondo_id: '',
    }));
  }, [showHistoricoCuenta]);

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
    const montoCanonicoUsd = montoCanonico / tasaCanonica;
    const totalCuotasCanonico = Math.max(1, parseInt(String(form.total_cuotas || '1'), 10) || 1);
    const esHistorico = tipoRegistro === 'historico';
    const cuotasHistoricasCanonico = hasHistoricalContext
      ? Math.max(0, Math.trunc(parseInputNumber(form.cuotas_historicas || '0')))
      : 0;
    const maxCuotasHistoricas = esHistorico ? totalCuotasCanonico : Math.max(0, totalCuotasCanonico - 1);
    if (cuotasHistoricasCanonico > maxCuotasHistoricas) {
      alert(esHistorico ? 'Las cuotas históricas no pueden superar el total de cuotas.' : 'Las cuotas históricas deben ser menores al total de cuotas.');
      return;
    }
    const montoHistoricoProveedorUsdCanonico = hasHistoricalContext
      ? parseInputNumber(form.monto_historico_proveedor_usd || '0')
      : 0;
    const montoHistoricoProveedorBsCanonico = hasHistoricalContext
      ? parseInputNumber(form.monto_historico_proveedor_bs || '0')
      : 0;
    const montoHistoricoRecaudadoUsdCanonico = hasHistoricalContext
      ? parseInputNumber(form.monto_historico_recaudado_usd || '0')
      : 0;
    const montoHistoricoRecaudadoBsCanonico = hasHistoricalContext
      ? parseInputNumber(form.monto_historico_recaudado_bs || '0')
      : 0;
    if (montoHistoricoProveedorUsdCanonico < 0 || montoHistoricoProveedorBsCanonico < 0 || montoHistoricoRecaudadoUsdCanonico < 0 || montoHistoricoRecaudadoBsCanonico < 0) {
      alert('Los montos históricos no pueden ser negativos.');
      return;
    }
    if (montoHistoricoProveedorBsCanonico > montoCanonico + 0.005 || montoHistoricoRecaudadoBsCanonico > montoCanonico + 0.005) {
      alert('Los montos históricos en Bs no pueden superar el monto del gasto en Bs.');
      return;
    }
    if (montoHistoricoProveedorUsdCanonico > montoCanonicoUsd + 0.005 || montoHistoricoRecaudadoUsdCanonico > montoCanonicoUsd + 0.005) {
      alert('Los montos históricos en USD no pueden superar el monto total del gasto en USD.');
      return;
    }
    if (showHistoricoCuenta && form.historico_en_cuenta) {
      if (!form.historico_cuenta_bancaria_id || !form.historico_fondo_id) {
        alert('Debes seleccionar la cuenta bancaria y el fondo donde está la recaudación histórica.');
        return;
      }
    }
    if (showHistoricoCuenta && !form.historico_en_cuenta) {
      setForm((prev: FormState) => ({
        ...prev,
        historico_cuenta_bancaria_id: '',
        historico_fondo_id: '',
      }));
    }
    if (tipoRegistro === 'historico' && cuotasHistoricasCanonico !== totalCuotasCanonico) {
      alert('En gasto histórico, las cuotas transcurridas deben igualar el total de cuotas.');
      return;
    }
    
    const formData = new FormData();
    (Object.keys(form) as Array<keyof FormState>).forEach((key: keyof FormState) => {
      if (key === 'asignacion_tipo') formData.append('tipo', form[key]);
      else if (key === 'monto_bs') formData.append('monto_bs', montoCanonico.toFixed(2));
      else if (key === 'tasa_cambio') formData.append('tasa_cambio', tasaCanonica.toFixed(4));
      else if (key === 'cuotas_historicas') formData.append('cuotas_historicas', String(cuotasHistoricasCanonico));
      else if (key === 'monto_historico_proveedor_usd') formData.append('monto_historico_proveedor_usd', montoHistoricoProveedorUsdCanonico.toFixed(2));
      else if (key === 'monto_historico_proveedor_bs') formData.append('monto_historico_proveedor_bs', montoHistoricoProveedorBsCanonico.toFixed(2));
      else if (key === 'monto_historico_recaudado_usd') formData.append('monto_historico_recaudado_usd', montoHistoricoRecaudadoUsdCanonico.toFixed(2));
      else if (key === 'monto_historico_recaudado_bs') formData.append('monto_historico_recaudado_bs', montoHistoricoRecaudadoBsCanonico.toFixed(2));
      else if (key === 'historico_en_cuenta') formData.append('historico_en_cuenta', form.historico_en_cuenta ? '1' : '0');
      else if (key === 'tasa_historica') {
        // Campo legado, no requerido en frontend.
      } else formData.append(key, String(form[key]));
    });
    formData.append('es_historico', esHistorico ? '1' : '0');
    
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
    <ModalBase onClose={onClose} title={mode === 'edit' ? 'Editar Gasto' : 'Registrar Gasto'} maxWidth="max-w-6xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="xl:col-span-2 rounded-2xl border border-indigo-300/80 bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 p-4 shadow-sm dark:border-indigo-700/60 dark:from-indigo-900/30 dark:via-blue-900/20 dark:to-sky-900/20">
            <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-2">
              Tipo de registro
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoRegistro('nuevo')}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  tipoRegistro === 'nuevo'
                    ? 'border-emerald-500 bg-white text-emerald-700 shadow-md ring-2 ring-emerald-200 dark:bg-gray-800 dark:text-emerald-300 dark:ring-emerald-900/50'
                    : 'border-indigo-200 bg-transparent text-indigo-700 hover:bg-white/70 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">Gasto nuevo</p>
                  {tipoRegistro === 'nuevo' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Activo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold opacity-90">Se incluye en avisos de cobro y funciona como hasta ahora.</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoRegistro('historico')}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  tipoRegistro === 'historico'
                    ? 'border-amber-500 bg-white text-amber-800 shadow-md ring-2 ring-amber-200 dark:bg-gray-800 dark:text-amber-300 dark:ring-amber-900/50'
                    : 'border-indigo-200 bg-transparent text-indigo-700 hover:bg-white/70 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">Gasto histórico</p>
                  {tipoRegistro === 'historico' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Activo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold opacity-90">No se reflejará en avisos de cobro. Queda para control histórico y recaudación manual.</p>
              </button>
            </div>
          </div>
          <div className="xl:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
              <option value="">Seleccione...</option>
              {proveedores.map((p: Proveedor) => <option key={p.id} value={p.id}>{p.nombre} ({p.identificador})</option>)}
            </select>
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-3 gap-5">
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

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-5">
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
          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-5">
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

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
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

          <div className="xl:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota Interna</label>
            <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows={2} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Configuración histórica</p>
              <button
                type="button"
                onClick={() => {
                  if (!hasHistoricalContext) setHasHistoricalContext(true);
                  setIsHistoricalModalOpen(true);
                }}
                className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
              >
                Configurar histórico
              </button>
            </div>
            {hasHistoricalContext ? (
              <div className="rounded-xl border border-amber-300/60 bg-white/70 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-700/40 dark:bg-gray-900/30 dark:text-amber-200">
                <p>Cuotas históricas: {cuotasHistoricasNum}</p>
                <p>Proveedor: ${formatMoneyDisplay(montoHistProvUsdNum)} USD / Bs {formatMoneyDisplay(montoHistProvBsNum)}</p>
                <p>Recaudado: ${formatMoneyDisplay(montoHistRecUsdNum)} USD / Bs {formatMoneyDisplay(montoHistRecBsNum)}</p>
                {form.historico_en_cuenta && form.historico_cuenta_bancaria_id && form.historico_fondo_id && (
                  <p className="mt-1">Sincronizado en cuenta/fondo.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">Sin datos históricos configurados.</p>
            )}
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
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
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => facturaInputRef.current?.click()}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                  >
                    {facturaFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                  </button>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {facturaFile ? facturaFile.name : 'Ningún archivo seleccionado'}
                  </p>
                  <input
                    ref={facturaInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const selected = e.target.files?.[0] || null;
                      setFacturaFile(selected);
                      if (selected) setRemoveExistingFactura(false);
                    }}
                    className="hidden"
                  />
                </div>
              )}
              {mode === 'edit' && existingFacturaUrl && facturaFile && (
                <p className="mt-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  El nuevo archivo reemplazará al archivo actual al guardar.
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
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => soportesInputRef.current?.click()}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Agregar soportes
                    </button>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {soportesFiles.length > 0 ? `${soportesFiles.length} archivos seleccionados` : 'Sin archivos seleccionados'}
                    </p>
                    <input
                      ref={soportesInputRef}
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
                      className="hidden"
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="xl:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-bold transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all shadow-md">
              {mode === 'edit' ? 'Guardar Cambios' : 'Guardar Gasto'}
            </button>
          </div>
      </form>
      {isHistoricalModalOpen && (
        <div className="fixed inset-0 z-[270] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">Datos históricos del gasto</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Registra montos en USD y Bs sin tasa histórica.</p>
              </div>
              <button type="button" onClick={() => setIsHistoricalModalOpen(false)} className="h-9 w-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                x
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Cuotas ya transcurridas</label>
                <div className="flex items-center border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                  <button type="button" onClick={() => handleCuotasHistoricasChange(-1)} disabled={tipoRegistro === 'historico'} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors">-</button>
                  <input type="text" readOnly value={`${form.cuotas_historicas || '0'} cuota(s)`} className="w-full text-center bg-transparent font-medium dark:text-white outline-none" />
                  <button type="button" onClick={() => handleCuotasHistoricasChange(1)} disabled={tipoRegistro === 'historico'} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors">+</button>
                </div>
                {tipoRegistro === 'historico' && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Bloqueado: en gasto histórico equivale al total de cuotas.</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                <p>Total del gasto: Bs {formatMoneyDisplay(montoBsNum)} / ${formatMoneyDisplay(equivalenteUSD)} USD</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Pago histórico proveedor (USD)</label>
                <input type="text" name="monto_historico_proveedor_usd" value={form.monto_historico_proveedor_usd} onChange={handleMonedaChange} placeholder="0,00" className="w-full p-3 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white bg-white dark:bg-gray-800 font-mono text-lg" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Pago histórico proveedor (Bs)</label>
                <input type="text" name="monto_historico_proveedor_bs" value={form.monto_historico_proveedor_bs} onChange={handleMonedaChange} placeholder="0,00" className="w-full p-3 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white bg-white dark:bg-gray-800 font-mono text-lg" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Recaudación histórica (USD)</label>
                <input type="text" name="monto_historico_recaudado_usd" value={form.monto_historico_recaudado_usd} onChange={handleMonedaChange} placeholder="0,00" className="w-full p-3 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white bg-white dark:bg-gray-800 font-mono text-lg" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Recaudación histórica (Bs)</label>
                <input type="text" name="monto_historico_recaudado_bs" value={form.monto_historico_recaudado_bs} onChange={handleMonedaChange} placeholder="0,00" className="w-full p-3 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white bg-white dark:bg-gray-800 font-mono text-lg" />
              </div>

              {showHistoricoCuenta && (
                <div className="md:col-span-2 grid grid-cols-1 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800/50 dark:bg-emerald-900/10">
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    <input
                      type="checkbox"
                      checked={form.historico_en_cuenta}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev: FormState) => ({
                          ...prev,
                          historico_en_cuenta: checked,
                          historico_cuenta_bancaria_id: checked ? prev.historico_cuenta_bancaria_id : '',
                          historico_fondo_id: checked ? prev.historico_fondo_id : '',
                        }));
                      }}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Está actualmente en alguna cuenta bancaria del condominio
                  </label>
                  {form.historico_en_cuenta && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">Cuenta bancaria</label>
                        <SearchableCombobox
                          options={cuentaOptions}
                          value={form.historico_cuenta_bancaria_id}
                          onChange={(value) =>
                            setForm((prev: FormState) => ({
                              ...prev,
                              historico_cuenta_bancaria_id: value,
                              historico_fondo_id: '',
                            }))
                          }
                          placeholder="Buscar cuenta..."
                          emptyMessage="Sin cuentas"
                          className="w-full h-[46px] px-3 rounded-xl border border-emerald-300 bg-white outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1">Fondo destino</label>
                        <SearchableCombobox
                          options={fondoOptions}
                          value={form.historico_fondo_id}
                          onChange={(value) => setForm((prev: FormState) => ({ ...prev, historico_fondo_id: value }))}
                          placeholder={form.historico_cuenta_bancaria_id ? 'Buscar fondo...' : 'Primero selecciona cuenta'}
                          emptyMessage="Sin fondos para esta cuenta"
                          disabled={!form.historico_cuenta_bancaria_id}
                          className="w-full h-[46px] px-3 rounded-xl border border-emerald-300 bg-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setHasHistoricalContext(false);
                  setForm((prev: FormState) => ({
                    ...prev,
                    cuotas_historicas: tipoRegistro === 'historico' ? prev.total_cuotas : '0',
                    monto_historico_proveedor_usd: '',
                    monto_historico_proveedor_bs: '',
                    monto_historico_recaudado_usd: '',
                    monto_historico_recaudado_bs: '',
                    historico_en_cuenta: false,
                    historico_cuenta_bancaria_id: '',
                    historico_fondo_id: '',
                  }));
                }}
                className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold hover:bg-red-100 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300"
              >
                Limpiar
              </button>
              <button type="button" onClick={() => setIsHistoricalModalOpen(false)} className="px-4 py-2 rounded-xl bg-donezo-primary text-white font-bold hover:bg-blue-700">
                Guardar historial
              </button>
            </div>
          </div>
        </div>
      )}
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














