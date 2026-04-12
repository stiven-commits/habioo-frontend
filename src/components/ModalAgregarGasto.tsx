import React, { useMemo, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from './ui/ModalBase';
import DatePicker from './ui/DatePicker';
import SearchableCombobox from './ui/SearchableCombobox';
import type { SearchableComboboxOption } from './ui/SearchableCombobox';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../config/api';

// Helper function for currency display
const formatMoneyDisplay = (value: string | number): string => {
  const parts = Number(value).toFixed(2).split('.');
  parts[0] = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
};

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
  nombre_banco?: string;
  apodo?: string | null;
  numero_cuenta?: string | null;
  tipo?: string | null;
  moneda?: string | null;
}

interface Fondo {
  id: number | string;
  nombre: string;
  moneda?: string;
  cuenta_bancaria_id: number | string;
  nombre_banco?: string;
  apodo?: string | null;
  fecha_saldo?: string | null;
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
  monto_historico_recaudado_no_cuenta_usd: string;
  monto_historico_recaudado_no_cuenta_bs: string;
  historico_en_cuenta: boolean;
  historico_cuenta_bancaria_id: string;
  historico_fondo_id: string;
  tasa_historica: string;
}

type TipoRegistroGasto = 'nuevo' | 'historico';

interface HistoricalOriginRow {
  id: string;
  cuenta_bancaria_id: string;
  fondo_id: string;
  monto_usd: string;
  monto_bs: string;
  monto_previo_usd: string;
  monto_previo_bs: string;
  fecha_operacion: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  status?: string;
}

const EMPTY_FORM_STATE: FormState = {
  proveedor_id: '',
  concepto: '',
  numero_documento: '',
  monto_bs: '',
  tasa_cambio: '',
  total_cuotas: '1',
  nota: '',
  clasificacion: 'Variable',
  asignacion_tipo: 'Comun',
  zona_id: '',
  propiedad_id: '',
  fecha_gasto: '',
  cuotas_historicas: '0',
  monto_historico_proveedor_usd: '',
  monto_historico_proveedor_bs: '',
  monto_historico_recaudado_usd: '',
  monto_historico_recaudado_bs: '',
  monto_historico_recaudado_no_cuenta_usd: '',
  monto_historico_recaudado_no_cuenta_bs: '',
  historico_en_cuenta: false,
  historico_cuenta_bancaria_id: '',
  historico_fondo_id: '',
  tasa_historica: '',
};

const FORM_KEYS: Array<keyof FormState> = Object.keys(EMPTY_FORM_STATE) as Array<keyof FormState>;

const sanitizeFormState = (source?: Partial<FormState>): FormState => {
  const src = source || {};
  return {
    proveedor_id: String(src.proveedor_id || ''),
    concepto: String(src.concepto || ''),
    numero_documento: String(src.numero_documento || ''),
    monto_bs: String(src.monto_bs || ''),
    tasa_cambio: String(src.tasa_cambio || ''),
    total_cuotas: String(src.total_cuotas || '1'),
    nota: String(src.nota || ''),
    clasificacion: (String(src.clasificacion || 'Variable') === 'Fijo' ? 'Fijo' : 'Variable'),
    asignacion_tipo: (['Comun', 'Zona', 'Individual', 'Extra'].includes(String(src.asignacion_tipo || 'Comun'))
      ? String(src.asignacion_tipo || 'Comun')
      : 'Comun') as AsignacionTipo,
    zona_id: String(src.zona_id || ''),
    propiedad_id: String(src.propiedad_id || ''),
    fecha_gasto: String(src.fecha_gasto || ''),
    cuotas_historicas: String(src.cuotas_historicas || '0'),
    monto_historico_proveedor_usd: String(src.monto_historico_proveedor_usd || ''),
    monto_historico_proveedor_bs: String(src.monto_historico_proveedor_bs || ''),
    monto_historico_recaudado_usd: String(src.monto_historico_recaudado_usd || ''),
    monto_historico_recaudado_bs: String(src.monto_historico_recaudado_bs || ''),
    monto_historico_recaudado_no_cuenta_usd: String(src.monto_historico_recaudado_no_cuenta_usd || ''),
    monto_historico_recaudado_no_cuenta_bs: String(src.monto_historico_recaudado_no_cuenta_bs || ''),
    historico_en_cuenta: Boolean(src.historico_en_cuenta),
    historico_cuenta_bancaria_id: String(src.historico_cuenta_bancaria_id || ''),
    historico_fondo_id: String(src.historico_fondo_id || ''),
    tasa_historica: String(src.tasa_historica || ''),
  };
};

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

const getTodayYmd = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatYmdToDisplay = (ymd: string): string => {
  const normalized = normalizeYmdLike(ymd);
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const normalizeYmdLike = (rawValue?: string | null): string => {
  const raw = String(rawValue || '').trim();
  if (!raw) return getTodayYmd();

  const validate = (year: number, month: number, day: number): string | null => {
    if (!year || !month || !day) return null;
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const normalized = validate(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
    if (normalized) return normalized;
  }

  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const normalized = validate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));
    if (normalized) return normalized;
  }

  return getTodayYmd();
};

const makeOriginRow = (): HistoricalOriginRow => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  cuenta_bancaria_id: '',
  fondo_id: '',
  monto_usd: '',
  monto_bs: '',
  monto_previo_usd: '',
  monto_previo_bs: '',
  fecha_operacion: getTodayYmd(),
});

