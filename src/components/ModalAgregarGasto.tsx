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
    <ModalBase
      onClose={onClose}
      title={mode === 'edit' ? 'Editar Gasto' : 'Registrar Gasto'}
      helpTooltip="Aqui puedes cargar un gasto nuevo o historico, completar datos del documento, definir cuotas, tipo de gasto y adjuntar factura/soportes antes de guardar."
      maxWidth="max-w-6xl"
    >
      {/* PROGRESS STEPS PANEL */}
      <div className="pt-4 mb-5">
        <nav aria-label="Progress">
          <div className="mx-auto flex w-full max-w-[520px] items-center">
            <div className="flex items-center flex-1">
              <div className="flex items-center gap-3 shrink-0">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0 ${
                  wizardStep > 1
                    ? 'bg-green-600 text-white shadow-md shadow-green-600/25'
                    : 'border-2 border-green-600 text-green-600 bg-green-600/5 shadow-sm'
                }`}>
                  {wizardStep > 1 ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : '01'}
                </div>
                <div>
                  <p className={`text-sm font-semibold transition-colors ${wizardStep >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Datos básicos</p>
                  <p className={`text-xs transition-colors ${wizardStep >= 1 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400/60 dark:text-gray-600'}`}>Información del gasto</p>
                </div>
              </div>
              <div className="flex-1 mx-3 relative h-0.5">
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className={`absolute inset-y-0 left-0 rounded-full bg-green-600 transition-all duration-500 ${wizardStep >= 2 ? 'w-full' : 'w-0'}`} />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0 ${
                wizardStep === 2
                  ? 'border-2 border-green-600 text-green-600 bg-green-600/5 shadow-sm'
                  : 'border-2 border-gray-300/60 text-gray-400/70 bg-gray-100/50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
              }`}>
                02
              </div>
              <div>
                <p className={`text-sm font-semibold transition-colors ${wizardStep === 2 ? 'text-gray-900 dark:text-white' : 'text-gray-400/70 dark:text-gray-500'}`}>Histórico</p>
                <p className={`text-xs transition-colors ${wizardStep === 2 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400/50 dark:text-gray-600'}`}>Configuración avanzada</p>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 mb-5" />

      <form onSubmit={tipoRegistro === 'historico' && wizardStep === 1 ? undefined : handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* TIPO DE REGISTRO - Siempre visible en ambos pasos */}
        <div className="xl:col-span-2 rounded-2xl border border-green-600/15 bg-gradient-to-br from-green-600/[0.03] to-transparent p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-500 mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500" />
            Tipo de registro
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setTipoRegistro('nuevo');
                setHasHistoricalContext(false);
                setWizardStep(1);
              }}
              className={`group rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                tipoRegistro === 'nuevo'
                  ? 'border-green-600 bg-green-600/[0.06] shadow-sm shadow-green-600/10 dark:bg-green-600/10'
                  : 'border-gray-200/80 dark:border-gray-700 hover:border-green-600/30 hover:bg-gray-100/30 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    tipoRegistro === 'nuevo'
                      ? 'bg-green-600/10 text-green-600 dark:text-green-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-green-600/5 group-hover:text-green-600/70'
                  }`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className={`font-semibold text-sm transition-colors ${tipoRegistro === 'nuevo' ? 'text-green-600 dark:text-green-500' : 'text-gray-900 dark:text-white'}`}>
                    Gasto nuevo
                  </p>
                </div>
                {tipoRegistro === 'nuevo' && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shrink-0">
                    ACTIVO
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-12 leading-relaxed">Se incluye en avisos de cobro y funciona como hasta ahora.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoRegistro('historico');
                setHasHistoricalContext(true);
                setWizardStep(1);
              }}
              className={`group rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                tipoRegistro === 'historico'
                  ? 'border-green-600 bg-green-600/[0.06] shadow-sm shadow-green-600/10 dark:bg-green-600/10'
                  : 'border-gray-200/80 dark:border-gray-700 hover:border-green-600/30 hover:bg-gray-100/30 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    tipoRegistro === 'historico'
                      ? 'bg-green-600/10 text-green-600 dark:text-green-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-green-600/5 group-hover:text-green-600/70'
                  }`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className={`font-semibold text-sm transition-colors ${tipoRegistro === 'historico' ? 'text-green-600 dark:text-green-500' : 'text-gray-900 dark:text-white'}`}>
                    Gasto histórico
                  </p>
                </div>
                {tipoRegistro === 'historico' && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shrink-0">
                    ACTIVO
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-12 leading-relaxed">No se reflejará en avisos de cobro. Queda para control histórico y recaudación manual.</p>
            </button>
          </div>
        </div>

        {/* PASO 1: DATOS BÁSICOS */}
        {wizardStep === 1 && (
          <>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Proveedor <span className="text-red-500">*</span></label>
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
              className={`h-11 w-full rounded-xl border bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-gray-800 dark:text-white ${validationErrors.proveedor_id ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}
            />
            {validationErrors.proveedor_id && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.proveedor_id}</p>
            )}
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Concepto <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="concepto"
                value={form.concepto}
                onChange={handleChange}
                placeholder="Ej: Reparación de tubería..."
                required
                className={`h-11 w-full rounded-xl border bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-gray-800 dark:text-white ${
                  validationErrors.concepto ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'
                }`}
              />
              {validationErrors.concepto && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.concepto}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha factura / recibo</label>
              <DatePicker
                selected={ymdToDate(form.fecha_gasto)}
                onChange={(date: Date | null) => setForm((prev: FormState) => ({ ...prev, fecha_gasto: dateToYmd(date) }))}
                maxDate={new Date()}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Opcional (dd/mm/aaaa)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Etiqueta</label>
              <select
                name="clasificacion"
                value={form.clasificacion}
                onChange={handleChange}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="Fijo">Gasto fijo</option>
                <option value="Variable">Gasto variable</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">N. recibo / factura</label>
              <input
                type="text"
                name="numero_documento"
                value={form.numero_documento}
                onChange={handleChange}
                placeholder="Opcional"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="xl:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto (Bs) <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="monto_bs"
                value={form.monto_bs}
                onChange={handleMonedaChange}
                placeholder="0,00"
                required
                className={`h-11 w-full rounded-xl border bg-gray-50 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-gray-800 dark:text-white ${validationErrors.monto_bs ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {validationErrors.monto_bs && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.monto_bs}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tasa BCV <span className="text-red-500">*</span></label>
              <div className="flex">
                <input
                  type="text"
                  name="tasa_cambio"
                  value={form.tasa_cambio}
                  onChange={handleMonedaChange}
                  placeholder="0,00"
                  required
                  className={`h-11 w-full rounded-l-xl rounded-r-none border border-r-0 bg-gray-50 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-gray-800 dark:text-white ${validationErrors.tasa_cambio ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}
                />
                <button
                  type="button"
                  onClick={handleFetchBCV}
                  disabled={loadingBCV}
                  title="Obtener tasa oficial del BCV actual"
                  className="h-11 shrink-0 rounded-l-none rounded-r-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 disabled:opacity-50"
                >
                  {loadingBCV ? (
                    <svg
                      className="h-5 w-5 animate-spin"
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

            <div className="md:col-span-2 flex justify-end">
                <div className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-white shadow-md shadow-green-600/20">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm font-bold">Equivalente: ${formatMoneyDisplay(equivalenteUSD)} USD</span>
                </div>
            </div>
          </div>

          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-[220px_auto_1fr] gap-5 items-start">
            {/* Diferir en cuotas */}
            <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Diferir en Cuotas</p>
              <div className="flex items-center overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-700">
                <button type="button" onClick={() => handleCuotasChange(-1)} className="h-11 w-11 flex items-center justify-center shrink-0 border-r border-gray-200/80 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50/50 hover:text-red-500 transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <div className="h-11 flex-1 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/30 text-sm font-bold tabular-nums dark:text-white">
                  {form.total_cuotas} Mes(es)
                </div>
                <button type="button" onClick={() => handleCuotasChange(1)} className="h-11 w-11 flex items-center justify-center shrink-0 border-l border-gray-200/80 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-600/5 hover:text-green-600 transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>

            {/* Tipo de gasto */}
            <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Tipo de gasto</p>
              <div className="inline-flex rounded-xl bg-gray-100/60 dark:bg-gray-800/50 p-1 mb-3">
                <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Comun', zona_id: '', propiedad_id: '' }))} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${form.asignacion_tipo === 'Comun' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Común</button>
                <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Zona', propiedad_id: '' }))} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${form.asignacion_tipo === 'Zona' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Por Área</button>
                <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Individual', zona_id: '' }))} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${form.asignacion_tipo === 'Individual' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Individual</button>
                <button type="button" onClick={() => setForm((prev: FormState) => ({ ...prev, asignacion_tipo: 'Extra', zona_id: '', propiedad_id: '' }))} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${form.asignacion_tipo === 'Extra' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Extra</button>
              </div>
              {form.asignacion_tipo === 'Zona' && (
                <select name="zona_id" value={form.zona_id} onChange={handleChange} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white" required>
                  <option value="">Seleccione el área...</option>
                  {zonas.map((z: Zona) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              )}
              {form.asignacion_tipo === 'Individual' && (
                <select name="propiedad_id" value={form.propiedad_id} onChange={handleChange} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white" required>
                  <option value="">Seleccione el inmueble...</option>
                  {propiedades.map((p: Propiedad) => <option key={p.id} value={p.id}>{p.identificador}</option>)}
                </select>
              )}
            </div>

            {/* Nota interna */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nota interna</label>
              <textarea name="nota" value={form.nota} onChange={handleChange} placeholder="Detalles adicionales..." rows={4} className="w-full min-h-[120px] resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 outline-none focus:ring-2 focus:ring-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>

          {/* Archivos - 100% del ancho */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">Archivos permitidos: Factura o recibo permite imagen o PDF. Soportes permiten imagen o PDF. Límites: máximo 4 soportes y cada PDF hasta 1 MB.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Factura o recibo (1 archivo)
              </p>
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
                    className="group w-full rounded-xl border-2 border-dashed border-green-600/30 p-5 flex items-center justify-center cursor-pointer hover:bg-green-600/[0.03] hover:border-green-600/50 transition-all duration-200 dark:border-green-600/20 dark:hover:border-green-600/40"
                  >
                    <span className="text-sm text-green-600 font-semibold group-hover:underline dark:text-green-500">
                      {facturaFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    </span>
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Soportes (máx 4, PDF hasta 1 MB)</label>
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
                      className="group w-full rounded-xl border-2 border-dashed border-gray-300/80 p-5 flex items-center justify-center cursor-pointer hover:bg-gray-100/30 hover:border-gray-400/50 transition-all duration-200 dark:border-gray-600/60 dark:hover:border-gray-500"
                    >
                      <span className="text-sm text-gray-500 font-medium group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200">Agregar soportes</span>
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
            </div>{/* end grid */}
          </div>{/* end space-y-4 */}

          {/* BOTONES DE NAVEGACIÓN - Paso 1 */}
          <div className="xl:col-span-2 flex justify-between gap-3 mt-2 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors">Cancelar</button>
            <button
              type="button"
              onClick={handleNextStep}
              className="rounded-xl bg-green-600 px-7 py-2.5 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 flex items-center gap-2"
            >
              Siguiente paso
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          </>
        )}

        {/* PASO 2: CONFIGURACIÓN HISTÓRICA */}
        {wizardStep === 2 && (
          <>
            {/* CUOTAS Y TOTAL DEL GASTO */}
            <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                Cuotas ya transcurridas
              </p>
              <div className={`flex items-center overflow-hidden rounded-xl ${step2ValidationErrors.cuotas_historicas ? 'border border-red-400 dark:border-red-700' : 'border border-gray-200/80 dark:border-gray-700'}`}>
                <button type="button" onClick={() => handleCuotasHistoricasChange(-1)} disabled={tipoRegistro === 'historico'} className="h-11 w-11 rounded-l-xl rounded-r-none border-r-0 shrink-0 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors border-r border-gray-200/80 dark:border-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <div className="h-11 flex-1 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/30 text-sm font-bold tabular-nums dark:text-white">
                  {form.cuotas_historicas || '0'} cuota(s)
                </div>
                <button type="button" onClick={() => handleCuotasHistoricasChange(1)} disabled={tipoRegistro === 'historico'} className="h-11 w-11 rounded-r-xl rounded-l-none border-l-0 shrink-0 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors border-l border-gray-200/80 dark:border-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              {tipoRegistro === 'historico' && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v4m0 8a9 9 0 100-18 9 9 0 000 18z" /></svg>
                  Bloqueado: en gasto histórico equivale al total de cuotas.
                </p>
              )}
              {step2ValidationErrors.cuotas_historicas && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{step2ValidationErrors.cuotas_historicas}</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 flex items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Total del gasto</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Bs {formatMoneyDisplay(montoBsNum)}</p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-500 mt-0.5">${formatMoneyDisplay(equivalenteUSD)} USD</p>
              </div>
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
            <div className="md:col-span-2 rounded-2xl border border-green-600/15 bg-gradient-to-br from-green-600/[0.02] to-transparent overflow-hidden">
              <div className="flex items-start justify-between p-5 pb-0">
                <h4 className="text-sm font-bold text-green-600 dark:text-green-500 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500 shrink-0" />
                  Pagado histórico por orígenes
                </h4>
                <button type="button" onClick={() => addOriginRow('pagado')} className="h-8 px-2.5 text-xs font-semibold text-green-600 dark:text-green-500 hover:bg-green-600/5 rounded-lg transition-colors flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Agregar fila
                </button>
              </div>
              <div className="p-5 pt-4">
                <div className="rounded-xl border border-gray-200/90 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100/70 dark:bg-gray-800/50">
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Cuenta</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Fondo</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha operación</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto USD</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto Bs</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {historicoPagadoRows.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500">Sin filas registradas.</td></tr>
                      )}
                      {historicoPagadoRows.map((row) => {
                        const fondosOptions = getFondoOptionsByCuenta(row.cuenta_bancaria_id);
                        const fondoActual = getFondoById(row.fondo_id);
                        const esFondoUsd = String(fondoActual?.moneda || '').toUpperCase() === 'USD';
                        const rowError = step2ValidationErrors[`pagado_row_${row.id}`];
                        return (
                          <React.Fragment key={row.id}>
                            <tr className={`border-t border-gray-200/70 dark:border-gray-700/70 hover:bg-gray-100/30 dark:hover:bg-gray-800/20 transition-colors ${rowError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                              <td className="px-2 py-2">
                                <SearchableCombobox options={cuentaOptions} value={row.cuenta_bancaria_id} onChange={(v) => updateOriginRow('pagado', row.id, 'cuenta_bancaria_id', v)} placeholder="Seleccione..." emptyMessage="Sin cuentas" className="w-full h-9 text-xs px-2 rounded-lg border border-gray-200/90 bg-white outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                              </td>
                              <td className="px-2 py-2">
                                <SearchableCombobox options={fondosOptions} value={row.fondo_id} onChange={(v) => updateOriginRow('pagado', row.id, 'fondo_id', v)} placeholder="Seleccione..." emptyMessage="Sin fondos" disabled={!row.cuenta_bancaria_id} className="w-full h-9 text-xs px-2 rounded-lg border border-gray-200/90 bg-white outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                              </td>
                              <td className="px-2 py-2">
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
                                  className="h-9 w-full rounded-lg border border-gray-200/90 bg-white p-2 pr-8 text-xs outline-none transition-all focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input type="text" value={row.monto_usd} onChange={(e) => updateOriginRow('pagado', row.id, 'monto_usd', e.target.value)} placeholder="0,00" className="h-9 w-full px-2 rounded-lg border border-gray-200/90 bg-white text-xs outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                              </td>
                              <td className="px-2 py-2">
                                {!esFondoUsd ? (
                                  <input type="text" value={row.monto_bs} onChange={(e) => updateOriginRow('pagado', row.id, 'monto_bs', e.target.value)} placeholder="0,00" className="h-9 w-full px-2 rounded-lg border border-gray-200/90 bg-white text-xs outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                                ) : (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 pl-1">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => removeOriginRow('pagado', row.id)} className="text-red-500/50 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/5 transition-all" title="Eliminar fila">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </td>
                            </tr>
                            {rowError && (
                              <tr key={`${row.id}-err`} className="border-t border-red-200/50 dark:border-red-800/30 bg-red-50/40 dark:bg-red-900/10">
                                <td colSpan={6} className="px-3 py-1.5">
                                  <p className="text-[11px] text-red-600 dark:text-red-400">{rowError}</p>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RECAUDADO HISTÓRICO */}
            <div className="md:col-span-2 rounded-2xl border border-green-600/15 bg-gradient-to-br from-green-600/[0.02] to-transparent overflow-hidden">
              <div className="flex items-start justify-between p-5 pb-0">
                <div>
                  <h4 className="text-sm font-bold text-green-600 dark:text-green-500 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500 shrink-0" />
                    Recaudado histórico por orígenes
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-3.5 flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Estos montos se convertirán en ingresos y actualizarán los saldos de los fondos seleccionados
                  </p>
                </div>
                <button type="button" onClick={() => addOriginRow('recaudado')} className="h-8 px-2.5 text-xs font-semibold text-green-600 dark:text-green-500 hover:bg-green-600/5 rounded-lg transition-colors flex items-center gap-1 shrink-0">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Agregar fila
                </button>
              </div>
              <div className="p-5 pt-4">
                <div className="rounded-xl border border-gray-200/90 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100/70 dark:bg-gray-800/50">
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Cuenta</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Fondo</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto Bs</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto USD</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {historicoRecaudadoRows.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500">Sin filas registradas.</td></tr>
                      )}
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
                          <React.Fragment key={row.id}>
                            <tr className={`border-t border-gray-200/70 dark:border-gray-700/70 hover:bg-gray-100/30 dark:hover:bg-gray-800/20 transition-colors ${rowError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                              <td className="px-2 py-2">
                                <SearchableCombobox options={cuentaOptions} value={row.cuenta_bancaria_id} onChange={(v) => updateOriginRow('recaudado', row.id, 'cuenta_bancaria_id', v)} placeholder="Seleccione..." emptyMessage="Sin cuentas" className="w-full h-9 text-xs px-2 rounded-lg border border-gray-200/90 bg-white outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                              </td>
                              <td className="px-2 py-2">
                                <SearchableCombobox options={fondosOptions} value={row.fondo_id} onChange={(v) => updateOriginRow('recaudado', row.id, 'fondo_id', v)} placeholder="Seleccione..." emptyMessage="Sin fondos" disabled={!row.cuenta_bancaria_id} className="w-full h-9 text-xs px-2 rounded-lg border border-gray-200/90 bg-white outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                              </td>
                              <td className="px-2 py-2">
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
                                  className="h-9 w-full rounded-lg border border-gray-200/90 bg-white p-2 pr-8 text-xs outline-none transition-all focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              </td>
                              <td className="px-2 py-2">
                                {!esFondoUsd ? (
                                  <div>
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
                                      className="h-9 w-full px-2 rounded-lg border border-gray-200/90 bg-white text-xs outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">≈ ${montoUsdAuto} USD</p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 pl-1">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={row.monto_usd}
                                  readOnly={!esFondoUsd}
                                  onChange={(e) => {
                                    if (!esFondoUsd) return;
                                    updateOriginRow('recaudado', row.id, 'monto_usd', e.target.value);
                                  }}
                                  placeholder="0,00"
                                  className={`h-9 w-full px-2 rounded-lg border border-gray-200/90 text-xs outline-none dark:border-gray-700 dark:text-gray-300 ${
                                    esFondoUsd
                                      ? 'bg-white focus:ring-2 focus:ring-green-500 dark:bg-gray-900'
                                      : 'bg-gray-50 dark:bg-gray-800/60 cursor-not-allowed'
                                  }`}
                                />
                                {!esFondoUsd && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Auto-calculado</p>}
                              </td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => removeOriginRow('recaudado', row.id)} className="text-red-500/50 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/5 transition-all" title="Eliminar fila">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </td>
                            </tr>
                            {rowError && (
                              <tr key={`${row.id}-err`} className="border-t border-red-200/50 dark:border-red-800/30 bg-red-50/40 dark:bg-red-900/10">
                                <td colSpan={6} className="px-3 py-1.5">
                                  <p className="text-[11px] text-red-600 dark:text-red-400">{rowError}</p>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MONTO RECAUDADO FUERA DE CUENTAS */}
            <div className="md:col-span-2 rounded-2xl border border-green-600/15 bg-gradient-to-br from-green-600/[0.02] to-transparent p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-500 mb-4 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500 shrink-0" />
                Monto recaudado fuera de cuentas bancarias registradas
              </p>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto Bs</label>
                  <input
                    type="text"
                    name="monto_historico_recaudado_no_cuenta_bs"
                    value={form.monto_historico_recaudado_no_cuenta_bs}
                    onChange={handleMontoNoCuentaChange}
                    placeholder="0,00"
                    className="h-11 w-full px-3 rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto USD</label>
                  <input
                    type="text"
                    name="monto_historico_recaudado_no_cuenta_usd"
                    value={form.monto_historico_recaudado_no_cuenta_usd}
                    onChange={handleMontoNoCuentaChange}
                    placeholder="0,00"
                    className="h-11 w-full px-3 rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-1.5">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Este monto afecta solo el saldo de recaudación histórica. No genera movimiento en banco/fondos.
              </p>
            </div>

            {/* TOTALES */}
            <div className="md:col-span-2 rounded-2xl border border-gray-200/80 dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Totales pagado</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">${formatMoneyDisplay(totalsPagado.usd)} USD</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums mt-0.5">Bs {formatMoneyDisplay(totalsPagado.bs)}</p>
                </div>
                <div className="p-5 bg-green-600/[0.03]">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Totales recaudado</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-500 tabular-nums">${formatMoneyDisplay(totalsRecaudado.usd)} USD</p>
                  <p className="text-sm text-green-600/80 dark:text-green-500/80 tabular-nums mt-0.5">Bs {formatMoneyDisplay(totalsRecaudado.bs)}</p>
                </div>
              </div>
              {step2ValidationErrors.totales_usd && (
                <div className="px-5 pb-3">
                  <p className="text-[11px] text-red-600 dark:text-red-400">{step2ValidationErrors.totales_usd}</p>
                </div>
              )}
            </div>
            {totalsRecaudado.usd > totalsPagado.usd && (
              <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-800/50 px-5 py-3.5">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  El recaudado supera al pagado. Se generará un ingreso adicional en los fondos seleccionados.
                </p>
              </div>
            )}

          {/* BOTONES DE NAVEGACIÓN - Paso 2 */}
          <div className="xl:col-span-2 flex justify-between gap-3 mt-6 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-5 py-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
                className="px-4 py-2.5 rounded-xl border border-red-200/80 bg-red-50/80 text-red-700 font-semibold text-sm hover:bg-red-100 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300 transition-colors"
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={hasStep2Errors}
                className="px-7 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
















