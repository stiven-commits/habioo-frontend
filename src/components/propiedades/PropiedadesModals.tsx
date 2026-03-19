
import {
  useEffect,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FC,
  type FormEvent,
  type SetStateAction,
} from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { formatMoney } from '../../utils/currency';
import { formatDateTimeVE, formatDateVE } from '../../utils/datetime';
import 'react-datepicker/dist/react-datepicker.css';

interface PropiedadFormData {
  identificador: string;
  alicuota: string;
  propietario_modo: 'NUEVO' | 'EXISTENTE';
  propietario_existente_id: string;
  saldo_inicial_bs?: string;
  tasa_bcv?: string;
  monto_saldo_inicial: string;
  prop_cedula: string;
  prop_nombre: string;
  prop_email: string;
  prop_email_secundario: string;
  prop_telefono: string;
  prop_telefono_secundario: string;
  prop_password: string;
  tiene_inquilino: boolean;
  inq_cedula: string;
  inq_nombre: string;
  inq_email: string;
  inq_telefono: string;
  inq_permitir_acceso?: boolean;
  tiene_deuda_inicial?: boolean;
  deudas_iniciales?: Array<{
    concepto: string;
    monto_deuda: string;
    monto_abono: string;
  }>;
}

interface BcvApiResponse {
  promedio?: number | string;
}

interface ModalPropiedadFormProps {
  isOpen: boolean;
  editingId: string | number | null;
  form: PropiedadFormData;
  setForm: Dispatch<SetStateAction<PropiedadFormData>>;
  propietariosExistentes: PropietarioExistente[];
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
}