const roundTwo = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

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
  function getFondoById(fondoId: string): Fondo | undefined {
    return (fondos || []).find((f) => String(f.id) === String(fondoId || ''));
  }

  const [form, setForm] = useState<FormState>(EMPTY_FORM_STATE);

  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [soportesFiles, setSoportesFiles] = useState<File[]>([]);
  const [removeExistingFactura, setRemoveExistingFactura] = useState<boolean>(false);
  const [existingSoportesEdit, setExistingSoportesEdit] = useState<string[]>([]);
  
  // NUEVO: Estado para el loading de la tasa BCV
  const [loadingBCV, setLoadingBCV] = useState<boolean>(false);
  const [hasHistoricalContext, setHasHistoricalContext] = useState<boolean>(false);
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistroGasto>('nuevo');
  const [historicoPagadoRows, setHistoricoPagadoRows] = useState<HistoricalOriginRow[]>([]);
  const [historicoRecaudadoRows, setHistoricoRecaudadoRows] = useState<HistoricalOriginRow[]>([]);
  const [tasaHistoricaDia, setTasaHistoricaDia] = useState<number>(0);
  const [loadingTasaHistoricaDia, setLoadingTasaHistoricaDia] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1); // Control del wizard: 1 = Datos básicos, 2 = Histórico
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({}); // Nuevo: errores de validación
  const [fondosFechaSaldo, setFondosFechaSaldo] = useState<Map<string, string>>(new Map()); // fecha_saldo por fondo_id
  const facturaInputRef = React.useRef<HTMLInputElement | null>(null);
  const soportesInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (mode !== 'edit') {
      setHasHistoricalContext(false);
      return;
    }
    const merged = sanitizeFormState({
      ...EMPTY_FORM_STATE,
      ...initialValues,
      historico_en_cuenta: Boolean(initialValues?.historico_en_cuenta),
      historico_cuenta_bancaria_id: String(initialValues?.historico_cuenta_bancaria_id || ''),
      historico_fondo_id: String(initialValues?.historico_fondo_id || ''),
    });
    setForm(merged);
    const cuotasHist = parseInputNumber(String(merged.cuotas_historicas || '0'));
    const totalCuotasInitial = Math.max(1, parseInt(String(merged.total_cuotas || '1'), 10) || 1);
    const rawEsHistorico = (initialValues as { es_historico?: boolean | string | number })?.es_historico;
    const esHistoricoInitial = rawEsHistorico === true
      || rawEsHistorico === 1
      || String(rawEsHistorico || '').trim().toLowerCase() === '1'
      || String(rawEsHistorico || '').trim().toLowerCase() === 'true';
    const esHistoricoInferido = cuotasHist > 0 && cuotasHist >= totalCuotasInitial;
    setTipoRegistro(esHistoricoInitial || esHistoricoInferido ? 'historico' : 'nuevo');
    const montoHistUsd = parseInputNumber(String(merged.monto_historico_proveedor_usd || '0'));
    const montoHistBs = parseInputNumber(String(merged.monto_historico_proveedor_bs || '0'));
    const montoRecaudadoHistUsd = parseInputNumber(String(merged.monto_historico_recaudado_usd || '0'));
    const montoRecaudadoHistBs = parseInputNumber(String(merged.monto_historico_recaudado_bs || '0'));
    setHasHistoricalContext(cuotasHist > 0 || montoHistUsd > 0 || montoHistBs > 0 || montoRecaudadoHistUsd > 0 || montoRecaudadoHistBs > 0);
    const initPagado = Array.isArray((initialValues as { historico_pagado_origenes?: HistoricalOriginRow[] })?.historico_pagado_origenes)
      ? ((initialValues as { historico_pagado_origenes?: HistoricalOriginRow[] }).historico_pagado_origenes || []).map((r) => ({
          id: r.id || makeOriginRow().id,
          cuenta_bancaria_id: String(r.cuenta_bancaria_id || ''),
          fondo_id: String(r.fondo_id || ''),
          monto_usd: toCurrencyDisplayFromAny(r.monto_usd, 2),
          monto_bs: toCurrencyDisplayFromAny(r.monto_bs, 2),
          monto_previo_usd: toCurrencyDisplayFromAny((r as { monto_previo_usd?: string | number }).monto_previo_usd, 2),
          monto_previo_bs: toCurrencyDisplayFromAny((r as { monto_previo_bs?: string | number }).monto_previo_bs, 2),
          fecha_operacion: normalizeYmdLike((r as { fecha_operacion?: string }).fecha_operacion),
        }))
      : [];
    const initRecaudado = Array.isArray((initialValues as { historico_recaudado_origenes?: HistoricalOriginRow[] })?.historico_recaudado_origenes)
      ? ((initialValues as { historico_recaudado_origenes?: HistoricalOriginRow[] }).historico_recaudado_origenes || []).map((r) => ({
          id: r.id || makeOriginRow().id,
          cuenta_bancaria_id: String(r.cuenta_bancaria_id || ''),
          fondo_id: String(r.fondo_id || ''),
          monto_usd: toCurrencyDisplayFromAny(r.monto_usd, 2),
          monto_bs: toCurrencyDisplayFromAny(r.monto_bs, 2),
          monto_previo_usd: toCurrencyDisplayFromAny((r as { monto_previo_usd?: string | number }).monto_previo_usd, 2),
          monto_previo_bs: toCurrencyDisplayFromAny((r as { monto_previo_bs?: string | number }).monto_previo_bs, 2),
          fecha_operacion: normalizeYmdLike((r as { fecha_operacion?: string }).fecha_operacion),
        }))
      : [];
    setHistoricoPagadoRows(initPagado);
    setHistoricoRecaudadoRows(initRecaudado);
    setRemoveExistingFactura(false);
    setFacturaFile(null);
    setSoportesFiles([]);
    setExistingSoportesEdit(Array.isArray(existingSoportesUrls) ? existingSoportesUrls : []);
    // Importante: solo inicializamos al cambiar el gasto en edición.
    // Evitamos depender de objetos/arrays recreados por re-renders del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gastoId]);

  React.useEffect(() => {
    if (mode === 'edit') return;
    setTipoRegistro('nuevo');
    setHistoricoPagadoRows([]);
    setHistoricoRecaudadoRows([]);
  }, [mode]);



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
    const raw = String(txt || '').trim();
    if (!raw) return 0;

    const onlyAllowed = raw.replace(/[^\d.,-]/g, '');
    if (!onlyAllowed) return 0;

    const hasComma = onlyAllowed.includes(',');
    const hasDot = onlyAllowed.includes('.');
    let normalized = onlyAllowed;

    if (hasComma && hasDot) {
      const lastComma = onlyAllowed.lastIndexOf(',');
      const lastDot = onlyAllowed.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Formato local: 14.948,85
        normalized = onlyAllowed.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato internacional: 14,948.85
        normalized = onlyAllowed.replace(/,/g, '');
      }
    } else if (hasComma) {
      const commaCount = (onlyAllowed.match(/,/g) || []).length;
      if (commaCount === 1) {
        // En la app usamos coma como separador decimal (incluye tasas con 3 decimales).
        normalized = onlyAllowed.replace(',', '.');
      } else {
        normalized = onlyAllowed.replace(/,/g, '');
      }
    } else if (hasDot) {
      const dotCount = (onlyAllowed.match(/\./g) || []).length;
      const [left = '', right = ''] = onlyAllowed.split('.');
      if (dotCount === 1) {
        if (!right) {
          normalized = left;
        } else if (right.length === 3) {
          // Caso visual local sin decimales: 14.948
          normalized = onlyAllowed.replace(/\./g, '');
        } else {
          // Decimal con punto (ej: 14948.85 o 71.5000)
          normalized = `${left}.${right}`;
        }
      } else {
        normalized = onlyAllowed.replace(/\./g, '');
      }
    }

    const parsed = parseFloat(normalized);
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

  const formatCurrencyInput = (value: string, maxDecimals = 2): string => {
    const clean = String(value || '').replace(/[^\d,]/g, '');
    if (!clean) return '';

    const parts = clean.split(',');
    const integerRaw = parts[0] || '';
    const decimalRaw = (parts[1] || '').slice(0, maxDecimals);

    const integerPart = integerRaw.replace(/^0+(?=\d)/, '') || '0';
    const integerWithDots = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    if (clean.includes(',')) return `${integerWithDots},${decimalRaw}`;
    return integerWithDots === '0' && integerRaw === '' ? '' : integerWithDots;
  };

  const toCurrencyDisplayFromAny = (value: unknown, maxDecimals = 2): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const parsed = parseInputNumber(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return formatCurrencyInput(parsed.toFixed(maxDecimals).replace('.', ','), maxDecimals);
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

  const handleMontoNoCuentaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const field = e.target.name as keyof FormState;
    const rawValue = String(e.target.value || '');
    const formatted = formatCurrencyInput(rawValue, 2);
    setForm((prev: FormState) => ({ ...prev, [field]: formatted as FormState[typeof field] }));
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

  const updateOriginRow = (
    type: 'pagado' | 'recaudado',
    rowId: string,
    field: keyof Omit<HistoricalOriginRow, 'id'>,
    value: string
  ): void => {
    const tasaRef = tasaHistoricaDia > 0 ? tasaHistoricaDia : parseInputNumber(form.tasa_cambio || '0');
    const updater = (prev: HistoricalOriginRow[]): HistoricalOriginRow[] =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'monto_usd' || field === 'monto_bs' || field === 'monto_previo_usd' || field === 'monto_previo_bs') {
          const formatted = formatCurrencyInput(value, 2);
          if (field === 'monto_usd' || field === 'monto_previo_usd') {
            if (type !== 'recaudado') {
              return { ...row, [field]: formatted };
            }
            const usd = parseInputNumber(formatted);
            const bsCalc = tasaRef > 0 ? (usd * tasaRef) : 0;
            if (field === 'monto_usd') {
              return {
                ...row,
                monto_usd: formatted,
                monto_bs: bsCalc > 0 ? formatCurrencyInput(String(bsCalc).replace('.', ','), 2) : '',
              };
            }
            return {
              ...row,
              monto_previo_usd: formatted,
              monto_previo_bs: bsCalc > 0 ? formatCurrencyInput(String(bsCalc).replace('.', ','), 2) : '',
            };
          }
          if (field === 'monto_bs') {
            return { ...row, monto_bs: formatted };
          }
          return { ...row, monto_previo_bs: formatted };
        }
        if (field === 'cuenta_bancaria_id') {
          return { ...row, cuenta_bancaria_id: value, fondo_id: '' };
        }
        if (field === 'fondo_id') {
          if (value) {
            // Fetch fecha_saldo cuando se selecciona un fondo
            void fetchFondoFechaSaldo(value);
          }
          const fondo = getFondoById(value);
          const esFondoUsd = String(fondo?.moneda || '').toUpperCase() === 'USD';
          if (!esFondoUsd) {
            return { ...row, fondo_id: value };
          }
          const usdActual = parseInputNumber(row.monto_usd);
          const bsActual = parseInputNumber(row.monto_bs);
          const usdNormalizado = usdActual > 0
            ? usdActual
            : (tasaRef > 0 ? (bsActual / tasaRef) : 0);
          const usdPrevioActual = parseInputNumber(row.monto_previo_usd);
          const bsPrevioActual = parseInputNumber(row.monto_previo_bs);
          const usdPrevioNormalizado = usdPrevioActual > 0
            ? usdPrevioActual
            : (tasaRef > 0 ? (bsPrevioActual / tasaRef) : 0);
          return {
            ...row,
            fondo_id: value,
            monto_usd: usdNormalizado > 0 ? formatCurrencyInput(String(usdNormalizado).replace('.', ','), 2) : '',
            monto_bs: '',
            monto_previo_usd: usdPrevioNormalizado > 0 ? formatCurrencyInput(String(usdPrevioNormalizado).replace('.', ','), 2) : '',
            monto_previo_bs: '',
          };
        }
        return { ...row, [field]: value };
      });
    if (type === 'pagado') setHistoricoPagadoRows(updater);
    else setHistoricoRecaudadoRows(updater);
  };

  const removeOriginRow = (type: 'pagado' | 'recaudado', rowId: string): void => {
    if (type === 'pagado') setHistoricoPagadoRows((prev) => prev.filter((row) => row.id !== rowId));
    else setHistoricoRecaudadoRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const addOriginRow = (type: 'pagado' | 'recaudado'): void => {
    if (type === 'pagado') setHistoricoPagadoRows((prev) => [...prev, makeOriginRow()]);
    else setHistoricoRecaudadoRows((prev) => [...prev, makeOriginRow()]);
  };

  const totalsPagado = useMemo(() => {
    const usd = historicoPagadoRows.reduce((sum, row) => sum + parseInputNumber(row.monto_usd), 0);
    const bs = historicoPagadoRows.reduce((sum, row) => sum + parseInputNumber(row.monto_bs), 0);
    return { usd: roundTwo(usd), bs: roundTwo(bs) };
  }, [historicoPagadoRows]);

  const totalsRecaudado = useMemo(() => {
    const usdRows = historicoRecaudadoRows.reduce((sum, row) => sum + parseInputNumber(row.monto_usd), 0);
    const bsRows = historicoRecaudadoRows.reduce((sum, row) => sum + parseInputNumber(row.monto_bs), 0);
    const usdNoCuenta = parseInputNumber(form.monto_historico_recaudado_no_cuenta_usd || '0');
    const bsNoCuenta = parseInputNumber(form.monto_historico_recaudado_no_cuenta_bs || '0');
    const usd = usdRows + usdNoCuenta;
    const bs = bsRows + bsNoCuenta;
    return { usd: roundTwo(usd), bs: roundTwo(bs) };
  }, [historicoRecaudadoRows, form.monto_historico_recaudado_no_cuenta_usd, form.monto_historico_recaudado_no_cuenta_bs]);

  const step2ValidationErrors = useMemo<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    const totalCuotasCanonico = Math.max(1, parseInt(String(form.total_cuotas || '1'), 10) || 1);
    const cuotasHistoricasCanonico = hasHistoricalContext
      ? Math.max(0, Math.trunc(parseInputNumber(form.cuotas_historicas || '0')))
      : 0;
    const esHistorico = tipoRegistro === 'historico'
      || (mode === 'edit' && hasHistoricalContext && cuotasHistoricasCanonico >= totalCuotasCanonico);
    const maxCuotasHistoricas = esHistorico ? totalCuotasCanonico : Math.max(0, totalCuotasCanonico - 1);

    if (cuotasHistoricasCanonico > maxCuotasHistoricas) {
      errors.cuotas_historicas = esHistorico
        ? 'Las cuotas históricas no pueden superar el total de cuotas.'
        : 'Las cuotas históricas deben ser menores al total de cuotas.';
    } else if (esHistorico && cuotasHistoricasCanonico !== totalCuotasCanonico) {
      errors.cuotas_historicas = 'En gasto histórico, las cuotas transcurridas deben igualar el total de cuotas.';
    }

    const montoCanonico = parseInputNumber(form.monto_bs);
    const tasaCanonica = parseInputNumber(form.tasa_cambio);
    const montoCanonicoUsd = tasaCanonica > 0 ? roundTwo(montoCanonico / tasaCanonica) : 0;
    const montoTotalUsdEdicion = roundTwo(
      parseInputNumber(
        String(
          (initialValues as { monto_total_usd?: string | number; monto_usd?: string | number })?.monto_total_usd
            ?? (initialValues as { monto_total_usd?: string | number; monto_usd?: string | number })?.monto_usd
            ?? '0'
        )
      )
    );
    const montoTotalUsdReferencia = montoTotalUsdEdicion > 0 ? montoTotalUsdEdicion : montoCanonicoUsd;
    const limiteUsd = roundTwo(montoTotalUsdReferencia) + 0.01;

    if (totalsPagado.usd > limiteUsd || totalsRecaudado.usd > limiteUsd) {
      errors.totales_usd = 'Los montos históricos en USD no pueden superar el monto total del gasto en USD.';
    }

    historicoPagadoRows.forEach((row, idx) => {
      const key = `pagado_row_${row.id}`;
      const hasCuenta = Boolean(row.cuenta_bancaria_id);
      const hasFondo = Boolean(row.fondo_id);
      if (!hasCuenta && !hasFondo) return;
      if (!hasCuenta || !hasFondo) {
        errors[key] = `Pagado histórico fila ${idx + 1}: debe seleccionar cuenta y fondo.`;
        return;
      }
      const fondo = getFondoById(row.fondo_id);
      const esFondoUsd = String(fondo?.moneda || '').toUpperCase() === 'USD';
      const usd = parseInputNumber(row.monto_usd);
      const bs = parseInputNumber(row.monto_bs);
      if (esFondoUsd) {
        if (usd <= 0) errors[key] = `Pagado histórico fila ${idx + 1}: el monto USD debe ser mayor a 0.`;
        return;
      }
      if (usd <= 0 || bs <= 0) {
        errors[key] = `Pagado histórico fila ${idx + 1}: los montos USD y Bs deben ser mayores a 0.`;
      }
    });

    historicoRecaudadoRows.forEach((row, idx) => {
      const key = `recaudado_row_${row.id}`;
      const hasCuenta = Boolean(row.cuenta_bancaria_id);
      const hasFondo = Boolean(row.fondo_id);
      if (!hasCuenta && !hasFondo) return;
      if (!hasCuenta || !hasFondo) {
        errors[key] = `Recaudado histórico fila ${idx + 1}: debe seleccionar cuenta y fondo.`;
        return;
      }
      const fondo = getFondoById(row.fondo_id);
      const esFondoUsd = String(fondo?.moneda || '').toUpperCase() === 'USD';
      const usd = parseInputNumber(row.monto_usd);
      const bs = parseInputNumber(row.monto_bs);
      if (esFondoUsd) {
        if (usd <= 0) errors[key] = `Recaudado histórico fila ${idx + 1}: el monto USD debe ser mayor a 0.`;
        return;
      }
      if (usd <= 0 || bs <= 0) {
        errors[key] = `Recaudado histórico fila ${idx + 1}: los montos USD y Bs deben ser mayores a 0.`;
      }
    });

    return errors;
  }, [
    form.total_cuotas,
    form.cuotas_historicas,
    form.monto_bs,
    form.tasa_cambio,
    hasHistoricalContext,
    tipoRegistro,
    mode,
    initialValues,
    totalsPagado.bs,
    totalsPagado.usd,
    totalsRecaudado.bs,
    totalsRecaudado.usd,
    historicoPagadoRows,
    historicoRecaudadoRows,
  ]);
  const hasStep2Errors = Object.keys(step2ValidationErrors).length > 0;

  // NUEVO: Validación en tiempo real
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!form.proveedor_id) errors.proveedor_id = 'Seleccione un proveedor';
    if (!form.concepto.trim()) errors.concepto = 'Ingrese un concepto';
    if (montoBsNum <= 0) errors.monto_bs = 'El monto debe ser mayor a 0';
    if (tasaNum <= 0) errors.tasa_cambio = 'La tasa debe ser mayor a 0';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // NUEVO: Avanzar al siguiente paso
  const handleNextStep = (): void => {
    if (validateForm()) {
      setWizardStep(2);
    }
  };

  // NUEVO: Retroceder al paso anterior
  const handlePrevStep = (): void => {
    setWizardStep(1);
  };

  React.useEffect(() => {
    const cuotasSafe = tipoRegistro === 'historico'
      ? Math.max(1, parseInt(form.total_cuotas || '1', 10) || 1)
      : Math.max(0, parseInt(form.cuotas_historicas || '0', 10) || 0);
    const hasAny = cuotasSafe > 0 || totalsPagado.usd > 0 || totalsPagado.bs > 0 || totalsRecaudado.usd > 0 || totalsRecaudado.bs > 0;
    setHasHistoricalContext(hasAny);
    setForm((prev: FormState) => ({
      ...prev,
      cuotas_historicas: String(cuotasSafe),
      monto_historico_proveedor_usd: totalsPagado.usd > 0 ? formatCurrencyInput(String(totalsPagado.usd).replace('.', ','), 2) : '',
      monto_historico_proveedor_bs: totalsPagado.bs > 0 ? formatCurrencyInput(String(totalsPagado.bs).replace('.', ','), 2) : '',
      monto_historico_recaudado_usd: totalsRecaudado.usd > 0 ? formatCurrencyInput(String(totalsRecaudado.usd).replace('.', ','), 2) : '',
      monto_historico_recaudado_bs: totalsRecaudado.bs > 0 ? formatCurrencyInput(String(totalsRecaudado.bs).replace('.', ','), 2) : '',
      historico_en_cuenta: totalsRecaudado.usd > 0 || totalsRecaudado.bs > 0,
    }));
  }, [totalsPagado, totalsRecaudado, tipoRegistro, form.total_cuotas, form.cuotas_historicas]);

  const cuentaOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (bancos || []).map((b) => {
        const id = String(b.id);
        const banco = String(b.nombre_banco || b.banco || b.nombre || '').trim();
        const apodo = String(b.apodo || '').trim();
        const tipo = String(b.tipo || '').trim();
        const moneda = String(b.moneda || '').trim().toUpperCase();
        const ultimos4 = String(b.numero_cuenta || '').replace(/\D/g, '').slice(-4);

        const base = apodo || banco || tipo || `Cuenta ${id}`;
        const withBanco = banco && apodo ? `${banco} (${apodo})` : base;
        const withMoneda = moneda ? `${withBanco} - ${moneda}` : withBanco;
        const label = ultimos4 ? `${withMoneda} - ****${ultimos4}` : withMoneda;

        return {
          value: id,
          label,
          searchText: `${base} ${banco} ${apodo} ${tipo} ${moneda} ${ultimos4}`,
        };
      }),
    [bancos]
  );

  const proveedorOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (proveedores || []).map((p) => ({
        value: String(p.id),
        label: `${p.nombre} (${p.identificador})`,
        searchText: `${p.nombre} ${p.identificador}`,
      })),
    [proveedores]
  );

  const fondoOptionsByCuenta = useMemo<Map<string, SearchableComboboxOption[]>>(() => {
    const grouped = new Map<string, SearchableComboboxOption[]>();
    for (const f of fondos || []) {
      const cuentaId = String(f.cuenta_bancaria_id || '');
      const moneda = String(f.moneda || '').toUpperCase();
      const banco = String(f.nombre_banco || f.apodo || '');
      const labelBase = `${f.nombre}${moneda ? ` (${moneda})` : ''}`;
      const label = banco ? `${labelBase} - ${banco}` : labelBase;
      const option: SearchableComboboxOption = {
        value: String(f.id),
        label,
        searchText: `${f.nombre} ${moneda} ${banco}`,
      };
      const list = grouped.get(cuentaId) || [];
      list.push(option);
      grouped.set(cuentaId, list);
    }
    return grouped;
  }, [fondos]);

  const getFondoOptionsByCuenta = (cuentaId: string): SearchableComboboxOption[] =>
    fondoOptionsByCuenta.get(String(cuentaId || '')) || [];

  // Obtener fecha_saldo del fondo para validación de fechas
  const fetchFondoFechaSaldo = async (fondoId: string): Promise<void> => {
    if (!fondoId || fondosFechaSaldo.has(fondoId)) return;
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/fondos/${fondoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: { fecha_saldo?: string | null } = await res.json();
        if (data.fecha_saldo) {
          setFondosFechaSaldo((prev) => new Map(prev).set(fondoId, data.fecha_saldo!));
        }
      }
    } catch {
      // Silently fail - date validation is optional
    }
  };

  // Calcular fecha máxima para Pagado histórico: 1 día antes de fecha_saldo
  const getPagadoMaxDate = (fondoId: string): Date | undefined => {
    const fechaSaldo = fondosFechaSaldo.get(fondoId);
    if (!fechaSaldo) return undefined;
    const date = ymdToDate(fechaSaldo);
    if (!date) return undefined;
    date.setDate(date.getDate() - 1); // 1 día antes
    return date;
  };

  // Calcular fecha mínima para Recaudado histórico: 1 día después de fecha_saldo
  const getRecaudadoMinDate = (fondoId: string): Date | undefined => {
    const fechaSaldo = fondosFechaSaldo.get(fondoId);
    if (!fechaSaldo) return undefined;
    const date = ymdToDate(fechaSaldo);
    if (!date) return undefined;
    date.setDate(date.getDate() + 1); // 1 día después
    return date;
  };

  const fetchTasaHistoricaDia = async (): Promise<void> => {
    setLoadingTasaHistoricaDia(true);
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const data: { promedio?: number | string } = await res.json();
      const rateNumber = parseFloat(String(data?.promedio ?? 0));
      if (Number.isFinite(rateNumber) && rateNumber > 0) {
        setTasaHistoricaDia(rateNumber);
      }
    } catch {
      // fallback below
    } finally {
      setLoadingTasaHistoricaDia(false);
    }
  };

  React.useEffect(() => {
    if (wizardStep !== 2 || tipoRegistro !== 'historico') return;
    void fetchTasaHistoricaDia();
  }, [wizardStep, tipoRegistro]);

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
    
    // Validación en tiempo real
    if (!validateForm()) {
      return;
    }
    if (hasStep2Errors) {
      alert('Hay errores en el paso 2. Corrige los campos marcados antes de guardar.');
      return;
    }
    
    // Si es gasto histórico y no se ha configurado, mostrar advertencia
    if (tipoRegistro === 'historico' && !hasHistoricalContext) {
      if (!window.confirm('No ha configurado los datos históricos. ¿Desea continuar solo con los datos básicos?')) {
        return;
      }
    }
    
    const token = localStorage.getItem('habioo_token');
    const montoCanonico = parseInputNumber(form.monto_bs);
    const tasaCanonica = parseInputNumber(form.tasa_cambio);
    if (montoCanonico <= 0 || tasaCanonica <= 0) {
      alert('Monto y tasa deben ser mayores a 0.');
      return;
    }
    const montoCanonicoUsd = roundTwo(montoCanonico / tasaCanonica);
    const montoTotalUsdEdicion = roundTwo(
      parseInputNumber(
        String(
          (initialValues as { monto_total_usd?: string | number; monto_usd?: string | number })?.monto_total_usd
            ?? (initialValues as { monto_total_usd?: string | number; monto_usd?: string | number })?.monto_usd
            ?? '0'
        )
      )
    );
    const montoTotalUsdReferencia = montoTotalUsdEdicion > 0 ? montoTotalUsdEdicion : montoCanonicoUsd;
    const limiteUsd = roundTwo(montoTotalUsdReferencia) + 0.01;
    const totalCuotasCanonico = Math.max(1, parseInt(String(form.total_cuotas || '1'), 10) || 1);
    const cuotasHistoricasCanonico = hasHistoricalContext
      ? Math.max(0, Math.trunc(parseInputNumber(form.cuotas_historicas || '0')))
      : 0;
    const esHistorico = tipoRegistro === 'historico'
      || (mode === 'edit' && hasHistoricalContext && cuotasHistoricasCanonico >= totalCuotasCanonico);
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
    if (montoHistoricoProveedorUsdCanonico > limiteUsd || montoHistoricoRecaudadoUsdCanonico > limiteUsd) {
      alert('Los montos históricos en USD no pueden superar el monto total del gasto en USD.');
      return;
    }
    const validateRows = (rows: HistoricalOriginRow[], label: string, type: 'pagado' | 'recaudado'): boolean => {
      for (const row of rows) {
        if (!row.cuenta_bancaria_id || !row.fondo_id) continue;
        const fondo = getFondoById(row.fondo_id);
        const esFondoUsd = String(fondo?.moneda || '').toUpperCase() === 'USD';
        const usd = parseInputNumber(row.monto_usd);
        const bs = parseInputNumber(row.monto_bs);
        if (esFondoUsd) {
          if (usd <= 0) {
            alert(`En ${label}, el monto USD debe ser mayor a 0 cuando hay cuenta y fondo seleccionados.`);
            return false;
          }
          continue;
        }
        if (usd <= 0 || bs <= 0) {
          const campo = usd <= 0 && bs <= 0
            ? 'USD y Bs'
            : (usd <= 0 ? 'USD' : 'Bs');
          alert(`En ${label}, el monto ${campo} debe ser mayor a 0 cuando hay cuenta y fondo seleccionados.`);
          return false;
        }
        if (type === 'recaudado' && usd <= 0) {
          alert(`En ${label}, el monto USD debe ser mayor a 0 cuando hay cuenta y fondo seleccionados.`);
          return false;
        }
      }
      return true;
    };
    if (!validateRows(historicoPagadoRows, 'pagado histórico', 'pagado')) return;
    if (!validateRows(historicoRecaudadoRows, 'recaudado histórico', 'recaudado')) return;
    if (tipoRegistro === 'historico' && cuotasHistoricasCanonico !== totalCuotasCanonico) {
      alert('En gasto histórico, las cuotas transcurridas deben igualar el total de cuotas.');
      return;
    }
    // Para gasto nuevo, las cuotas históricas deben ser menores al total
    if (tipoRegistro === 'nuevo' && cuotasHistoricasCanonico >= totalCuotasCanonico && hasHistoricalContext) {
      alert('Para gasto nuevo, las cuotas históricas deben ser menores al total de cuotas.');
      return;
    }
    
    const formData = new FormData();
    FORM_KEYS.forEach((key: keyof FormState) => {
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
    formData.append(
      'historico_pagado_origenes',
      JSON.stringify(
        historicoPagadoRows
          .map((row) => ({
            cuenta_bancaria_id: row.cuenta_bancaria_id || null,
            fondo_id: row.fondo_id || null,
            monto_usd: roundTwo(parseInputNumber(row.monto_usd)),
            monto_bs: roundTwo(parseInputNumber(row.monto_bs)),
            fecha_operacion: row.fecha_operacion || getTodayYmd(),
          }))
          .filter((row) => row.monto_usd > 0 || row.monto_bs > 0)
      )
    );
    const tasaHistoricaRef = tasaHistoricaDia > 0 ? tasaHistoricaDia : tasaCanonica;
    formData.append(
      'historico_recaudado_origenes',
      JSON.stringify(
        historicoRecaudadoRows
          .map((row) => {
            const montoUsd = roundTwo(parseInputNumber(row.monto_usd));
            const montoBs = roundTwo(parseInputNumber(row.monto_bs));
            const fondo = getFondoById(row.fondo_id);
            const esFondoUsd = String(fondo?.moneda || '').toUpperCase() === 'USD';
            const usdFinal = esFondoUsd
              ? montoUsd
              : (montoUsd > 0 ? montoUsd : (tasaHistoricaRef > 0 ? roundTwo(montoBs / tasaHistoricaRef) : 0));
            const bsFinal = esFondoUsd
              ? (montoBs > 0 ? montoBs : (tasaHistoricaRef > 0 ? roundTwo(usdFinal * tasaHistoricaRef) : 0))
              : montoBs;
            return {
              cuenta_bancaria_id: row.cuenta_bancaria_id || null,
              fondo_id: row.fondo_id || null,
              monto_bs: bsFinal,
              monto_usd: usdFinal,
              fecha_operacion: row.fecha_operacion || getTodayYmd(),
            };
          })
          .filter((row) => row.monto_bs > 0 || row.monto_usd > 0)
      )
    );
    
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
      let errorData: ApiErrorResponse = {};
      try {
        errorData = await res.json();
      } catch {
        errorData = {};
      }
      const backendMsg = String(errorData.message || errorData.error || '').trim();
      if (/cuotas históricas/i.test(backendMsg)) {
        setWizardStep(2);
      }
      alert(`Error al guardar: ${backendMsg || `HTTP ${res.status}. Verifique los datos.`}`);
    }
  };

  return (
    <ModalBase onClose={onClose} title={mode === 'edit' ? 'Editar Gasto' : 'Registrar Gasto'} maxWidth="max-w-6xl">
      {/* PROGRESS STEPS PANEL - Estilo TailwindUI - Siempre visible */}
      <div className="pt-3 mb-6">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {/* PASO 1: Datos básicos */}
            <li className={`relative pr-8 ${wizardStep > 1 ? '' : 'flex-1'}`}>
              {wizardStep > 1 ? (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-donezo-primary dark:bg-green-600" />
                </div>
              ) : wizardStep === 1 ? (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700" />
                </div>
              ) : null}
              <div className="relative flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  wizardStep > 1
                    ? 'bg-donezo-primary border-donezo-primary dark:bg-green-600 dark:border-green-600'
                    : wizardStep === 1
                    ? 'border-donezo-primary bg-white dark:bg-gray-800'
                    : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600'
                }`}>
                  {wizardStep > 1 ? (
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    <span className={`text-sm font-bold ${wizardStep === 1 ? 'text-donezo-primary dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      01
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${wizardStep >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Datos básicos
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Información del gasto
                  </span>
                </div>
              </div>
            </li>

            {/* PASO 2: Configuración histórica */}
            <li className={`relative pr-8 ${wizardStep >= 2 ? 'flex-1' : ''}`}>
              {wizardStep >= 2 ? (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-donezo-primary dark:bg-green-600" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
              <div className="relative flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  wizardStep > 2
                    ? 'bg-donezo-primary border-donezo-primary dark:bg-green-600 dark:border-green-600'
                    : wizardStep === 2
                    ? 'border-donezo-primary bg-white dark:bg-gray-800'
                    : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600'
                }`}>
                  {wizardStep > 2 ? (
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    <span className={`text-sm font-bold ${wizardStep === 2 ? 'text-donezo-primary dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      02
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${wizardStep >= 2 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Histórico
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Configuración avanzada
                  </span>
                </div>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* SEPARADOR */}
      <div className="border-t border-gray-200 dark:border-gray-700 mb-6" />

      <form onSubmit={tipoRegistro === 'historico' && wizardStep === 1 ? undefined : handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* TIPO DE REGISTRO - Siempre visible en ambos pasos */}
        <div className="xl:col-span-2 rounded-2xl border border-indigo-300/80 bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 p-4 shadow-sm dark:border-indigo-700/60 dark:from-indigo-900/30 dark:via-blue-900/20 dark:to-sky-900/20">
          <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-2">
            Tipo de registro
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTipoRegistro('nuevo');
                setHasHistoricalContext(false);
                setWizardStep(1);
              }}
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
              onClick={() => {
                setTipoRegistro('historico');
                setHasHistoricalContext(true);
                setWizardStep(1);
              }}
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

        {/* PASO 1: DATOS BÁSICOS */}
        {wizardStep === 1 && (
          <>
          <div className="xl:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <SearchableCombobox
              options={proveedorOptions}
              value={form.proveedor_id}
              onChange={(value: string) => {
                setForm((prev: FormState) => ({ ...prev, proveedor_id: value }));
                if (validationErrors.proveedor_id) {
                  setValidationErrors((prev) => ({ ...prev, proveedor_id: '' }));
                }
              }}
              placeholder="Seleccione proveedor..."
              emptyMessage="Sin proveedores"
              className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white ${validationErrors.proveedor_id ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}
            />
            {validationErrors.proveedor_id && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.proveedor_id}</p>
            )}
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="concepto"
                value={form.concepto}
                onChange={handleChange}
                placeholder="Ej: Reparación de tubería..."
                required
                className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white ${
                  validationErrors.concepto ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'
                }`}
              />
              {validationErrors.concepto && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.concepto}</p>
              )}
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
              <input 
                type="text" 
                name="monto_bs" 
                value={form.monto_bs} 
                onChange={handleMonedaChange} 
                placeholder="0,00" 
                required 
                className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-lg ${validationErrors.monto_bs ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`} 
              />
              {validationErrors.monto_bs && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.monto_bs}</p>
              )}
            </div>

            {/* SECCION ACTUALIZADA CON EL BOTON BCV */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tasa BCV <span className="text-red-500">*</span></label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text" 
                  name="tasa_cambio" 
                  value={form.tasa_cambio} 
                  onChange={handleMonedaChange}
                  placeholder="0,00" 
                  required
                  className={`w-full max-w-[190px] p-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-lg ${validationErrors.tasa_cambio ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}
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
              {validationErrors.tasa_cambio && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.tasa_cambio}</p>
              )}
            </div>
            {/* FIN SECCION BCV */}

            {/* EQUIVALENTE USD MEJORADO */}
            <div className="md:col-span-2 flex justify-end -mt-3 mb-2">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 px-4 py-2 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-bold text-green-800 dark:text-green-300">
                      Equivalente: ${formatMoneyDisplay(equivalenteUSD)} USD
                    </span>
                  </div>
                </div>
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

          {/* Archivos - 100% del ancho */}
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
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

          {/* BOTONES DE NAVEGACIÓN - Paso 1 */}
          <div className="xl:col-span-2 flex justify-between gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-bold transition-colors">Cancelar</button>
            <button 
              type="button" 
              onClick={handleNextStep} 
              className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-800 transition-all shadow-md flex items-center gap-2"
            >
              Siguiente paso
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
          </>
        )}

        {/* PASO 2: CONFIGURACIÓN HISTÓRICA */}
        {wizardStep === 2 && (
          <>
            {/* CUOTAS Y TOTAL DEL GASTO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuotas ya transcurridas</label>
              <div className={`flex items-center border rounded-xl overflow-hidden bg-white dark:bg-gray-800 ${step2ValidationErrors.cuotas_historicas ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/10' : 'border-amber-200 dark:border-amber-800'}`}>
                <button type="button" onClick={() => handleCuotasHistoricasChange(-1)} disabled={tipoRegistro === 'historico'} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors">-</button>
                <input type="text" readOnly value={`${form.cuotas_historicas || '0'} cuota(s)`} className="w-full text-center bg-transparent font-medium dark:text-white outline-none" />
                <button type="button" onClick={() => handleCuotasHistoricasChange(1)} disabled={tipoRegistro === 'historico'} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/30 text-lg font-bold text-amber-700 dark:text-amber-300 transition-colors">+</button>
              </div>
              {tipoRegistro === 'historico' && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Bloqueado: en gasto histórico equivale al total de cuotas.</p>
              )}
              {step2ValidationErrors.cuotas_historicas && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{step2ValidationErrors.cuotas_historicas}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
              <p>Total del gasto: Bs {formatMoneyDisplay(montoBsNum)} / ${formatMoneyDisplay(equivalenteUSD)} USD</p>
            </div>
            {hasStep2Errors && (
              <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/60 dark:bg-red-900/20">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Hay validaciones pendientes en el paso 2:</p>
                {Object.values(step2ValidationErrors).slice(0, 4).map((msg, idx) => (
                  <p key={`${msg}-${idx}`} className="text-[11px] text-red-700 dark:text-red-300">• {msg}</p>
                ))}
              </div>
            )}

            {/* PAGADO HISTÓRICO */}
            <div className="md:col-span-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800/50 dark:bg-indigo-900/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Pagado histórico por orígenes</p>
                <button type="button" onClick={() => addOriginRow('pagado')} className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300">+ Agregar fila</button>
              </div>
              <div className="mt-3 space-y-2">
                {historicoPagadoRows.length === 0 && <p className="text-xs text-indigo-800/70 dark:text-indigo-300/70">Sin filas registradas.</p>}
                {historicoPagadoRows.map((row) => {
                  const fondosOptions = getFondoOptionsByCuenta(row.cuenta_bancaria_id);
                  const fondoActual = getFondoById(row.fondo_id);
                  const esFondoUsd = String(fondoActual?.moneda || '').toUpperCase() === 'USD';
                  const rowError = step2ValidationErrors[`pagado_row_${row.id}`];
                  return (
                    <div key={row.id} className={`grid grid-cols-1 md:grid-cols-14 gap-2 rounded-xl border bg-white p-2 dark:bg-gray-900 ${rowError ? 'border-red-300 dark:border-red-800/60' : 'border-indigo-200 dark:border-indigo-800/40'}`}>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Cuenta</label>
                        <SearchableCombobox options={cuentaOptions} value={row.cuenta_bancaria_id} onChange={(v) => updateOriginRow('pagado', row.id, 'cuenta_bancaria_id', v)} placeholder="Seleccione..." emptyMessage="Sin cuentas" className="w-full h-[42px] px-3 rounded-lg border border-indigo-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Fondo</label>
                        <SearchableCombobox options={fondosOptions} value={row.fondo_id} onChange={(v) => updateOriginRow('pagado', row.id, 'fondo_id', v)} placeholder="Seleccione..." emptyMessage="Sin fondos" disabled={!row.cuenta_bancaria_id} className="w-full h-[42px] px-3 rounded-lg border border-indigo-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Fecha operación</label>
                        <DatePicker
                          selected={ymdToDate(row.fecha_operacion)}
                          onChange={(date: Date | null) => updateOriginRow('pagado', row.id, 'fecha_operacion', dateToYmd(date))}
                          maxDate={getPagadoMaxDate(row.fondo_id) || new Date()}
                          dateFormat="dd/MM/yyyy"
                          locale={es}
                          placeholderText="dd/mm/aaaa"
                          showIcon
                          toggleCalendarOnIconClick
                          wrapperClassName="w-full min-w-0"
                          popperClassName="habioo-datepicker-popper"
                          calendarClassName="habioo-datepicker-calendar"
                          className="h-[42px] w-full rounded-lg border border-indigo-200 bg-white p-2.5 pr-10 outline-none transition-all focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-4 grid grid-cols-2 gap-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Monto USD</label>
                          <input type="text" value={row.monto_usd} onChange={(e) => updateOriginRow('pagado', row.id, 'monto_usd', e.target.value)} placeholder="0,00" className="h-[42px] w-full px-2 rounded-lg border border-indigo-200 bg-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-900 dark:text-white" />
                        </div>
                        {!esFondoUsd && (
                          <div>
                            <label className="block text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Monto Bs</label>
                            <input type="text" value={row.monto_bs} onChange={(e) => updateOriginRow('pagado', row.id, 'monto_bs', e.target.value)} placeholder="0,00" className="h-[42px] w-full px-2 rounded-lg border border-indigo-200 bg-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-900 dark:text-white" />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-1 flex items-end justify-end pb-1">
                        <button type="button" onClick={() => removeOriginRow('pagado', row.id)} className="h-[42px] w-[42px] rounded-lg bg-red-50 text-red-700 font-bold hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300" title="Eliminar fila">x</button>
                      </div>
                      {rowError && (
                        <div className="md:col-span-14">
                          <p className="text-[11px] text-red-600 dark:text-red-400">{rowError}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RECAUDADO HISTÓRICO */}
            <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Recaudado histórico por orígenes</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    💡 Estos montos se convertirán en ingresos y actualizarán los saldos de los fondos seleccionados
                  </p>
                </div>
                <button type="button" onClick={() => addOriginRow('recaudado')} className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300">+ Agregar fila</button>
              </div>
              <div className="space-y-2">
                {historicoRecaudadoRows.length === 0 && <p className="text-xs text-emerald-800/70 dark:text-emerald-300/70">Sin filas registradas.</p>}
                {historicoRecaudadoRows.map((row) => {
                  const fondosOptions = getFondoOptionsByCuenta(row.cuenta_bancaria_id);
                  const montoBsNum = parseInputNumber(row.monto_bs);
                  const tasaRef = tasaHistoricaDia > 0 ? tasaHistoricaDia : parseInputNumber(form.tasa_cambio || '0');
                  const montoUsdAuto = tasaRef > 0 ? (montoBsNum / tasaRef).toFixed(2) : '0.00';
                  const recaudadoMinDate = getRecaudadoMinDate(row.fondo_id);
                  const fondoActual = getFondoById(row.fondo_id);
                  const esFondoUsd = String(fondoActual?.moneda || '').toUpperCase() === 'USD';
                  const rowError = step2ValidationErrors[`recaudado_row_${row.id}`];
                  return (
                    <div key={row.id} className={`grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border bg-white p-2 dark:bg-gray-900 ${rowError ? 'border-red-300 dark:border-red-800/60' : 'border-emerald-200 dark:border-emerald-800/40'}`}>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Cuenta</label>
                        <SearchableCombobox options={cuentaOptions} value={row.cuenta_bancaria_id} onChange={(v) => updateOriginRow('recaudado', row.id, 'cuenta_bancaria_id', v)} placeholder="Seleccione..." emptyMessage="Sin cuentas" className="w-full h-[42px] px-3 rounded-lg border border-emerald-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Fondo</label>
                        <SearchableCombobox options={fondosOptions} value={row.fondo_id} onChange={(v) => updateOriginRow('recaudado', row.id, 'fondo_id', v)} placeholder="Seleccione..." emptyMessage="Sin fondos" disabled={!row.cuenta_bancaria_id} className="w-full h-[42px] px-3 rounded-lg border border-emerald-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Fecha</label>
                        <DatePicker
                          selected={ymdToDate(row.fecha_operacion)}
                          onChange={(date: Date | null) => updateOriginRow('recaudado', row.id, 'fecha_operacion', dateToYmd(date))}
                          {...(recaudadoMinDate ? { minDate: recaudadoMinDate } : {})}
                          maxDate={new Date()}
                          dateFormat="dd/MM/yyyy"
                          locale={es}
                          placeholderText="dd/mm/aaaa"
                          showIcon
                          toggleCalendarOnIconClick
                          wrapperClassName="w-full min-w-0"
                          popperClassName="habioo-datepicker-popper"
                          calendarClassName="habioo-datepicker-calendar"
                          className="h-[42px] w-full rounded-lg border border-emerald-200 bg-white p-2 pr-10 outline-none transition-all focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-3 grid grid-cols-2 gap-1">
                        {!esFondoUsd && (
                          <div>
                            <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Monto Bs</label>
                            <input
                              type="text"
                              value={row.monto_bs}
                              onChange={(e) => {
                                updateOriginRow('recaudado', row.id, 'monto_bs', e.target.value);
                                const bsValue = parseInputNumber(e.target.value);
                                const tasaRef = tasaHistoricaDia > 0 ? tasaHistoricaDia : parseInputNumber(form.tasa_cambio || '0');
                                if (bsValue > 0 && tasaRef > 0) {
                                  const usdValue = (bsValue / tasaRef).toFixed(2).replace('.', ',');
                                  updateOriginRow('recaudado', row.id, 'monto_usd', formatCurrencyInput(usdValue, 2));
                                }
                              }}
                              placeholder="0,00"
                              className="h-[42px] w-full px-2 rounded-lg border border-emerald-200 bg-white font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                            />
                            <p className="text-[10px] text-gray-500 mt-0.5">≈ ${montoUsdAuto} USD</p>
                          </div>
                        )}
                        <div>
                          <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Monto USD</label>
                          <input
                            type="text"
                            value={row.monto_usd}
                            readOnly={!esFondoUsd}
                            onChange={(e) => {
                              if (!esFondoUsd) return;
                              updateOriginRow('recaudado', row.id, 'monto_usd', e.target.value);
                            }}
                            placeholder="0,00"
                            className={`h-[42px] w-full px-2 rounded-lg border border-emerald-200 font-mono text-sm outline-none dark:border-emerald-700 dark:text-emerald-300 ${
                              esFondoUsd
                                ? 'bg-white focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900'
                                : 'bg-emerald-50 dark:bg-emerald-900/30 cursor-not-allowed'
                            }`}
                          />
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{esFondoUsd ? 'Editable para fondos USD' : 'Auto-calculado'}</p>
                        </div>
                      </div>
                      <div className="md:col-span-1 flex items-end justify-end pb-1">
                        <button type="button" onClick={() => removeOriginRow('recaudado', row.id)} className="h-[42px] w-[42px] rounded-lg bg-red-50 text-red-700 font-bold hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300" title="Eliminar fila">x</button>
                      </div>
                      {rowError && (
                        <div className="md:col-span-12">
                          <p className="text-[11px] text-red-600 dark:text-red-400">{rowError}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                    Monto recaudado fuera de cuentas bancarias registradas
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Monto Bs</label>
                      <input
                        type="text"
                        name="monto_historico_recaudado_no_cuenta_bs"
                        value={form.monto_historico_recaudado_no_cuenta_bs}
                        onChange={handleMontoNoCuentaChange}
                        placeholder="0,00"
                        className="h-[40px] w-full px-2 rounded-lg border border-emerald-200 bg-white font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Monto USD</label>
                      <input
                        type="text"
                        name="monto_historico_recaudado_no_cuenta_usd"
                        value={form.monto_historico_recaudado_no_cuenta_usd}
                        onChange={handleMontoNoCuentaChange}
                        placeholder="0,00"
                        className="h-[40px] w-full px-2 rounded-lg border border-emerald-200 bg-white font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">Este monto afecta solo el saldo de recaudación histórica. No genera movimiento en banco/fondos.</p>
                </div>
              </div>
            </div>

            {/* TOTALES */}
            <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Totales pagado</p>
                  <p className="font-bold">${formatMoneyDisplay(totalsPagado.usd)} USD</p>
                  <p className="font-bold text-gray-600 dark:text-gray-400">Bs {formatMoneyDisplay(totalsPagado.bs)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Totales recaudado</p>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">${formatMoneyDisplay(totalsRecaudado.usd)} USD</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-500">Bs {formatMoneyDisplay(totalsRecaudado.bs)}</p>
                </div>
              </div>
              {totalsRecaudado.usd > totalsPagado.usd && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 dark:bg-amber-900/20 dark:border-amber-800/50">
                  <p className="text-amber-700 dark:text-amber-300 text-[10px]">
                    ⚠️ El recaudado supera al pagado. Se generará un ingreso adicional en los fondos seleccionados.
                  </p>
                </div>
              )}
              {step2ValidationErrors.totales_usd && (
                <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{step2ValidationErrors.totales_usd}</p>
              )}
            </div>

          {/* BOTONES DE NAVEGACIÓN - Paso 2 */}
          <div className="xl:col-span-2 flex justify-between gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-6 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Atrás
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm('¿Seguro que deseas limpiar el contexto histórico? Se borrarán los montos y orígenes cargados en esta sección.');
                  if (!confirmed) return;
                  setHasHistoricalContext(false);
                  setHistoricoPagadoRows([]);
                  setHistoricoRecaudadoRows([]);
                  setForm((prev: FormState) => ({
                    ...prev,
                    cuotas_historicas: tipoRegistro === 'historico' ? prev.total_cuotas : '0',
                    monto_historico_proveedor_usd: '',
                    monto_historico_proveedor_bs: '',
                    monto_historico_recaudado_usd: '',
                    monto_historico_recaudado_bs: '',
                    monto_historico_recaudado_no_cuenta_usd: '',
                    monto_historico_recaudado_no_cuenta_bs: '',
                    historico_en_cuenta: false,
                    historico_cuenta_bancaria_id: '',
                    historico_fondo_id: '',
                  }));
                }}
                className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold hover:bg-red-100 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300"
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={hasStep2Errors}
                className="px-6 py-3 rounded-xl bg-donezo-primary text-white font-bold hover:bg-green-800 transition-all shadow-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-donezo-primary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {mode === 'edit' ? 'Guardar Cambios' : 'Guardar Gasto'}
              </button>
            </div>
          </div>
          </>
        )}
      </form>
    </ModalBase>
  );
};

export default ModalAgregarGasto;
