interface PropietarioExistente {
  id: number;
  cedula: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

interface EstadoCuentaPropiedad {
  identificador: string;
  prop_nombre: string;
  inq_nombre?: string;
  [key: string]: unknown;
}

interface EstadoCuentaMovimiento {
  fecha_operacion: string;
  fecha_registro: string;
  tipo: string;
  concepto: string;
  monto_bs: number;
  tasa_cambio: number;
  cargo: number;
  abono: number;
  saldoFila: number;
}

interface ModalEstadoCuentaProps {
  isOpen: boolean;
  selectedPropCuenta: EstadoCuentaPropiedad | null;
  setEstadoCuentaModalOpen: Dispatch<SetStateAction<boolean>>;
  selectedPropAjuste: unknown;
  fechaDesde: string;
  setFechaDesde: Dispatch<SetStateAction<string>>;
  fechaHasta: string;
  setFechaHasta: Dispatch<SetStateAction<string>>;
  handleOpenAjuste: (propiedad: EstadoCuentaPropiedad) => void | Promise<void>;
  loadingCuenta: boolean;
  estadoCuentaFiltrado: EstadoCuentaMovimiento[];
  showAjuste?: boolean;
}

interface AjusteSaldoFormData {
  tipo_ajuste: string;
  monto: string;
  nota: string;
}

interface PropiedadAjuste {
  identificador: string;
  [key: string]: unknown;
}

interface ModalAjusteSaldoProps {
  isOpen: boolean;
  selectedPropAjuste: PropiedadAjuste | null;
  setAjusteModalOpen: Dispatch<SetStateAction<boolean>>;
  formAjuste: AjusteSaldoFormData;
  setFormAjuste: Dispatch<SetStateAction<AjusteSaldoFormData>>;
  handleSubmitAjuste: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

interface LotePropiedadRow {
  isValid: boolean;
  errors: string;
  identificador: string;
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  alicuota: number | string;
  saldo_inicial: number | string;
}

interface ModalCargaMasivaProps {
  isOpen: boolean;
  setLoteModalOpen: Dispatch<SetStateAction<boolean>>;
  loteData: LotePropiedadRow[];
  setLoteData: Dispatch<SetStateAction<LotePropiedadRow[]>>;
  loteErrors: number;
  montoTotalIngresoLote: number;
  isUploadingLote: boolean;
  uploadProgress: number;
  handleDownloadTemplate: () => void | Promise<void>;
  handleSaveLote: () => void | Promise<void>;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
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

interface CopropietarioFormData {
  cedula: string;
  nombre: string;
  email: string;
  telefono: string;
  acceso_portal: boolean;
}

interface CopropietarioItem extends CopropietarioFormData {
  id: number;
  user_id: number;
  propiedad_id: number;
  rol: string;
}

interface ModalCopropietarioFormProps {
  isOpen: boolean;
  propiedadIdentificador: string;
  form: CopropietarioFormData;
  copropietarios: CopropietarioItem[];
  copropietariosDraft: Record<number, CopropietarioFormData>;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEditChange: (copropId: number, e: ChangeEvent<HTMLInputElement>) => void;
  onSaveEdit: (copropId: number) => void | Promise<void>;
  onDelete: (copropId: number) => void | Promise<void>;
  isSubmitting?: boolean;
  isLoadingList?: boolean;
  savingCopropId?: number | null;
  deletingCopropId?: number | null;
}

export const ModalPropiedadForm: FC<ModalPropiedadFormProps> = ({
  isOpen,
  editingId,
  form,
  setForm,
  propietariosExistentes,
  handleChange,
  handleSubmit,
  setIsModalOpen
}) => {
  if (!isOpen) return null;

  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const [searchPropietarioExistente, setSearchPropietarioExistente] = useState<string>('');
  const [isPropietarioDropdownOpen, setIsPropietarioDropdownOpen] = useState<boolean>(false);

  const formatNumberInput = (value: string | number | undefined | null, maxDecimals = 2): string => {
    const strValue = String(value || '');
    const isNegative = strValue.trim().startsWith('-');
    let rawValue = strValue.replace(/[^0-9,]/g, '');
    if (isNegative && !rawValue) return '-';
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;
    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = decimalPart !== undefined ? `${integerPart},${decimalPart.slice(0, maxDecimals)}` : (integerPart || '');
    if (!formatted) return '';
    return isNegative ? `-${formatted}` : formatted;
  };

  const parseNumberInput = (value: string | number | undefined | null): number => {
    if (!value) return 0;
    return parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
  };

  const deudasIniciales = Array.isArray(form.deudas_iniciales) ? form.deudas_iniciales : [];
  const esModoPropietarioExistente = !editingId && form.propietario_modo === 'EXISTENTE';

  const propietariosFiltrados = propietariosExistentes.filter((item) => {
    const q = searchPropietarioExistente.trim().toLowerCase();
    if (!q) return true;
    return item.nombre.toLowerCase().includes(q) || item.cedula.toLowerCase().includes(q);
  });
  const propietarioSeleccionado = propietariosExistentes.find((item) => String(item.id) === form.propietario_existente_id) || null;

  const seleccionarPropietarioExistente = (idValue: string): void => {
    const selected = propietariosExistentes.find((item) => String(item.id) === idValue);
    if (!selected) {
      setForm((prev) => ({
        ...prev,
        propietario_existente_id: '',
        prop_cedula: '',
        prop_nombre: '',
        prop_email: '',
        prop_telefono: '',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      propietario_existente_id: String(selected.id),
      prop_cedula: selected.cedula,
      prop_nombre: selected.nombre,
      prop_email: selected.email || '',
      prop_telefono: selected.telefono || '',
      prop_password: '',
    }));
  };

  const updateDeudaInicial = (index: number, field: 'concepto' | 'monto_deuda' | 'monto_abono', value: string): void => {
    const next = deudasIniciales.map((item, i) => {
      if (i !== index) return item;
      if (field === 'concepto') return { ...item, [field]: value };
      return { ...item, [field]: formatNumberInput(value) };
    });
    setForm({ ...form, deudas_iniciales: next });
  };

  const addDeudaInicial = (): void => {
    setForm({
      ...form,
      deudas_iniciales: [...deudasIniciales, { concepto: '', monto_deuda: '', monto_abono: '' }]
    });
  };

  const removeDeudaInicial = (index: number): void => {
    const next = deudasIniciales.filter((_, i) => i !== index);
    setForm({
      ...form,
      deudas_iniciales: next.length > 0 ? next : [{ concepto: '', monto_deuda: '', monto_abono: '' }]
    });
  };

  const toggleDeudaInicial = (): void => {
    const nextEnabled = !form.tiene_deuda_inicial;
    setForm({
      ...form,
      tiene_deuda_inicial: nextEnabled,
      deudas_iniciales: nextEnabled
        ? (deudasIniciales.length > 0 ? deudasIniciales : [{ concepto: '', monto_deuda: '', monto_abono: '' }])
        : deudasIniciales,
      ...(nextEnabled ? { monto_saldo_inicial: '', saldo_inicial_bs: '', tasa_bcv: '' } : {})
    });
  };

  const handleSaldoBsChange = (value: string): void => {
    const saldoBs = formatNumberInput(value);
    const tasa = form.tasa_bcv || '';
    const saldoUsd = parseNumberInput(tasa) > 0 ? (parseNumberInput(saldoBs) / parseNumberInput(tasa)).toFixed(2).replace('.', ',') : '';
    setForm({ ...form, saldo_inicial_bs: saldoBs, monto_saldo_inicial: saldoUsd });
  };

  const handleTasaChange = (value: string): void => {
    const tasaBcv = formatNumberInput(value, 3);
    const saldoBs = form.saldo_inicial_bs || '';
    const saldoUsd = parseNumberInput(tasaBcv) > 0 ? (parseNumberInput(saldoBs) / parseNumberInput(tasaBcv)).toFixed(2).replace('.', ',') : '';
    setForm({ ...form, tasa_bcv: tasaBcv, monto_saldo_inicial: saldoUsd });
  };

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('API Error');
      const json: BcvApiResponse = (await response.json()) as BcvApiResponse;
      const rate = json?.promedio;
      if (!rate) {
        alert('No se pudo obtener la tasa BCV actual.');
        return;
      }
      const rateNumber = parseFloat(String(rate));
      const formattedRate = Number.isFinite(rateNumber) ? rateNumber.toFixed(3).replace('.', ',') : String(rate).replace('.', ',');
      handleTasaChange(formattedRate);
    } catch (error) {
      alert('Error al consultar BCV.');
    } finally {
      setIsFetchingBCV(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">X</button>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{editingId ? 'Editar Inmueble' : 'Nuevo Inmueble'}</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-donezo-primary mb-3 text-sm uppercase tracking-wider">1. Datos del Inmueble</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Identificador *</label>
                <input type="text" name="identificador" value={form.identificador} onChange={handleChange} placeholder="Ej: A-12 o Casa 3" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Alícuota (%) *</label>
                <input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} placeholder="Ej: 3,125" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" required />
              </div>

              {!editingId && (
                <div className="md:col-span-2 space-y-3">
                  <div
                    className="flex items-center gap-3 mb-1 cursor-pointer"
                    onClick={toggleDeudaInicial}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form.tiene_deuda_inicial)}
                      readOnly
                      className="w-5 h-5 text-donezo-primary"
                    />
                    <h4 className="font-bold text-gray-700 dark:text-gray-300">Crear deudas anteriores</h4>
                  </div>
                  {form.tiene_deuda_inicial ? (
                    <div className="space-y-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10 p-3">
                      {deudasIniciales.map((deuda, index) => (
                        <div key={`deuda-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                          <div className="md:col-span-6">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Concepto</label>
                            <input
                              type="text"
                              value={deuda.concepto}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'concepto', e.target.value)}
                              placeholder="Ej: Deuda mantenimiento enero"
                              className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Monto deuda ($)</label>
                            <input
                              type="text"
                              value={deuda.monto_deuda}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'monto_deuda', e.target.value)}
                              placeholder="0,00"
                              className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Monto abono ($)</label>
                            <input
                              type="text"
                              value={deuda.monto_abono}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'monto_abono', e.target.value)}
                              placeholder="Opcional"
                              className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                            />
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            <button
                              type="button"
                              onClick={addDeudaInicial}
                              className="flex-1 p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 font-bold text-sm"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDeudaInicial(index)}
                              className="flex-1 p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50 font-bold text-sm"
                            >
                              -
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Cálculo automático por fila: <strong>Saldo neto = Monto deuda - Monto abono</strong>.
                        Ejemplo: deuda 120,00 y abono 20,00 = saldo neto 100,00.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Saldo Inicial (Bs)</label>
                          <input
                            type="text"
                            value={form.saldo_inicial_bs || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleSaldoBsChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Tasa BCV</label>
                          <input
                            type="text"
                            value={form.tasa_bcv || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleTasaChange(e.target.value)}
                            placeholder="Ej: 36,500"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={fetchBCV}
                          disabled={isFetchingBCV}
                          className="w-full p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-60"
                        >
                          {isFetchingBCV ? 'Consultando...' : 'BCV'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Saldo Inicial (USD)</label>
                          <input
                            type="text"
                            name="monto_saldo_inicial"
                            value={form.monto_saldo_inicial}
                            readOnly
                            placeholder="Calculado automáticamente"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800/80 outline-none text-gray-600 dark:text-gray-300 font-mono cursor-not-allowed"
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Este campo se calcula automáticamente con la fórmula:
                          <strong> Saldo Inicial (USD) = Saldo Inicial (Bs) / Tasa BCV</strong>.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          El sistema interpreta el tipo por signo:
                          negativo = saldo a favor, positivo = deuda, cero = sin saldo.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <h4 className="font-bold text-blue-600 dark:text-blue-400 text-sm uppercase tracking-wider">2. Datos del Propietario (Login)</h4>
              {!editingId && (
                <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-600 p-1 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, propietario_modo: 'NUEVO', propietario_existente_id: '' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.propietario_modo === 'NUEVO' ? 'bg-donezo-primary text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    Propietario Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, propietario_modo: 'EXISTENTE' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.propietario_modo === 'EXISTENTE' ? 'bg-donezo-primary text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    Existente
                  </button>
                </div>
              )}
            </div>
            {esModoPropietarioExistente && (
              <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-900/40 p-3 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Buscar propietario existente</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchPropietarioExistente}
                      onFocus={() => setIsPropietarioDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsPropietarioDropdownOpen(false), 120)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setSearchPropietarioExistente(e.target.value);
                        setIsPropietarioDropdownOpen(true);
                      }}
                      placeholder={propietarioSeleccionado ? `${propietarioSeleccionado.nombre} (${propietarioSeleccionado.cedula})` : 'Escriba cédula o nombre'}
                      className="w-full p-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsPropietarioDropdownOpen((prev) => !prev);
                      }}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500"
                      title="Mostrar opciones"
                    >
                      ▼
                    </button>
                    {isPropietarioDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                        {propietariosFiltrados.length > 0 ? propietariosFiltrados.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              seleccionarPropietarioExistente(String(item.id));
                              setSearchPropietarioExistente('');
                              setIsPropietarioDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-100"
                          >
                            {item.nombre} ({item.cedula})
                          </button>
                        )) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No hay propietarios que coincidan
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="hidden" value={form.propietario_existente_id} required={esModoPropietarioExistente} />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Se vinculará este inmueble al propietario seleccionado sin crear un usuario nuevo.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Cédula (Usuario) *</label>
                <p className="text-[11px] text-gray-400 mb-1">Formato: V, E, J o G seguido de números.</p>
                <input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} pattern="^[VEJG][0-9]{5,9}$" placeholder="Ej: V12345678" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase disabled:opacity-70 disabled:cursor-not-allowed" required disabled={esModoPropietarioExistente} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label>
                <p className="text-[11px] text-transparent mb-1 select-none" aria-hidden="true">_</p>
                <input type="text" name="prop_nombre" value={form.prop_nombre} onChange={(e) => setForm((prev) => ({ ...prev, prop_nombre: e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }))} placeholder="Ej: Carlos Daniel Rojas" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Correo Electrónico *</label>
                <input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} placeholder="Ej: usuario@email.com" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Correo Secundario (Opcional)</label>
                <input type="email" name="prop_email_secundario" value={form.prop_email_secundario} onChange={handleChange} placeholder="Ej: usuario_sec@email.com" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Teléfono (WhatsApp)</label>
                <p className="text-[11px] text-gray-400 mb-1">Solo números, sin espacios ni guiones.</p>
                <input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" placeholder="Ej: 04141234567" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Teléfono Alternativo / Fijo</label>
                <p className="text-[11px] text-gray-400 mb-1">Solo números, sin espacios ni guiones.</p>
                <input type="text" name="prop_telefono_secundario" value={form.prop_telefono_secundario} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" placeholder="Ej: 02121234567" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </div>
              {editingId && (<div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800"><label className="block text-xs font-bold text-yellow-800 dark:text-yellow-500 mb-1">Restablecer Contraseña</label><input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Nueva clave..." className="w-full p-2.5 rounded-xl border border-yellow-300 dark:bg-gray-800 outline-none dark:text-white" /></div>)}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setForm({ ...form, tiene_inquilino: !form.tiene_inquilino })}><input type="checkbox" checked={form.tiene_inquilino} readOnly className="w-5 h-5 text-donezo-primary" /><h4 className="font-bold text-gray-700 dark:text-gray-300">¿Tiene residente?</h4></div>
            {form.tiene_inquilino && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <input type="text" name="inq_cedula" value={form.inq_cedula} onChange={handleChange} pattern="^[VEJG][0-9]{5,9}$" placeholder="Ej: V12345678" title="Cédula del residente (V/E/J/G + números)" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white uppercase" required />
                  <input type="text" name="inq_nombre" value={form.inq_nombre} onChange={handleChange} placeholder="Ej: Carlos Daniel Rojas" title="Nombre y apellido del residente" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                  <input type="email" name="inq_email" value={form.inq_email} onChange={handleChange} placeholder="Ej: residente@email.com" title="Correo del residente (opcional)" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <input type="text" name="inq_telefono" value={form.inq_telefono} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" placeholder="Ej: 04141234567" title="Teléfono del residente (solo números)" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    name="inq_permitir_acceso"
                    checked={form.inq_permitir_acceso !== false}
                    onChange={handleChange}
                    className="w-4 h-4 text-donezo-primary"
                  />
                  Permitir acceso del residente al portal
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" id="btnSubmitProp" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all">{editingId ? 'Guardar Cambios' : 'Registrar Inmueble'}</button></div>
        </form>
      </div>
    </div>
  );
};

export const ModalEstadoCuenta: FC<ModalEstadoCuentaProps> = ({
  isOpen,
  selectedPropCuenta,
  setEstadoCuentaModalOpen,
  selectedPropAjuste,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  handleOpenAjuste,
  loadingCuenta,
  estadoCuentaFiltrado,
  showAjuste = true
}) => {
  if (!isOpen || !selectedPropCuenta) return null;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 12;
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [isOpen, fechaDesde, fechaHasta, estadoCuentaFiltrado.length]);

  const totalPages = Math.ceil(estadoCuentaFiltrado.length / ITEMS_PER_PAGE);
  const movimientosPagina = estadoCuentaFiltrado.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const saldoFinal = estadoCuentaFiltrado.length > 0 ? (estadoCuentaFiltrado[estadoCuentaFiltrado.length - 1]?.saldoFila ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-[96vw] xl:max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
              {selectedPropCuenta.identificador} <span className="text-gray-300 font-normal">|</span> {selectedPropCuenta.prop_nombre}
            </h3>
            {selectedPropCuenta.inq_nombre && (
              <p className="text-sm font-medium text-gray-500 mt-1">Residente: <span className="text-gray-700 dark:text-gray-300">{selectedPropCuenta.inq_nombre}</span></p>
            )}
          </div>
          <button onClick={() => setEstadoCuentaModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">x</button>
        </div>

        <div className="px-6 py-4 flex flex-wrap justify-between items-end gap-4 bg-white dark:bg-donezo-card-dark border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-3 items-center">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
              <DatePicker
                selected={ymdToDate(fechaDesde)}
                onChange={(date: Date | Date[] | null) => setFechaDesde(dateToYmd(Array.isArray(date) ? (date[0] ?? null) : date))}
                selectsStart
                startDate={ymdToDate(fechaDesde)}
                endDate={ymdToDate(fechaHasta)}
                maxDate={ymdToDate(todayYmd) as Date}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Desde (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
              <DatePicker
                selected={ymdToDate(fechaHasta)}
                onChange={(date: Date | Date[] | null) => setFechaHasta(dateToYmd(Array.isArray(date) ? (date[0] ?? null) : date))}
                selectsEnd
                startDate={ymdToDate(fechaDesde)}
                endDate={ymdToDate(fechaHasta)}
                {...(fechaDesde ? { minDate: ymdToDate(fechaDesde) as Date } : {})}
                maxDate={ymdToDate(todayYmd) as Date}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Hasta (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 mt-5"
            >
              Limpiar
            </button>
          </div>
          {showAjuste && (
            <button onClick={() => handleOpenAjuste(selectedPropCuenta)} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2">
              Ajustar Saldo Manual
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-donezo-card-dark custom-scrollbar">
          {loadingCuenta ? <p className="text-center text-gray-400 py-10">Cargando movimientos...</p> : estadoCuentaFiltrado.length === 0 ? <p className="text-center text-gray-400 py-10">No hay movimientos en este rango de fechas.</p> : (
            <table className="w-full text-left border-collapse text-sm min-w-[1100px]">
              <thead className="sticky top-0 bg-white dark:bg-donezo-card-dark shadow-sm">
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="p-3 font-bold uppercase text-[11px]">Fecha Op.</th>
                  <th className="p-3 font-bold uppercase text-[11px]">Ingreso al Sistema</th>
                  <th className="p-3 font-bold uppercase text-[11px]">Concepto</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Monto Bs</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Tasa</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Cargos (Deuda)</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Abonos (Pago)</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right text-donezo-primary">Saldo Final</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-center">Ver</th>
                </tr>
              </thead>
              <tbody>
                {movimientosPagina.map((m, idx) => (
                  <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{formatDateVE(m.fecha_operacion)}</td>
                    <td className="p-3 text-gray-400 font-mono text-[10px]">{formatDateTimeVE(m.fecha_registro)}</td>
                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200">
                      {m.tipo === 'RECIBO' ? m.concepto : `${m.tipo === 'PAGO' ? 'PAGO' : 'AJUSTE'} ${m.concepto}`}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">{m.monto_bs ? `Bs ${formatMoney(m.monto_bs)}` : '-'}</td>
                    <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">{m.tasa_cambio ? formatMoney(m.tasa_cambio) : '-'}</td>
                    <td className="p-3 text-right text-red-500 font-mono font-medium">{m.cargo > 0 ? `$${formatMoney(m.cargo)}` : '-'}</td>
                    <td className="p-3 text-right text-green-500 font-mono font-medium">{m.abono > 0 ? `$${formatMoney(m.abono)}` : '-'}</td>
                    <td className="p-3 text-right font-mono font-black text-gray-800 dark:text-white">${formatMoney(m.saldoFila)}</td>
                    <td className="p-3 text-center">
                      {m.tipo === 'RECIBO' ? (
                        <button
                          type="button"
                          title="Ver detalle del aviso (proximamente)"
                          className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                        >
                          Ver
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                  <td colSpan={7} className="p-4 text-right font-black uppercase text-xs text-gray-600 dark:text-gray-300 tracking-wider">Saldo Final:</td>
                  <td className="p-4 text-right font-black text-donezo-primary dark:text-cyan-300 font-mono">${formatMoney(saldoFinal)}</td>
                  <td className="p-4"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        {!loadingCuenta && estadoCuentaFiltrado.length > 0 && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Anterior
            </button>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ModalAjusteSaldo: FC<ModalAjusteSaldoProps> = ({
  isOpen,
  selectedPropAjuste,
  setAjusteModalOpen,
  formAjuste,
  setFormAjuste,
  handleSubmitAjuste
}) => {
  if (!isOpen || !selectedPropAjuste) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={() => setAjusteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">X</button>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">Ajustar Saldo</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inmueble: <strong className="text-donezo-primary">{selectedPropAjuste.identificador}</strong></p>

        <form onSubmit={handleSubmitAjuste} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción a realizar</label>
            <select value={formAjuste.tipo_ajuste} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormAjuste({ ...formAjuste, tipo_ajuste: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
              <option value="CARGAR_DEUDA">Cargar Deuda (+)</option>
              <option value="AGREGAR_FAVOR">Agregar a Favor (-)</option>
            </select>
          </div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label><input type="text" value={formAjuste.monto} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormAjuste({ ...formAjuste, monto: e.target.value.replace(/\./g, ',').replace(/[^0-9,]/g, '') })} placeholder="Ej: 50,00" className="w-full p-3 rounded-xl border font-mono text-lg dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white" required /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (Auditoría) *</label><textarea value={formAjuste.nota} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormAjuste({ ...formAjuste, nota: e.target.value })} placeholder="Ej: Cobro de multa" className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white text-sm min-h-[80px]" required /></div>
          <div className="pt-4 flex gap-3"><button type="button" onClick={() => setAjusteModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-yellow-500 text-white hover:bg-yellow-600 transition-all">Aplicar Ajuste</button></div>
        </form>
      </div>
    </div>
  );
};

export const ModalCopropietarioForm: FC<ModalCopropietarioFormProps> = ({
  isOpen,
  propiedadIdentificador,
  form,
  copropietarios,
  copropietariosDraft,
  onClose,
  onSubmit,
  onChange,
  onEditChange,
  onSaveEdit,
  onDelete,
  isSubmitting = false,
  isLoadingList = false,
  savingCopropId = null,
  deletingCopropId = null
}) => {
  if (!isOpen) return null;

  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setExpandedId(null);
  }, [isOpen, copropietarios.length]);

  const handleNombreChange = (e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    onChange(e);
  };

  const handleEditNombreChange = (copropId: number, e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    onEditChange(copropId, e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl" disabled={isSubmitting}>X</button>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Agregar Copropietario</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inmueble: <strong>{propiedadIdentificador}</strong></p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Cédula *</label>
              <input
                type="text"
                name="cedula"
                value={form.cedula}
                onChange={onChange}
                pattern="^[VEJG][0-9]{5,9}$"
                placeholder="Ej: V12345678"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Nombre completo *</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleNombreChange}
                placeholder="Ej: María Fernanda Pérez"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                placeholder="Ej: copropietario@email.com"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Teléfono</label>
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={onChange}
                inputMode="numeric"
                pattern="^[0-9]{7,15}$"
                placeholder="Ej: 04141234567"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </div>
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="acceso_portal"
              checked={form.acceso_portal}
              onChange={onChange}
              className="w-4 h-4 text-donezo-primary"
            />
            Permitir acceso al portal (solo lectura)
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            El copropietario tendrá acceso para consultar información y registrar pagos, pero la cobranza oficial y el recibo legal permanecen a nombre del propietario principal.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors" disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all disabled:opacity-60" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Copropietario'}
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-5">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Copropietarios registrados</h4>

          {isLoadingList ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando copropietarios...</p>
          ) : copropietarios.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay copropietarios registrados en este inmueble.</p>
          ) : (
            <div className="space-y-3">
              {copropietarios.map((coprop) => {
                const isOpenAccordion = expandedId === coprop.id;
                const draft = copropietariosDraft[coprop.id];
                if (!draft) return null;
                return (
                  <div key={coprop.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === coprop.id ? null : coprop.id))}
                      className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{draft.nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{draft.cedula || 'Sin cédula'} | {draft.email || 'Sin correo'}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-300">{isOpenAccordion ? '▲' : '▼'}</span>
                    </button>

                    {isOpenAccordion && (
                      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            name="cedula"
                            value={draft.cedula}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            pattern="^[VEJG][0-9]{5,9}$"
                            placeholder="Cédula"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase"
                          />
                          <input
                            type="text"
                            name="nombre"
                            value={draft.nombre}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleEditNombreChange(coprop.id, e)}
                            placeholder="Nombre completo"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                          <input
                            type="email"
                            name="email"
                            value={draft.email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            placeholder="Email"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                          <input
                            type="text"
                            name="telefono"
                            value={draft.telefono}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            inputMode="numeric"
                            pattern="^[0-9]{7,15}$"
                            placeholder="Teléfono"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            name="acceso_portal"
                            checked={draft.acceso_portal}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            className="w-4 h-4 text-donezo-primary"
                          />
                          Permitir acceso al portal (solo lectura)
                        </label>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onDelete(coprop.id)}
                            disabled={deletingCopropId === coprop.id}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
                          >
                            {deletingCopropId === coprop.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSaveEdit(coprop.id)}
                            disabled={savingCopropId === coprop.id || deletingCopropId === coprop.id}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                          >
                            {savingCopropId === coprop.id ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal para carga masiva de Excel
export const ModalCargaMasiva: FC<ModalCargaMasivaProps> = ({
  isOpen,
  setLoteModalOpen,
  loteData,
  setLoteData,
  loteErrors,
  montoTotalIngresoLote,
  isUploadingLote,
  uploadProgress,
  handleDownloadTemplate,
  handleSaveLote,
  handleFileUpload
}) => {
  if (!isOpen) return null;

  const handleClose = (): void => {
    if (isUploadingLote) return;
    setLoteData([]);
    setLoteModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
           <div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                Carga Masiva de Inmuebles
              </h3>
              {loteData.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Se encontraron {loteData.length} registros.
                  {loteErrors > 0 && <span className="text-red-500 font-bold ml-2">Hay {loteErrors} errores detectados.</span>}
                </p>
              )}
              {loteData.length > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                  Monto total a ingresar en inmuebles: ${formatMoney(montoTotalIngresoLote)}
                </p>
              )}
           </div>
           <button
             onClick={handleClose}
             disabled={isUploadingLote}
             className={`text-gray-400 font-bold text-2xl transition-colors ${isUploadingLote ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-500'}`}
           >
             X
           </button>
        </div>

        {loteData.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center bg-white dark:bg-donezo-card-dark min-h-[300px]">
            <div className="text-6xl mb-4">Excel</div>
            <h4 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Importar desde Excel</h4>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8">
              Para cargar múltiples propiedades de golpe, descarga nuestra plantilla de Excel, llénala con los datos y súbela al sistema. Las cédulas se usarán como claves temporales.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
               <button onClick={handleDownloadTemplate} className="flex-1 py-3 px-4 rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-sm">
                 1. Descargar Plantilla
               </button>
               <label className="flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-bold cursor-pointer shadow-md hover:bg-green-700 transition-all text-center">
                 2. Subir Archivo
                 <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
               </label>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 flex flex-col">
            {isUploadingLote && (
              <div className="absolute inset-0 bg-white/55 dark:bg-black/55 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4 w-full max-w-sm">
                  <span className="font-bold text-gray-800 dark:text-white text-lg">Procesando {loteData.length} registros...</span>
                  <p className="text-sm text-gray-500 text-center">Por favor, no cierre esta ventana mientras se guardan los datos.</p>

                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative shadow-inner mt-2">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.round(uploadProgress)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-donezo-card-dark custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 shadow-sm z-10">
                  <tr className="text-gray-600 dark:text-gray-300">
                    <th className="p-3 font-bold text-center">Estado</th>
                    <th className="p-3 font-bold">Apto/Casa</th>
                    <th className="p-3 font-bold">Propietario</th>
                    <th className="p-3 font-bold">Cédula</th>
                    <th className="p-3 font-bold">Correo</th>
                    <th className="p-3 font-bold">Teléfono</th>
                    <th className="p-3 font-bold text-right">Alícuota</th>
                    <th className="p-3 font-bold text-right">Saldo Inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {loteData.map((row, i) => (
                    <tr key={i} className={`border-b ${row.isValid ? 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                      <td className="p-3 text-center text-xs">
                        {row.isValid ? (
                          <span className="text-green-500 text-lg" title="Correcto">OK</span>
                        ) : (
                          <span className="text-red-500 font-semibold" title={row.errors}>
                            ERR{row.errors ? ` - ${row.errors}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-gray-800 dark:text-white">{row.identificador}</td>
                      <td className="p-3"><div className="text-gray-700 dark:text-gray-300 font-medium">{row.nombre}</div>{!row.isValid && row.errors.includes('Nombre') && <span className="text-[10px] text-red-500 font-bold">Requerido</span>}</td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{row.cedula}{!row.isValid && row.errors.includes('Cédula') && <div className="text-[10px] text-red-500 font-bold">Inválida</div>}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{row.correo || '-'}{!row.isValid && row.errors.includes('Correo duplicado') && <div className="text-[10px] text-red-500 font-bold">Repetido</div>}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{row.telefono || '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{String(row.alicuota).replace('.', ',')}% {!row.isValid && row.errors.includes('Alícuota') && <div className="text-[10px] text-red-500 font-bold">Debe ser {'>'} 0</div>}</td>
                      <td className="p-3 text-right font-mono font-medium"><span className={parseFloat(String(row.saldo_inicial)) > 0 ? 'text-red-500' : parseFloat(String(row.saldo_inicial)) < 0 ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>${formatMoney(Math.abs(parseFloat(String(row.saldo_inicial || 0))))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                {!isUploadingLote ? (
                  <label className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-sm">
                     Subir otro archivo
                     <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse">Guardando...</span>
                )}

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleClose}
                    disabled={isUploadingLote}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveLote}
                    disabled={loteErrors > 0 || isUploadingLote}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isUploadingLote ? 'Guardando...' : `Confirmar y Guardar ${loteData.length}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



