import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import type { SortingState } from '@tanstack/react-table';
import DateRangePicker from '../ui/DateRangePicker';
import { es } from 'date-fns/locale/es';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { getCurrentBcvRate } from '../../utils/bcv';
import { ModalRegistrarEgreso, ModalTransferencia } from '../bancos';
import ModalRegistrarPago from '../ModalRegistrarPago';
import ModalDetalleMovimiento, { type IMovimientoDetalle } from './ModalDetalleMovimiento';
import DataTable, { type Column } from '../ui/DataTable';
import ModalBase from '../ui/ModalBase';
import FormField from '../ui/FormField';
import SearchableCombobox, { type SearchableComboboxOption } from '../ui/SearchableCombobox';
import { useDialog } from '../ui/DialogProvider';
import HabiooLoader from '../ui/HabiooLoader';

type ViewMode = 'admin' | 'owner';
type ActiveTab = 'cuenta' | 'sin-fondo' | `fondo-${number | string}`;
type MainTableColumnKey = 'fecha' | 'referencia' | 'inmueble' | 'descripcion' | 'monto_bs' | 'cargo' | 'abono' | 'tasa' | 'acciones';

interface EstadoCuentaBancariaViewProps {
  mode: ViewMode;
}

interface OutletContextType {
  userRole?: string;
  propiedadActiva?: {
    id_condominio: number;
    identificador: string;
    nombre_condominio: string;
  } | null;
}

interface CuentaBancaria {
  id: number | string;
  nombre_banco?: string;
  apodo?: string;
  moneda?: string;
  tipo?: string;
  es_predeterminada?: boolean;
}

interface Fondo {
  id: number | string;
  cuenta_bancaria_id?: number | string;
  nombre?: string;
  moneda?: 'USD' | 'BS' | string;
  saldo_actual?: string | number;
  fecha_saldo?: string | null;
  visible_propietarios?: boolean;
  nombre_banco?: string;
  apodo?: string;
}

interface IMovimiento extends IMovimientoDetalle {
  saldo_acumulado?: string | number;
  monto_origen_pago?: number;
  fondo_id?: number | null;
  fondo_origen_id?: number | null;
  fondo_destino_id?: number | null;
  fondo_nombre?: string;
  pago_id?: number | null;
  inmueble?: string;
  tipo_raw?: string;
  es_apertura?: boolean;
  apertura_sintetica?: boolean;
  pendiente_inmueble_manual?: boolean;
}

interface RollbackTarget {
  kind: 'pago' | 'ajuste' | 'transferencia' | 'egreso' | 'pago_proveedor';
  id: string;
}

interface DialogContextType {
  showAlert: (options: {
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'info' | 'success' | 'warning' | 'danger';
  }) => Promise<void>;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'info' | 'success' | 'warning' | 'danger';
  }) => Promise<boolean>;
}

interface BancosResponse {
  status: string;
  bancos?: CuentaBancaria[];
  data?: CuentaBancaria | CuentaBancaria[];
}

interface FondosResponse {
  status: string;
  fondos?: Fondo[];
  data?: Fondo[];
}

interface CortePeriodo {
  anio: number;
  mes: number;
}

interface CorteFondo {
  id: number;
  anio: number;
  mes: number;
  fondo_id: number;
  cuenta_bancaria_id: number | null;
  nombre_fondo: string;
  nombre_banco: string | null;
  apodo_cuenta: string | null;
  moneda: string;
  saldo_actual: string | number;
  saldo_bs: string | number;
  saldo_usd: string | number;
  tasa_referencia: string | number | null;
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

const toSingleDate = (value: Date | Date[] | null): Date | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

interface CortesResponse {
  status: string;
  data?: {
    cortes?: CorteFondo[];
    periodos?: CortePeriodo[];
  };
}

interface MovimientosResponse {
  status: string;
  movimientos?: Array<Partial<IMovimiento>>;
  data?: Array<Partial<IMovimiento>>;
}

interface IExtraInfo {
  pago_id: number;
  fecha: string;
  referencia: string | null;
  inmueble: string | null;
  concepto: string;
  monto_bs: number | null;
  monto_usd: number;
  fondo_destino: string | null;
}

interface ExtrasInfoResponse {
  status: string;
  extras?: IExtraInfo[];
}

interface PropiedadAdminOption {
  id: number;
  identificador: string;
  saldo_actual?: string | number;
  prop_nombre?: string;
}

interface PropiedadesAdminResponse {
  status: string;
  propiedades?: PropiedadAdminOption[];
}

const PENDIENTE_INMUEBLE_TAG = '[PENDIENTE_INMUEBLE]';
const MAIN_TABLE_COLUMN_DEFAULT_WIDTHS: Record<MainTableColumnKey, number> = {
  fecha: 165,
  referencia: 130,
  inmueble: 150,
  descripcion: 360,
  monto_bs: 170,
  cargo: 140,
  abono: 140,
  tasa: 125,
  acciones: 180,
};
const MAIN_TABLE_COLUMN_MIN_WIDTHS: Record<MainTableColumnKey, number> = {
  fecha: 130,
  referencia: 100,
  inmueble: 120,
  descripcion: 220,
  monto_bs: 130,
  cargo: 120,
  abono: 120,
  tasa: 100,
  acciones: 130,
};

const toNumber = (value: unknown): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toNullableInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

const formatCurrency = (value: string | number | undefined | null): string => {
  const n = toNumber(value);
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
};

const formatRate = (value: string | number | undefined | null): string => {
  const n = toNumber(value);
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(n);
};

const formatFecha = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const datePart = dateString.split('T')[0] ?? '';
    const [year = '', month = '', day = ''] = datePart.split('-');
    if (!year || !month || !day) return dateString;
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

const getCuentaLabel = (cuenta: CuentaBancaria): string => {
  const banco = String(cuenta.nombre_banco || '').trim();
  const apodo = String(cuenta.apodo || '').trim();
  const moneda = String(cuenta.moneda || '').trim().toUpperCase();
  const tipo = String(cuenta.tipo || '').trim().toUpperCase();
  const inferSource = `${banco} ${apodo} ${tipo}`.toUpperCase();
  const isUsd =
    moneda === 'USD'
    || tipo.includes('USD')
    || tipo.includes('ZELLE')
    || tipo.includes('DOLAR')
    || tipo.includes('DIVISA')
    || inferSource.includes('USD')
    || inferSource.includes('ZELLE');

  if (isUsd) {
    const base = banco ? `Cuenta USD - ${banco}` : 'Cuenta USD';
    return `${base} (${apodo || 'Cuenta'})`;
  }

  return `${banco || 'Banco'} (${apodo || 'Cuenta'})`;
};

const parseFilterDate = (value: string): Date | null => {
  const txt = value.trim();
  if (!txt) return null;
  const d = new Date(`${txt}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getCuentaStorageKey = (mode: ViewMode, ownerCondominioId?: number): string => (
  mode === 'owner'
    ? `habioo_estado_cuenta_selected_owner_${String(ownerCondominioId || '')}`
    : 'habioo_estado_cuenta_selected_admin'
);

const isCuentaEnUsd = (cuenta: CuentaBancaria): boolean => {
  const moneda = String(cuenta.moneda || '').trim().toUpperCase();
  const tipo = String(cuenta.tipo || '').trim().toUpperCase();
  const nombreBanco = String(cuenta.nombre_banco || '').trim().toUpperCase();
  const apodo = String(cuenta.apodo || '').trim().toUpperCase();
  const source = `${moneda} ${tipo} ${nombreBanco} ${apodo}`;
  return source.includes('USD') || source.includes('ZELLE') || source.includes('DIVISA') || source.includes('DOLAR');
};

const pickCuentaInicial = (cuentasDisponibles: CuentaBancaria[], preferredId: string): CuentaBancaria | null => {
  if (!cuentasDisponibles.length) return null;
  if (preferredId) {
    const preferred = cuentasDisponibles.find((c) => String(c.id) === preferredId);
    if (preferred) return preferred;
  }
  const principalBs = cuentasDisponibles.find((c) => c.es_predeterminada && !isCuentaEnUsd(c));
  if (principalBs) return principalBs;
  const principalAny = cuentasDisponibles.find((c) => c.es_predeterminada);
  if (principalAny) return principalAny;
  const primeraBs = cuentasDisponibles.find((c) => !isCuentaEnUsd(c));
  if (primeraBs) return primeraBs;
  return cuentasDisponibles[0] || null;
};

const EstadoCuentaBancariaView: FC<EstadoCuentaBancariaViewProps> = ({ mode }) => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const { showAlert, showConfirm } = useDialog() as DialogContextType;
  const ownerCondominioId = propiedadActiva?.id_condominio;

  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [selectedCuenta, setSelectedCuenta] = useState<string>('');
  const [movimientos, setMovimientos] = useState<IMovimiento[]>([]);
  const [extrasInfo, setExtrasInfo] = useState<IExtraInfo[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuenta');
  const [ownerVista, setOwnerVista] = useState<'actual' | 'corte'>('actual');
  const [ownerCortes, setOwnerCortes] = useState<CorteFondo[]>([]);
  const [ownerPeriodos, setOwnerPeriodos] = useState<CortePeriodo[]>([]);
  const [ownerFiltroAnio, setOwnerFiltroAnio] = useState<string>('');
  const [ownerFiltroMes, setOwnerFiltroMes] = useState<string>('');
  const [ownerFondoSeleccionado, setOwnerFondoSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showTransfModal, setShowTransfModal] = useState<boolean>(false);
  const [showEgresoModal, setShowEgresoModal] = useState<boolean>(false);
  const [showIngresoModal, setShowIngresoModal] = useState<boolean>(false);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [movimientoDetalle, setMovimientoDetalle] = useState<IMovimiento | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tasaBcv, setTasaBcv] = useState<string>('');
  const [loadingBcv, setLoadingBcv] = useState<boolean>(false);
  const [rollbackingKey, setRollbackingKey] = useState<string>('');
  const [showAsignarInmuebleModal, setShowAsignarInmuebleModal] = useState<boolean>(false);
  const [movimientoPendienteAsignar, setMovimientoPendienteAsignar] = useState<IMovimiento | null>(null);
  const [propiedadesAdmin, setPropiedadesAdmin] = useState<PropiedadAdminOption[]>([]);
  const [loadingPropiedadesAdmin, setLoadingPropiedadesAdmin] = useState<boolean>(false);
  const [propiedadAsignacionId, setPropiedadAsignacionId] = useState<string>('');
  const [pagoPropiedadSeleccionada, setPagoPropiedadSeleccionada] = useState<{
    id: number;
    identificador: string;
    saldo_actual: string | number;
  } | null>(null);
  const [pagoMontoBsBloqueado, setPagoMontoBsBloqueado] = useState<number>(0);
  const [pagoTasaBloqueada, setPagoTasaBloqueada] = useState<number>(0);
  const [pagoReferenciaPrefill, setPagoReferenciaPrefill] = useState<string>('');
  const [pagoMovimientoFondoPendienteId, setPagoMovimientoFondoPendienteId] = useState<number | null>(null);
  const [tableFontBoost, setTableFontBoost] = useState<number>(0);
  const [movimientosTablaVisibles, setMovimientosTablaVisibles] = useState<IMovimiento[]>([]);
  const [viewportHeight, setViewportHeight] = useState<number>(() => (
    typeof window !== 'undefined' ? window.innerHeight : 900
  ));
  const itemsPerPage = 13;
  const tableFontSizePx = 14 + tableFontBoost;
  const tableMetaFontPx = 10 + tableFontBoost;
  const tableTagFontPx = 9 + tableFontBoost;
  const tableCompactFontPx = 12 + tableFontBoost;
  const topPanelHeight = Math.max(260, Math.round(viewportHeight * 0.4));

  useEffect(() => {
    const recalcViewportHeight = (): void => {
      setViewportHeight(window.innerHeight);
    };
    recalcViewportHeight();
    window.addEventListener('resize', recalcViewportHeight);
    return () => window.removeEventListener('resize', recalcViewportHeight);
  }, []);
  const fetchCuentas = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    const storageKey = getCuentaStorageKey(mode, ownerCondominioId);
    const cuentaPersistida = localStorage.getItem(storageKey) || '';
    try {
      if (mode === 'owner') {
        if (!ownerCondominioId) {
          setCuentas([]);
          setSelectedCuenta('');
          localStorage.removeItem(storageKey);
          return;
        }
        const res = await fetch(`${API_BASE_URL}/api/propietario/cuentas/${ownerCondominioId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data: BancosResponse = await res.json();
        const cuentasOwner = res.ok && data.status === 'success'
          ? (Array.isArray(data.data) ? data.data : data.data ? [data.data] : [])
          : [];
        if (cuentasOwner.length > 0) {
          setCuentas(cuentasOwner);
          const cuentaInicial = pickCuentaInicial(cuentasOwner, cuentaPersistida);
          if (cuentaInicial) {
            const cuentaId = String(cuentaInicial.id);
            setSelectedCuenta(cuentaId);
            localStorage.setItem(storageKey, cuentaId);
          }
        } else {
          setCuentas([]);
          setSelectedCuenta('');
          localStorage.removeItem(storageKey);
        }
        return;
      }

      const res = await fetch(`${API_BASE_URL}/bancos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: BancosResponse = await res.json();
      const bancos = data.status === 'success' ? (data.bancos || []) : [];
      setCuentas(bancos);
      if (bancos.length > 0) {
        const cuentaInicial = pickCuentaInicial(bancos, cuentaPersistida);
        if (cuentaInicial) {
          const cuentaId = String(cuentaInicial.id);
          setSelectedCuenta(cuentaId);
          localStorage.setItem(storageKey, cuentaId);
        }
      } else {
        setSelectedCuenta('');
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFondos = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      if (mode === 'owner') {
        if (!ownerCondominioId) {
          setFondos([]);
          return;
        }
        const res = await fetch(`${API_BASE_URL}/api/propietario/fondos/${ownerCondominioId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data: FondosResponse = await res.json();
        if (data.status === 'success') setFondos(data.data || []);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/fondos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: FondosResponse = await res.json();
      if (data.status === 'success') setFondos(data.fondos || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMovimientos = async (cuentaId: string): Promise<void> => {
    if (mode === 'admin' && !cuentaId) return;
    if (mode === 'owner' && !ownerCondominioId) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const endpoint = mode === 'admin'
        ? `${API_BASE_URL}/bancos-admin/${cuentaId}/estado-cuenta`
        : `${API_BASE_URL}/api/propietario/estado-cuenta/${ownerCondominioId}?cuenta_id=${encodeURIComponent(cuentaId)}`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: MovimientosResponse = await res.json();
      if (data.status !== 'success') {
        setMovimientos([]);
        return;
      }

      const rawMovimientos = Array.isArray(data.movimientos)
        ? data.movimientos
        : Array.isArray(data.data)
          ? data.data
          : [];

      const normalizados: IMovimiento[] = rawMovimientos.map((mov, index): IMovimiento => {
        const safeMov: Partial<IMovimiento> = mov ?? {};
        const tipoRaw = String(safeMov.tipo || '').toUpperCase();
        const notaRaw = String((safeMov as { nota?: unknown }).nota ?? '');
        const referenciaRaw = String(safeMov.referencia ?? (safeMov as { referencia_id?: unknown }).referencia_id ?? '').trim();
        const concepto = String(
          safeMov.concepto
          || (safeMov as { fondo_nombre?: string }).fondo_nombre
          || notaRaw
          || '-'
        );
        const esApertura = tipoRaw === 'APERTURA'
          || /saldo\s+de\s+apertura|apertura\s+del\s+fondo/i.test(`${concepto} ${notaRaw}`)
          || referenciaRaw.toUpperCase() === 'APERTURA';
        const esEgresoPorTipo = ['EGRESO', 'SALIDA', 'DEBITO', 'DESCUENTO', 'PAGO_PROVEEDOR', 'EGRESO_PAGO'].includes(tipoRaw);
        const esEgresoPorConcepto = /egreso manual libro mayor/i.test(concepto);
        const tipo: 'INGRESO' | 'EGRESO' = (esEgresoPorTipo || esEgresoPorConcepto) ? 'EGRESO' : 'INGRESO';
        const montoOrigenRaw = (safeMov as { monto_origen_pago?: unknown }).monto_origen_pago;
        const montoOrigenPago = (montoOrigenRaw === null || montoOrigenRaw === undefined || montoOrigenRaw === '')
          ? null
          : toNumber(String(montoOrigenRaw));

        const montoRaw = (safeMov as { monto?: unknown }).monto;
        const montoBs = toNumber((safeMov as { monto_bs?: unknown }).monto_bs ?? montoRaw ?? 0);
        const montoUsd = toNumber((safeMov as { monto_usd?: unknown }).monto_usd ?? montoRaw ?? 0);
        const tasaCambio = toNumber((safeMov as { tasa_cambio?: unknown }).tasa_cambio ?? 0);

        const fechaPago = String((safeMov as { fecha_pago?: unknown }).fecha_pago ?? safeMov.fecha ?? '');
        const fechaRegistro = String(
          (safeMov as { fecha_registro?: unknown }).fecha_registro
          ?? (safeMov as { created_at?: unknown }).created_at
          ?? ''
        );

        return {
          id: safeMov.id ?? `mov-${index}`,
          fecha: fechaPago,
          referencia: referenciaRaw || (esApertura ? 'APERTURA' : ''),
          concepto,
          tipo,
          monto_bs: montoBs,
          tasa_cambio: tasaCambio,
          monto_usd: montoUsd,
          ...(montoOrigenPago !== null ? { monto_origen_pago: montoOrigenPago } : {}),
          banco_origen: safeMov.banco_origen
            ? String(safeMov.banco_origen)
            : (safeMov as { banco_nombre?: unknown }).banco_nombre
              ? String((safeMov as { banco_nombre?: unknown }).banco_nombre)
              : '',
          cedula_origen: safeMov.cedula_origen ? String(safeMov.cedula_origen) : '',
          fondo_id: toNullableInt((safeMov as { fondo_id?: unknown }).fondo_id),
          fondo_origen_id: toNullableInt((safeMov as { fondo_origen_id?: unknown }).fondo_origen_id),
          fondo_destino_id: toNullableInt((safeMov as { fondo_destino_id?: unknown }).fondo_destino_id),
          fondo_nombre: (safeMov as { fondo_nombre?: unknown }).fondo_nombre
            ? String((safeMov as { fondo_nombre?: unknown }).fondo_nombre)
            : '',
          inmueble: (safeMov as { inmueble?: unknown }).inmueble
            ? String((safeMov as { inmueble?: unknown }).inmueble)
            : '',
          pago_id: toNullableInt((safeMov as { pago_id?: unknown }).pago_id),
          pendiente_inmueble_manual: toBoolean((safeMov as { pendiente_inmueble_manual?: unknown }).pendiente_inmueble_manual),
          fecha_registro: fechaRegistro,
          tipo_raw: tipoRaw,
          es_apertura: esApertura,
          ...(safeMov.saldo_acumulado !== undefined ? { saldo_acumulado: safeMov.saldo_acumulado } : {})
        };
      });

      setMovimientos(normalizados);
    } catch (error) {
      console.error(error);
      setMovimientos([]);
    }
  };

  const fetchExtrasInfo = async (cuentaId: string): Promise<void> => {
    if (mode !== 'admin' || !cuentaId) {
      setExtrasInfo([]);
      return;
    }
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/bancos-admin/${cuentaId}/extras-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: ExtrasInfoResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setExtrasInfo([]);
        return;
      }
      setExtrasInfo(Array.isArray(data.extras) ? data.extras : []);
    } catch {
      setExtrasInfo([]);
    }
  };

  const fetchCortesOwner = async (cuentaId: string, anio: string, mes: string): Promise<void> => {
    if (mode !== 'owner' || !ownerCondominioId) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const query = new URLSearchParams();
      if (cuentaId) query.set('cuenta_id', cuentaId);
      if (anio) query.set('anio', anio);
      if (mes) query.set('mes', mes);

      const res = await fetch(`${API_BASE_URL}/api/propietario/estado-cuenta-cortes/${ownerCondominioId}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: CortesResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setOwnerCortes([]);
        setOwnerPeriodos([]);
        return;
      }
      const cortes = Array.isArray(data.data?.cortes) ? data.data?.cortes : [];
      const periodos = Array.isArray(data.data?.periodos) ? data.data?.periodos : [];
      setOwnerCortes(cortes || []);
      setOwnerPeriodos(periodos || []);
    } catch {
      setOwnerCortes([]);
      setOwnerPeriodos([]);
    }
  };

  const fetchBCV = async (): Promise<void> => {
    setLoadingBcv(true);
    try {
      const rateNumber = await getCurrentBcvRate();
      if (!Number.isFinite(rateNumber) || (rateNumber ?? 0) <= 0) throw new Error('No se pudo consultar BCV');
      setTasaBcv(Number(rateNumber).toFixed(4));
    } catch {
      await showAlert({
        title: 'Error BCV',
        message: 'No se pudo obtener la tasa BCV en este momento.',
        confirmText: 'Entendido',
        variant: 'warning',
      });
    } finally {
      setLoadingBcv(false);
    }
  };

  const refreshCuentaData = async (cuentaId: string): Promise<void> => {
    if (mode === 'admin' && !cuentaId) {
      setLoading(false);
      return;
    }
    if (mode === 'owner' && (!ownerCondominioId || !cuentaId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        fetchMovimientos(cuentaId),
        fetchFondos(),
        fetchExtrasInfo(cuentaId),
        mode === 'owner'
          ? fetchCortesOwner(cuentaId, ownerFiltroAnio, ownerFiltroMes)
          : Promise.resolve(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((mode === 'admin' && userRole === 'Administrador') || (mode === 'owner' && userRole === 'Propietario')) {
      fetchCuentas();
    }
  }, [mode, userRole, ownerCondominioId]);

  useEffect(() => {
    void refreshCuentaData(selectedCuenta);
  }, [selectedCuenta, mode, ownerCondominioId]);

  useEffect(() => {
    if (mode !== 'owner') return;
    void fetchCortesOwner(selectedCuenta, ownerFiltroAnio, ownerFiltroMes);
  }, [mode, selectedCuenta, ownerCondominioId, ownerFiltroAnio, ownerFiltroMes]);

  useEffect(() => {
    setActiveTab('cuenta');
  }, [selectedCuenta, mode]);

  useEffect(() => {
    if (!selectedCuenta) return;
    const storageKey = getCuentaStorageKey(mode, ownerCondominioId);
    localStorage.setItem(storageKey, selectedCuenta);
  }, [selectedCuenta, mode, ownerCondominioId]);

  useEffect(() => {
    if (mode !== 'owner') return;
    if (ownerPeriodos.length === 0) {
      setOwnerFiltroAnio('');
      setOwnerFiltroMes('');
      return;
    }
    if (ownerFiltroAnio && ownerFiltroMes) return;
    const first = ownerPeriodos[0];
    if (!first) return;
    setOwnerFiltroAnio(String(first.anio));
    setOwnerFiltroMes(String(first.mes).padStart(2, '0'));
  }, [mode, ownerPeriodos, ownerFiltroAnio, ownerFiltroMes]);

  const fondosCuenta = useMemo(
    () => fondos.filter((f) => String(f.cuenta_bancaria_id) === selectedCuenta),
    [fondos, selectedCuenta]
  );
  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => String(c.id) === selectedCuenta) || null,
    [cuentas, selectedCuenta],
  );
  const cuentaSeleccionadaEsUsd = useMemo(
    () => (cuentaSeleccionada ? isCuentaEnUsd(cuentaSeleccionada) : false),
    [cuentaSeleccionada],
  );

  useEffect(() => {
    if (mode !== 'owner') return;
    if (!fondosCuenta.length) {
      setOwnerFondoSeleccionado('');
      return;
    }
    if (!ownerFondoSeleccionado) {
      setOwnerFondoSeleccionado('ALL');
      return;
    }
    if (ownerFondoSeleccionado === 'ALL') return;
    const exists = fondosCuenta.some((f) => String(f.id) === ownerFondoSeleccionado);
    if (!exists) {
      setOwnerFondoSeleccionado('ALL');
    }
  }, [mode, fondosCuenta, ownerFondoSeleccionado]);

  const tasaBcvNum = toNumber(tasaBcv);

  const movimientosFiltrados = useMemo(
    () =>
      movimientos.filter((movimiento) => {
        if (!fechaDesde && !fechaHasta) return true;
        const fechaMov = new Date(movimiento.fecha);
        const desde = parseFilterDate(fechaDesde);
        const hasta = parseFilterDate(fechaHasta);
        if (desde && fechaMov < desde) return false;
        if (hasta) {
          const hastaFin = new Date(hasta);
          hastaFin.setHours(23, 59, 59, 999);
          if (fechaMov > hastaFin) return false;
        }
        return true;
      }),
    [movimientos, fechaDesde, fechaHasta]
  );

  // Importante: los saldos/aperturas se muestran exclusivamente desde movimientos reales de BD.
  // No se sintetizan aperturas en frontend.
  const movimientosConApertura = useMemo(() => [...movimientosFiltrados], [movimientosFiltrados]);

  const movimientosCuentaConsolidados = useMemo(() => {
    const movimientosDirectos: IMovimiento[] = [];
    const ingresosPorPago = new Map<string, IMovimiento[]>();
    const ingresosPorAjuste = new Map<string, IMovimiento[]>();
    const isHistReclasifInterna = (mov: IMovimiento): boolean => {
      const rawId = String(mov.id || '').toUpperCase();
      const concepto = String(mov.concepto || '').toUpperCase();
      return (
        /^EGR-MF-\d+$/i.test(rawId)
        && (
          concepto.includes('[SYS_HIST_RECLASIF_INTERNA]')
          || concepto.includes('RECLASIFICACIÓN/RECAUDADO HISTÓRICO')
          || concepto.includes('RECLASIFICACION/RECAUDADO HISTORICO')
        )
      );
    };
    const getInmuebleTexto = (mov: IMovimiento): string => {
      const inmuebleApi = String(mov.inmueble || '').trim();
      if (inmuebleApi) return inmuebleApi;
      const concepto = String(mov.concepto || '');
      const matchConcepto = concepto.match(/Inmueble:\s*([^|]+)/i);
      if (matchConcepto?.[1]) return matchConcepto[1].trim();
      const matchNota = concepto.match(/Inmueble\s*[:\-]\s*([A-Za-z0-9\-_.\/ ]+)/i);
      if (matchNota?.[1]) return matchNota[1].trim();
      return '';
    };
    const getClaveReferenciaInmuebleFecha = (mov: IMovimiento): string => {
      const referencia = String(mov.referencia || '').trim();
      const inmueble = getInmuebleTexto(mov).trim();
      const fechaDia = String(mov.fecha || '').slice(0, 10);
      if (!referencia || !inmueble || !fechaDia) return '';
      return `${fechaDia}|${referencia.toUpperCase()}|${inmueble.toUpperCase()}`;
    };
    const pagoKeyByRefInmFecha = new Map<string, string>();
    const getFechaRegistroGrupo = (grupo: IMovimiento[]): string => {
      const candidatas = grupo
        .map((item) => String(item.fecha_registro ?? '').trim())
        .filter(Boolean);
      if (candidatas.length === 0) return '';
      return candidatas.sort((a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0))[0] || '';
    };

    movimientosConApertura.forEach((mov) => {
      const rawId = String(mov.id || '');
      const esIngresoEnFondo = mov.tipo === 'INGRESO'
        && /^ING-MF-\d+$/i.test(rawId)
        && toNullableInt((mov as { fondo_id?: unknown }).fondo_id) !== null;
      if (!esIngresoEnFondo) return;
      if (!(mov.pago_id && Number.isFinite(mov.pago_id))) return;
      const pagoClave = String(mov.pago_id);
      const claveRefInmFecha = getClaveReferenciaInmuebleFecha(mov);
      if (claveRefInmFecha) {
        pagoKeyByRefInmFecha.set(claveRefInmFecha, `pago-${pagoClave}`);
      }
    });

    movimientosConApertura.forEach((mov) => {
      if (isHistReclasifInterna(mov)) {
        // Se muestra en pestañas de fondo / tránsito, pero no como egreso bancario consolidado.
        return;
      }
      const pagoId = mov.pago_id ? String(mov.pago_id) : '';
      const concepto = String(mov.concepto || '');
      const rawId = String(mov.id || '');
      const referencia = String(mov.referencia || '').trim();
      const esIngresoEnFondo = mov.tipo === 'INGRESO'
        && /^ING-MF-\d+$/i.test(rawId)
        && toNullableInt((mov as { fondo_id?: unknown }).fondo_id) !== null;
      const esAjusteReferenciado = /^AJ-/i.test(referencia);
      const pagoMatchLegacy = concepto.match(/Pago de Recibo #(\d+)/i);
      const pagoMatchRef = concepto.match(/Pago Ref:\s*([^\s|]+)/i);
      const pagoClaveDirecta = pagoId || (pagoMatchLegacy?.[1] || '') || (pagoMatchRef?.[1] || '');
      const claveRefInmFecha = getClaveReferenciaInmuebleFecha(mov);
      const pagoKeyAsociada = claveRefInmFecha ? pagoKeyByRefInmFecha.get(claveRefInmFecha) : '';
      const pagoClave = pagoClaveDirecta || (pagoKeyAsociada ? pagoKeyAsociada.replace(/^pago-/, '') : '');

      if (esIngresoEnFondo && !esAjusteReferenciado && pagoClave) {
        const groupKey = `pago-${pagoClave}`;
        const grupo = ingresosPorPago.get(groupKey) || [];
        grupo.push(mov);
        ingresosPorPago.set(groupKey, grupo);
        return;
      }

      const esAjusteDistribuido = mov.tipo === 'INGRESO'
        && /^ING-MF-\d+$/i.test(rawId)
        && !mov.pago_id
        && /^AJ-/i.test(referencia);
      if (esAjusteDistribuido) {
        const groupKey = `ajuste-${referencia.toUpperCase()}`;
        const grupo = ingresosPorAjuste.get(groupKey) || [];
        grupo.push(mov);
        ingresosPorAjuste.set(groupKey, grupo);
        return;
      }

      movimientosDirectos.push(mov);
    });

    const ingresosConsolidados: IMovimiento[] = Array.from(ingresosPorPago.entries()).map(([groupKey, grupo]) => {
      const base = grupo[0];
      const conceptoLimpio = String(base?.concepto || '').replace(/\s*-\s*Fondo:\s*.+$/i, '').trim();
      const montoUsdTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_usd), 0);
      const montoBsTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_bs), 0);
      const montoOrigenPago = toNumber(base?.monto_origen_pago);
      const montoBsConsolidado = !cuentaSeleccionadaEsUsd && montoOrigenPago > 0
        ? montoOrigenPago
        : Number(montoBsTotal.toFixed(2));
      const referencias = Array.from(new Set(grupo.map((item) => String(item.referencia || '').trim()).filter(Boolean)));
      const tasa = toNumber(base?.tasa_cambio);
      const pagoId = base?.pago_id ?? null;
      const fallbackKey = groupKey.replace(/^pago-/, '');
      const fechaRegistro = getFechaRegistroGrupo(grupo);

      return {
        id: `ING-CONS-${fallbackKey}`,
        fecha: String(base?.fecha ?? ''),
        fecha_registro: fechaRegistro,
        referencia: referencias[0] || (base?.referencia || ''),
        concepto: conceptoLimpio || `Pago Ref: ${fallbackKey}`,
        tipo: 'INGRESO',
        monto_usd: Number(montoUsdTotal.toFixed(2)),
        // En cuenta bancaria Bs se refleja el monto bruto pagado en origen.
        // Esto evita ocultar el componente desviado a Extra en la vista de cuenta.
        monto_bs: Number(montoBsConsolidado.toFixed(2)),
        tasa_cambio: tasa > 0 ? tasa : 0,
        banco_origen: String(base?.banco_origen ?? ''),
        cedula_origen: String(base?.cedula_origen ?? ''),
        ...(toNumber(base?.monto_origen_pago) > 0 ? { monto_origen_pago: toNumber(base?.monto_origen_pago) } : {}),
        fondo_id: null,
        fondo_origen_id: null,
        fondo_destino_id: null,
        fondo_nombre: '',
        pago_id: pagoId
      };
    });

    const ajustesConsolidados: IMovimiento[] = Array.from(ingresosPorAjuste.entries()).map(([groupKey, grupo]) => {
      const base = grupo[0];
      const referencia = groupKey.replace(/^ajuste-/, '');
      const conceptoLimpio = String(base?.concepto || '').replace(/\s*-\s*Fondo:\s*.+$/i, '').trim();
      const montoUsdTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_usd), 0);
      const montoBsTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_bs), 0);
      const tasa = toNumber(base?.tasa_cambio);
      const fechaRegistro = getFechaRegistroGrupo(grupo);

      return {
        id: `AJ-CONS-${referencia}`,
        fecha: String(base?.fecha ?? ''),
        fecha_registro: fechaRegistro,
        referencia,
        concepto: conceptoLimpio || 'Ajuste de saldo',
        tipo: 'INGRESO',
        monto_usd: Number(montoUsdTotal.toFixed(2)),
        monto_bs: Number(montoBsTotal.toFixed(2)),
        tasa_cambio: tasa > 0 ? tasa : 0,
        banco_origen: String(base?.banco_origen ?? ''),
        cedula_origen: String(base?.cedula_origen ?? ''),
        fondo_id: null,
        fondo_origen_id: null,
        fondo_destino_id: null,
        fondo_nombre: '',
        pago_id: null,
        inmueble: String(base?.inmueble ?? ''),
      };
    });

    const getExecutionOrder = (mov: IMovimiento): number => {
      if (mov.pago_id && Number.isFinite(mov.pago_id)) return Number(mov.pago_id);
      const refAjuste = String(mov.referencia || '').match(/^AJ-(\d+)$/i);
      if (refAjuste?.[1]) return Number(refAjuste[1]);
      const raw = String(mov.id || '');
      const matchId = raw.match(/(\d+)/);
      return matchId?.[1] ? Number(matchId[1]) : 0;
    };

    const movimientosDirectosCuenta = movimientosDirectos.filter((mov) => {
      const hasFondoId = toNullableInt((mov as { fondo_id?: unknown }).fondo_id) !== null;
      const hasFondoOrigen = toNullableInt((mov as { fondo_origen_id?: unknown }).fondo_origen_id) !== null;
      const hasFondoDestino = toNullableInt((mov as { fondo_destino_id?: unknown }).fondo_destino_id) !== null;
      return hasFondoId || hasFondoOrigen || hasFondoDestino;
    });

    return [...movimientosDirectosCuenta, ...ingresosConsolidados, ...ajustesConsolidados].sort((a, b) => {
      const ordenA = getExecutionOrder(a);
      const ordenB = getExecutionOrder(b);
      if (ordenA !== ordenB) return ordenB - ordenA;
      const fechaA = new Date(a.fecha || '').getTime();
      const fechaB = new Date(b.fecha || '').getTime();
      if (fechaA !== fechaB) return fechaB - fechaA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [movimientosConApertura, cuentaSeleccionadaEsUsd]);

  const movimientosBasePorVista = useMemo(() => {
    if (activeTab === 'cuenta') return movimientosCuentaConsolidados;
    if (activeTab === 'sin-fondo') {
      const candidatos = movimientosConApertura.filter((movimiento) => {
        const hasFondoId = toNullableInt((movimiento as { fondo_id?: unknown }).fondo_id) !== null;
        const hasFondoOrigen = toNullableInt((movimiento as { fondo_origen_id?: unknown }).fondo_origen_id) !== null;
        const hasFondoDestino = toNullableInt((movimiento as { fondo_destino_id?: unknown }).fondo_destino_id) !== null;
        const rawId = String((movimiento as { id?: unknown }).id || '');
        const esAjusteManualConFondo = /^ING-MF-\d+$/i.test(rawId)
          && !Number.isFinite((movimiento as { pago_id?: unknown }).pago_id as number)
          && !Boolean((movimiento as { es_apertura?: unknown }).es_apertura);
        return (!hasFondoId && !hasFondoOrigen && !hasFondoDestino) || esAjusteManualConFondo;
      });

      const getInmuebleTexto = (mov: IMovimiento): string => {
        const inmuebleApi = String(mov.inmueble || '').trim();
        if (inmuebleApi) return inmuebleApi;
        const concepto = String(mov.concepto || '');
        const matchConcepto = concepto.match(/Inmueble:\s*([^|]+)/i);
        if (matchConcepto?.[1]) return matchConcepto[1].trim();
        const matchNota = concepto.match(/Inmueble\s*[:\-]\s*([A-Za-z0-9\-_.\/ ]+)/i);
        if (matchNota?.[1]) return matchNota[1].trim();
        return '-';
      };

      const grupos = new Map<string, IMovimiento[]>();
      const sueltos: IMovimiento[] = [];

      candidatos.forEach((mov) => {
        if (mov.tipo !== 'INGRESO' || Boolean(mov.es_apertura)) {
          sueltos.push(mov);
          return;
        }
        const referencia = String(mov.referencia || '').trim();
        const fechaDia = String(mov.fecha || '').slice(0, 10);
        const inmueble = getInmuebleTexto(mov);
        if (!referencia || !fechaDia || !inmueble || inmueble === '-') {
          sueltos.push(mov);
          return;
        }
        const key = `${fechaDia}|${referencia.toUpperCase()}|${inmueble.toUpperCase()}`;
        const lista = grupos.get(key) || [];
        lista.push(mov);
        grupos.set(key, lista);
      });

      const consolidados: IMovimiento[] = [];
      grupos.forEach((grupo, key) => {
        if (grupo.length <= 1) {
          const item = grupo[0];
          if (item) consolidados.push(item);
          return;
        }

        const basePago = grupo.find((g) => Number.isFinite(g.pago_id as number)) ?? grupo[0];
        if (!basePago) return;

        const pagoId = basePago.pago_id ?? null;
        const montoUsdTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_usd), 0);
        const montoBsTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_bs), 0);
        const fechaRegistro = grupo
          .map((item) => String(item.fecha_registro || '').trim())
          .filter(Boolean)
          .sort((a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0))[0] || '';
        const conceptoPago = grupo.find((g) => /pago\s+ref|pago\s+de\s+recibo/i.test(String(g.concepto || '')))?.concepto;

        consolidados.push({
          ...basePago,
          id: Number.isFinite(pagoId as number) ? `ING-CONS-${String(pagoId)}` : `ING-CONS-REF-${key}`,
          fecha_registro: fechaRegistro,
          concepto: String(conceptoPago || basePago.concepto || 'Ingreso consolidado'),
          monto_usd: Number(montoUsdTotal.toFixed(2)),
          monto_bs: Number(montoBsTotal.toFixed(2)),
          fondo_id: null,
          fondo_origen_id: null,
          fondo_destino_id: null,
          fondo_nombre: '',
          pago_id: Number.isFinite(pagoId as number) ? Number(pagoId) : null,
          inmueble: getInmuebleTexto(basePago),
        });
      });

      return [...sueltos, ...consolidados].sort((a, b) => {
        const fechaA = new Date(a.fecha || '').getTime();
        const fechaB = new Date(b.fecha || '').getTime();
        if (fechaA !== fechaB) return fechaB - fechaA;
        return String(b.id).localeCompare(String(a.id));
      });
    }

    const fondoId = parseInt(activeTab.replace('fondo-', ''), 10);
    if (!Number.isFinite(fondoId)) return [];
    const fondoActivo = fondosCuenta.find((f) => parseInt(String(f.id), 10) === fondoId);
    const fondoNombreNorm = String(fondoActivo?.nombre || '').trim().toLowerCase();
    return movimientosConApertura.filter((movimiento) => {
      const movFondo = toNullableInt((movimiento as { fondo_id?: unknown }).fondo_id);
      const movOrigen = toNullableInt((movimiento as { fondo_origen_id?: unknown }).fondo_origen_id);
      const movDestino = toNullableInt((movimiento as { fondo_destino_id?: unknown }).fondo_destino_id);
      if (movFondo === fondoId || movOrigen === fondoId || movDestino === fondoId) return true;
      const movFondoNombre = String((movimiento as { fondo_nombre?: unknown }).fondo_nombre || '').trim().toLowerCase();
      return Boolean(fondoNombreNorm) && Boolean(movFondoNombre) && movFondoNombre === fondoNombreNorm;
    });
  }, [movimientosConApertura, activeTab, fondosCuenta, movimientosCuentaConsolidados]);

  const movimientosPorVista = useMemo(() => {
    const txt = searchTerm.trim().toLowerCase();
    if (!txt) return movimientosBasePorVista;
    const getInmuebleTexto = (mov: IMovimiento): string => {
      const inmuebleApi = String(mov.inmueble || '').trim();
      if (inmuebleApi) return inmuebleApi;
      const concepto = String(mov.concepto || '');
      const matchConcepto = concepto.match(/Inmueble:\s*([^|]+)/i);
      if (matchConcepto?.[1]) return matchConcepto[1].trim();
      const matchNota = concepto.match(/Inmueble\s*[:\-]\s*([A-Za-z0-9\-_.\/ ]+)/i);
      if (matchNota?.[1]) return matchNota[1].trim();
      return '-';
    };
    return movimientosBasePorVista.filter((mov) => {
      const concepto = String(mov.concepto || '').toLowerCase();
      const inmueble = getInmuebleTexto(mov).toLowerCase();
      const referencia = String(mov.referencia || '').toLowerCase();
      const montoUsd = toNumber(mov.monto_usd);
      const montoBs = toNumber(mov.monto_bs);
      const montoRaw = `${montoUsd.toFixed(2)} ${montoBs.toFixed(2)}`.toLowerCase();
      const montoFmt = `${formatCurrency(montoUsd)} ${formatCurrency(montoBs)}`.toLowerCase();
      return concepto.includes(txt) || inmueble.includes(txt) || referencia.includes(txt) || montoRaw.includes(txt) || montoFmt.includes(txt);
    });
  }, [movimientosBasePorVista, searchTerm]);

  const extrasInfoPorVista = useMemo(() => {
    const txt = searchTerm.trim().toLowerCase();
    if (!txt) return extrasInfo;
    return extrasInfo.filter((row) => {
      const fecha = formatFecha(row.fecha).toLowerCase();
      const referencia = String(row.referencia || '').toLowerCase();
      const inmueble = String(row.inmueble || '').toLowerCase();
      const concepto = String(row.concepto || '').toLowerCase();
      const fondoDestino = String(row.fondo_destino || 'Fondo principal').toLowerCase();
      const montoBs = toNumber(row.monto_bs);
      const montoUsd = toNumber(row.monto_usd);
      const montoRaw = `${montoBs.toFixed(2)} ${montoUsd.toFixed(2)}`.toLowerCase();
      const montoFmt = `${formatCurrency(montoBs)} ${formatCurrency(montoUsd)}`.toLowerCase();
      return (
        fecha.includes(txt)
        || referencia.includes(txt)
        || inmueble.includes(txt)
        || concepto.includes(txt)
        || fondoDestino.includes(txt)
        || montoRaw.includes(txt)
        || montoFmt.includes(txt)
      );
    });
  }, [extrasInfo, searchTerm]);

  const isAperturaMovimiento = (movimiento: IMovimiento): boolean => {
    if (Boolean(movimiento.es_apertura) || Boolean(movimiento.apertura_sintetica)) return true;
    const referencia = String(movimiento.referencia || '').trim().toUpperCase();
    if (referencia === 'APERTURA') return true;
    const concepto = String(movimiento.concepto || '').toLowerCase();
    return /saldo\s+de\s+apertura|apertura\s+del\s+fondo|apertura/.test(concepto);
  };

  const movimientosPorVistaConAperturaAlFinal = useMemo(() => {
    const normales: IMovimiento[] = [];
    const aperturas: IMovimiento[] = [];
    movimientosPorVista.forEach((mov) => {
      if (isAperturaMovimiento(mov)) aperturas.push(mov);
      else normales.push(mov);
    });
    return [...normales, ...aperturas];
  }, [movimientosPorVista]);

  const movimientosPagina = useMemo(
    () => movimientosPorVista.slice(0, itemsPerPage),
    [movimientosPorVista, itemsPerPage],
  );
  const cuentaActual = cuentas.find((c) => String(c.id) === selectedCuenta);
  const isCuentaUsd = String(cuentaActual?.moneda || '').toUpperCase() === 'USD';

  const resumenFondos = useMemo(
    () => fondosCuenta.map((fondo) => {
      const moneda = String(fondo.moneda || '').toUpperCase();
      const fondoId = toNullableInt(fondo.id);
      const fondoNombreNorm = String(fondo.nombre || '').trim().toLowerCase();

      const movimientosFondo = movimientosConApertura.filter((mov) => {
        const movFondo = toNullableInt((mov as { fondo_id?: unknown }).fondo_id);
        const movOrigen = toNullableInt((mov as { fondo_origen_id?: unknown }).fondo_origen_id);
        const movDestino = toNullableInt((mov as { fondo_destino_id?: unknown }).fondo_destino_id);
        if (fondoId !== null && (movFondo === fondoId || movOrigen === fondoId || movDestino === fondoId)) return true;
        const movFondoNombre = String((mov as { fondo_nombre?: unknown }).fondo_nombre || '').trim().toLowerCase();
        return Boolean(fondoNombreNorm) && Boolean(movFondoNombre) && movFondoNombre === fondoNombreNorm;
      });

      const ingresoUsd = movimientosFondo.reduce((acc, mov) => (
        mov.tipo === 'INGRESO' ? acc + toNumber(mov.monto_usd) : acc
      ), 0);
      const egresoUsd = movimientosFondo.reduce((acc, mov) => (
        mov.tipo === 'EGRESO' ? acc + toNumber(mov.monto_usd) : acc
      ), 0);
      const netoUsd = ingresoUsd - egresoUsd;

      const ingresoBs = movimientosFondo.reduce((acc, mov) => (
        mov.tipo === 'INGRESO' ? acc + toNumber(mov.monto_bs) : acc
      ), 0);
      const egresoBs = movimientosFondo.reduce((acc, mov) => (
        mov.tipo === 'EGRESO' ? acc + toNumber(mov.monto_bs) : acc
      ), 0);
      const netoBs = ingresoBs - egresoBs;

      // Si ya hay movimientos del fondo en la vista actual, usamos ese neto para
      // mantener 1:1 con tabla/Excel. Solo hacemos fallback al saldo del fondo
      // cuando no existen movimientos visibles para ese fondo.
      const saldoActualFondo = toNumber((fondo as { saldo_actual?: unknown }).saldo_actual ?? 0);
      const saldoCalculado = moneda === 'USD' ? netoUsd : netoBs;
      const saldo = movimientosFondo.length > 0 ? saldoCalculado : saldoActualFondo;
      const equivalenteUsd = moneda === 'USD'
        ? saldo
        : (tasaBcvNum > 0 ? (saldo / tasaBcvNum) : 0);

      return {
        id: String(fondo.id),
        nombre: fondo.nombre || `Fondo ${fondo.id}`,
        moneda,
        saldo,
        equivalenteUsd,
      };
    }),
    [fondosCuenta, movimientosConApertura, tasaBcvNum]
  );

  const saldoCuentaBsActual = useMemo(
    () => {
      // For BS accounts: derive balance from the consolidated movement list
      // (same source as Excel export). This correctly includes undistributed transit
      // amounts via monto_origen_pago in ingresosConsolidados, matching the real
      // bank balance. For USD accounts there are no BS funds so fall through to 0.
      if (!isCuentaUsd && movimientosCuentaConsolidados.length > 0) {
        const total = movimientosCuentaConsolidados.reduce((acc, mov) => {
          const montoBs = getMontoBsVista(mov);
          if (mov.tipo === 'INGRESO') return acc + Math.abs(montoBs);
          if (mov.tipo === 'EGRESO') return acc - Math.abs(montoBs);
          return acc;
        }, 0);
        return round2(total);
      }
      const saldoFondosBs = resumenFondos.reduce((acc, fondo) => (
        fondo.moneda === 'BS' ? acc + toNumber(fondo.saldo) : acc
      ), 0);
      return round2(saldoFondosBs);
    },
    [movimientosCuentaConsolidados, resumenFondos, isCuentaUsd]
  );

  const saldoCuentaUsdActual = useMemo(
    () => {
      const saldoFondosUsd = resumenFondos.reduce((acc, fondo) => {
        const saldo = toNumber(fondo.saldo);
        if (fondo.moneda === 'USD') return acc + saldo;
        if (fondo.moneda === 'BS' && tasaBcvNum > 0) return acc + (saldo / tasaBcvNum);
        return acc;
      }, 0);
      return round2(saldoFondosUsd);
    },
    [resumenFondos, tasaBcvNum]
  );

  const saldoFondosBsActual = useMemo(
    () => round2(resumenFondos.reduce((acc, fondo) => (
      fondo.moneda === 'BS' ? acc + toNumber(fondo.saldo) : acc
    ), 0)),
    [resumenFondos],
  );

  const saldoTransitoExtraBsActual = useMemo(
    () => {
      if (isCuentaUsd) return 0;
      return round2(saldoCuentaBsActual - saldoFondosBsActual);
    },
    [isCuentaUsd, saldoCuentaBsActual, saldoFondosBsActual],
  );

  const saldoTransitoExtraUsdActual = useMemo(
    () => {
      if (tasaBcvNum <= 0) return 0;
      return round2(saldoTransitoExtraBsActual / tasaBcvNum);
    },
    [saldoTransitoExtraBsActual, tasaBcvNum],
  );

  const ownerResumenActual = useMemo(
    () => resumenFondos.filter((fondo) => String(fondo.id) !== ''),
    [resumenFondos],
  );

  const ownerCortesFiltrados = useMemo(
    () =>
      ownerCortes.filter((corte) => {
        if (selectedCuenta && String(corte.cuenta_bancaria_id || '') !== selectedCuenta) return false;
        return true;
      }),
    [ownerCortes, selectedCuenta],
  );

  const ownerCorteTotales = useMemo(
    () =>
      ownerCortesFiltrados.reduce(
        (acc, row) => {
          acc.bs += toNumber(row.saldo_bs);
          acc.usd += toNumber(row.saldo_usd);
          return acc;
        },
        { bs: 0, usd: 0 },
      ),
    [ownerCortesFiltrados],
  );

  const totalIngresosUsd = useMemo(
    () => movimientosPorVista.reduce((acc, mov) => (mov.tipo === 'INGRESO' ? acc + toNumber(mov.monto_usd) : acc), 0),
    [movimientosPorVista],
  );

  const totalEgresosUsd = useMemo(
    () => movimientosPorVista.reduce((acc, mov) => (mov.tipo === 'EGRESO' ? acc + toNumber(mov.monto_usd) : acc), 0),
    [movimientosPorVista],
  );

  const totalIngresosBs = useMemo(
    () => movimientosPorVista.reduce((acc, mov) => (mov.tipo === 'INGRESO' ? acc + getMontoBsVista(mov) : acc), 0),
    [movimientosPorVista],
  );

  const totalEgresosBs = useMemo(
    () => movimientosPorVista.reduce((acc, mov) => (mov.tipo === 'EGRESO' ? acc + getMontoBsVista(mov) : acc), 0),
    [movimientosPorVista],
  );

  const fondosDestacados = useMemo(
    () => resumenFondos,
    [resumenFondos],
  );

  const fondosDestacadosBs = useMemo(
    () => fondosDestacados.filter((fondo) => String(fondo.moneda || '').toUpperCase() !== 'USD'),
    [fondosDestacados],
  );

  const fondosDestacadosUsd = useMemo(
    () => fondosDestacados.filter((fondo) => String(fondo.moneda || '').toUpperCase() === 'USD'),
    [fondosDestacados],
  );

  const ownerEgresosFondo = useMemo(() => {
    if (!ownerFondoSeleccionado) return [] as IMovimiento[];
    if (ownerFondoSeleccionado === 'ALL') {
      return movimientosFiltrados.filter((mov) => mov.tipo === 'EGRESO');
    }
    const fondoId = parseInt(ownerFondoSeleccionado, 10);
    const fondoSeleccionado = fondosCuenta.find((f) => String(f.id) === ownerFondoSeleccionado);
    const fondoNombreNorm = String(fondoSeleccionado?.nombre || '').trim().toLowerCase();

    return movimientosFiltrados.filter((mov) => {
      if (mov.tipo !== 'EGRESO') return false;
      const movFondo = toNullableInt((mov as { fondo_id?: unknown }).fondo_id);
      if (Number.isFinite(fondoId) && movFondo === fondoId) return true;
      const movFondoNombre = String((mov as { fondo_nombre?: unknown }).fondo_nombre || '').trim().toLowerCase();
      return Boolean(fondoNombreNorm) && Boolean(movFondoNombre) && movFondoNombre === fondoNombreNorm;
    });
  }, [ownerFondoSeleccionado, fondosCuenta, movimientosFiltrados]);

  function getMontoBsVista(movimiento: IMovimiento): number {
    const montoBs = toNumber(movimiento.monto_bs);
    if (montoBs > 0) return montoBs;
    const tasa = toNumber(movimiento.tasa_cambio);
    const montoUsd = toNumber(movimiento.monto_usd);
    if (tasa > 0 && montoUsd > 0) return montoUsd * tasa;
    return 0;
  }

  function getMontoUsdVista(movimiento: IMovimiento): number {
    const montoBs = toNumber(movimiento.monto_bs);
    const tasaMovimiento = toNumber(movimiento.tasa_cambio);
    if (montoBs > 0 && tasaMovimiento > 0) return round2(montoBs / tasaMovimiento);
    if (montoBs > 0 && tasaBcvNum > 0) return round2(montoBs / tasaBcvNum);
    const montoUsd = toNumber(movimiento.monto_usd);
    return montoUsd > 0 ? montoUsd : 0;
  }

  const totalesPagina = useMemo(() => {
    const rowsVisibles = movimientosTablaVisibles.length > 0 ? movimientosTablaVisibles : movimientosPagina;
    return rowsVisibles.reduce(
      (acc, movimiento) => {
        const montoBsVista = getMontoBsVista(movimiento);
        const montoUsdVista = getMontoUsdVista(movimiento);
        acc.montoBs += movimiento.tipo === 'EGRESO' ? -montoBsVista : montoBsVista;
        if (movimiento.tipo === 'EGRESO') acc.cargoUsd += montoUsdVista;
        if (movimiento.tipo === 'INGRESO') acc.abonoUsd += montoUsdVista;
        return acc;
      },
      { montoBs: 0, cargoUsd: 0, abonoUsd: 0 }
    );
  }, [movimientosTablaVisibles, movimientosPagina, tasaBcvNum]);

  const getConceptoVista = (movimiento: IMovimiento): string => {
    const fondoNombreMov = String(movimiento.fondo_nombre || '').trim();
    const fondoNombrePorId = fondoNombreMov
      || String(fondosCuenta.find((f) => toNullableInt(f.id) === toNullableInt(movimiento.fondo_id))?.nombre || '').trim();
    const etiquetaFondo = fondoNombrePorId ? ` (${fondoNombrePorId})` : '';
    const conceptoOriginal = String(movimiento.concepto || '');
    const conceptoLimpio = conceptoOriginal
      .replace(/\s*\[PENDIENTE_INMUEBLE\]\s*/gi, ' ')
      .replace(/\s*\[SYS_HIST_RECLASIF_INTERNA\]\s*/gi, ' ')
      .replace(/\s*\(gasto\s+\d+\)\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const esPendienteInmueble = conceptoOriginal.toUpperCase().includes(PENDIENTE_INMUEBLE_TAG);
    const inmuebleAsignado = String(movimiento.inmueble || '').trim();

    if (movimiento.es_apertura && movimiento.apertura_sintetica) {
      return `Saldo de apertura del fondo${etiquetaFondo}`;
    }
    if (movimiento.es_apertura) {
      return `Saldo de apertura del fondo${etiquetaFondo}`;
    }
    if (/^Reclasificaci[oó]n\/Recaudado hist[oó]rico desde fondo/i.test(conceptoLimpio)) {
      return 'Recaudado histórico movido a Tránsito / Extra';
    }
    if (esPendienteInmueble && inmuebleAsignado) {
      return `Pago de inmueble ${inmuebleAsignado}`;
    }
    if (esPendienteInmueble) {
      return 'Ingreso bancario pendiente por asignar a inmueble';
    }
    const banco = movimiento.banco_origen?.trim();
    const cedula = movimiento.cedula_origen?.trim();
    if (movimiento.tipo === 'INGRESO' && (banco || cedula)) {
      const extras = [banco ? `Banco: ${banco}` : '', cedula ? `Cédula/RIF: ${cedula}` : ''].filter(Boolean);
      return `${conceptoLimpio || movimiento.concepto} | ${extras.join(' | ')}`;
    }
    return conceptoLimpio || movimiento.concepto;
  };

  const getInmuebleVista = (movimiento: IMovimiento): string => {
    const inmuebleApi = String(movimiento.inmueble || '').trim();
    if (inmuebleApi) return inmuebleApi;

    const concepto = String(movimiento.concepto || '');
    const matchConcepto = concepto.match(/Inmueble:\s*([^|]+)/i);
    if (matchConcepto?.[1]) return matchConcepto[1].trim();

    const matchNota = concepto.match(/Inmueble\s*[:\-]\s*([A-Za-z0-9\-_.\/ ]+)/i);
    if (matchNota?.[1]) return matchNota[1].trim();

    return '-';
  };

  const handleExportExcel = (): void => {
    const normalizarTexto = (value: string): string => (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
    );

    const getNombreVista = (): string => {
      if (activeTab === 'cuenta') return 'cuenta_bancaria';
      if (activeTab === 'sin-fondo') return 'transito_extra';
      const fondoId = parseInt(activeTab.replace('fondo-', ''), 10);
      const fondo = fondosCuenta.find((f) => parseInt(String(f.id), 10) === fondoId);
      const nombreFondo = String(fondo?.nombre || `fondo_${fondoId || 'seleccionado'}`);
      return `fondo_${normalizarTexto(nombreFondo) || 'seleccionado'}`;
    };

    const cuentaSlug = normalizarTexto(cuentaActual ? getCuentaLabel(cuentaActual) : 'sin_cuenta') || 'sin_cuenta';
    const vistaSlug = getNombreVista();
    const fechaDescarga = new Date().toISOString().slice(0, 10);
    const filename = `estado_cuenta_${cuentaSlug}_${vistaSlug}_${fechaDescarga}.xlsx`;

    const rangoAplicado = Boolean(fechaDesde || fechaHasta);
    const hoy = new Date();
    const haceDosMeses = new Date(hoy);
    haceDosMeses.setMonth(haceDosMeses.getMonth() - 2);
    haceDosMeses.setHours(0, 0, 0, 0);

    const movimientosExportar = rangoAplicado
      ? movimientosPorVista
      : movimientosPorVista.filter((movimiento) => {
        const fechaMov = new Date(String(movimiento.fecha || ''));
        if (Number.isNaN(fechaMov.getTime())) return false;
        return fechaMov >= haceDosMeses && fechaMov <= hoy;
      });

    const fondosCuentaIds = new Set(
      fondosCuenta
        .map((f) => toNullableInt(f.id))
        .filter((id): id is number => id !== null)
    );

    const getImpactoCuenta = (movimiento: IMovimiento): 'INGRESO' | 'EGRESO' | 'NEUTRO' => {
      const rawId = String(movimiento.id || '').toUpperCase();
      const tipoRaw = String(movimiento.tipo_raw || '').toUpperCase();
      const concepto = String(movimiento.concepto || '').toUpperCase();
      const referencia = String(movimiento.referencia || '').toUpperCase();
      const movOrigen = toNullableInt((movimiento as { fondo_origen_id?: unknown }).fondo_origen_id);
      const movDestino = toNullableInt((movimiento as { fondo_destino_id?: unknown }).fondo_destino_id);

      const esEgresoTipo = movimiento.tipo === 'EGRESO'
        || tipoRaw.includes('EGRESO')
        || tipoRaw.includes('DEBITO')
        || tipoRaw.includes('PAGO_PROVEEDOR');

      const esTransferencia = rawId.startsWith('TRF-')
        || tipoRaw.includes('TRANSFER')
        || /TRANSFERENCIA|TRANSF\./i.test(concepto)
        || /TRF[-\s]/i.test(referencia);

      if (esTransferencia) {
        const origenEnCuenta = movOrigen !== null && fondosCuentaIds.has(movOrigen);
        const destinoEnCuenta = movDestino !== null && fondosCuentaIds.has(movDestino);
        if (origenEnCuenta && !destinoEnCuenta) return 'EGRESO';
        if (!origenEnCuenta && destinoEnCuenta) return 'INGRESO';
        if (rawId.includes('-OUT') || tipoRaw.includes('SALIDA') || /TRANSFERENCIA\s+ENVIADA/i.test(concepto)) return 'EGRESO';
        if (rawId.includes('-IN') || tipoRaw.includes('ENTRADA') || /TRANSFERENCIA\s+RECIBIDA/i.test(concepto)) return 'INGRESO';
        return 'NEUTRO';
      }

      if (esEgresoTipo) return 'EGRESO';
      return 'INGRESO';
    };

    const rows = movimientosExportar.map((movimiento, index) => {
      const impacto = getImpactoCuenta(movimiento);
      const montoUsdVista = getMontoUsdVista(movimiento);
      const montoBsVista = getMontoBsVista(movimiento);
      const ingresoBs = impacto === 'INGRESO' ? Math.abs(montoBsVista) : 0;
      const egresoBs = impacto === 'EGRESO' ? -Math.abs(montoBsVista) : 0;
      const ingresoUsd = impacto === 'INGRESO' ? Math.abs(montoUsdVista) : 0;
      const egresoUsd = impacto === 'EGRESO' ? -Math.abs(montoUsdVista) : 0;
      return {
        '#': index + 1,
        'Fecha operacion': formatFecha(movimiento.fecha),
        'Fecha registro': formatFecha(movimiento.fecha_registro),
        Referencia: movimiento.referencia || '-',
        Inmueble: getInmuebleVista(movimiento),
        Descripcion: getConceptoVista(movimiento),
        Tipo: movimiento.tipo,
        'Ingresos (Bs)': ingresoBs,
        'Egresos/Salidas (Bs)': egresoBs,
        'Ingresos (USD)': ingresoUsd,
        'Egresos/Salidas (USD)': egresoUsd,
        'Tasa BCV': toNumber(movimiento.tasa_cambio),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estado de Cuenta');
    XLSX.writeFile(workbook, filename);
  };
  const isIngresoPendienteInmueble = (movimiento: IMovimiento): boolean => {
    if (movimiento.tipo !== 'INGRESO') return false;
    if (movimiento.pago_id && Number.isFinite(movimiento.pago_id)) return false;
    if (!Boolean(movimiento.pendiente_inmueble_manual)) return false;
    const inmueble = String(movimiento.inmueble || '').trim();
    if (inmueble) return false;
    if (/INMUEBLE\s*[:\-]\s*[A-Z0-9]/i.test(String(movimiento.concepto || ''))) return false;
    return !inmueble;
  };

  const fetchPropiedadesAdmin = async (): Promise<void> => {
    if (mode !== 'admin' || userRole !== 'Administrador') return;
    if (loadingPropiedadesAdmin) return;
    setLoadingPropiedadesAdmin(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: PropiedadesAdminResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setPropiedadesAdmin([]);
        return;
      }
      const props = Array.isArray(data.propiedades) ? data.propiedades : [];
      const ordenadas = [...props].sort((a, b) =>
        String(a.identificador || '').localeCompare(String(b.identificador || ''), 'es', { numeric: true, sensitivity: 'base' }),
      );
      setPropiedadesAdmin(ordenadas);
    } catch {
      setPropiedadesAdmin([]);
    } finally {
      setLoadingPropiedadesAdmin(false);
    }
  };

  const abrirAsignacionInmueble = async (movimiento: IMovimiento): Promise<void> => {
    if (!isIngresoPendienteInmueble(movimiento)) return;
    const montoBs = getMontoBsVista(movimiento);
    if (montoBs <= 0) {
      await showAlert({
        title: 'Monto no válido',
        message: 'Este ingreso pendiente no tiene un monto en Bs válido para asignar a un inmueble.',
        confirmText: 'Entendido',
        variant: 'warning',
      });
      return;
    }
    if (!propiedadesAdmin.length) {
      await fetchPropiedadesAdmin();
    }
    setMovimientoPendienteAsignar(movimiento);
    setPropiedadAsignacionId('');
    setShowAsignarInmuebleModal(true);
  };

  const propiedadOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      propiedadesAdmin.map((prop) => ({
        value: String(prop.id),
        label: `${prop.identificador}${prop.prop_nombre ? ` - ${prop.prop_nombre}` : ''}`,
        searchText: `${prop.identificador} ${prop.prop_nombre || ''}`,
      })),
    [propiedadesAdmin],
  );

  const extractPagoIdForRollback = (movimiento: IMovimiento): string | null => {
    if (movimiento.tipo !== 'INGRESO') return null;
    const concepto = String(movimiento.concepto || '');
    // El backend no permite rollback directo cuando el pago está atado a un recibo.
    if (/pago\s+de\s+recibo\s*#/i.test(concepto)) return null;
    if (movimiento.pago_id && Number.isFinite(movimiento.pago_id)) return String(movimiento.pago_id);
    const rawId = String(movimiento.id || '');
    const consolidatedMatch = rawId.match(/^ING-CONS-(\d+)$/i);
    if (consolidatedMatch?.[1]) return consolidatedMatch[1];
    const directMatch = rawId.match(/^ING-(\d+)$/i);
    if (directMatch?.[1]) return directMatch[1];
    return null;
  };

  const extractAjusteIdForRollback = (movimiento: IMovimiento): string | null => {
    if (movimiento.tipo !== 'INGRESO') return null;
    const rawId = String(movimiento.id || '');
    const movimientoMatch = rawId.match(/^ING-MF-(\d+)$/i);
    if (!movimientoMatch?.[1]) return null;
    const concepto = String(movimiento.concepto || '');
    if (!/ajuste/i.test(concepto)) return null;
    return movimientoMatch[1];
  };

  const extractTransferenciaIdForRollback = (movimiento: IMovimiento): string | null => {
    const rawId = String(movimiento.id || '');
    const match = rawId.match(/^TRF-(\d+)(?:-(?:IN|OUT|NA))?$/i);
    return match?.[1] || null;
  };

  const extractEgresoManualIdForRollback = (movimiento: IMovimiento): string | null => {
    if (movimiento.tipo !== 'EGRESO' && movimiento.tipo !== 'INGRESO') return null;
    const rawId = String(movimiento.id || '');
    const match = rawId.match(/^(?:EGR|ING)-MF-(\d+)$/i);
    if (!match?.[1]) return null;
    // El backend valida si corresponde realmente a un movimiento manual reversible.
    return match[1];
  };

  const extractPagoProveedorIdForRollback = (movimiento: IMovimiento): string | null => {
    if (movimiento.tipo !== 'EGRESO') return null;
    if (movimiento.pago_id && Number.isFinite(movimiento.pago_id)) return String(movimiento.pago_id);
    const rawId = String(movimiento.id || '');
    const fromPp = rawId.match(/^EGR-PP-(\d+)$/i);
    if (fromPp?.[1]) return fromPp[1];
    return null;
  };

  const extractRollbackTarget = (movimiento: IMovimiento): RollbackTarget | null => {
    const transferenciaId = extractTransferenciaIdForRollback(movimiento);
    if (transferenciaId) return { kind: 'transferencia', id: transferenciaId };
    const pagoProveedorId = extractPagoProveedorIdForRollback(movimiento);
    if (pagoProveedorId) return { kind: 'pago_proveedor', id: pagoProveedorId };
    const egresoId = extractEgresoManualIdForRollback(movimiento);
    if (egresoId) return { kind: 'egreso', id: egresoId };
    const pagoId = extractPagoIdForRollback(movimiento);
    if (pagoId) return { kind: 'pago', id: pagoId };
    const ajusteId = extractAjusteIdForRollback(movimiento);
    if (ajusteId) return { kind: 'ajuste', id: ajusteId };
    return null;
  };

  const handleRollbackMovimiento = async (movimiento: IMovimiento): Promise<void> => {
    if (mode !== 'admin') return;
    const target = extractRollbackTarget(movimiento);
    if (!target) {
      await showAlert({
        title: 'Movimiento no reversible',
        message: 'Este movimiento no corresponde a un registro reversible.',
        confirmText: 'Entendido',
        variant: 'warning',
      });
      return;
    }

    const confirmMessage = target.kind === 'pago'
        ? '¿Deseas revertir este pago? Se aplicarán las validaciones contables correspondientes.'
        : target.kind === 'ajuste'
          ? '¿Deseas revertir este ajuste? Se aplicarán las validaciones contables correspondientes.'
          : target.kind === 'pago_proveedor'
            ? '¿Deseas revertir este pago a proveedor? Se restaurarán los saldos involucrados.'
          : target.kind === 'egreso'
            ? '¿Deseas revertir este movimiento manual? Se hará rollback del saldo del fondo.'
            : '¿Deseas revertir esta transferencia? Se hará rollback de los saldos entre fondos.';
    const ok = await showConfirm({
      title: 'Confirmar reversión',
      message: confirmMessage,
      confirmText: 'Revertir',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    const rollbackKey = `${target.kind}-${target.id}`;
    setRollbackingKey(rollbackKey);
    try {
      const endpoint = target.kind === 'pago'
        ? `${API_BASE_URL}/pagos/${target.id}/rollback`
        : target.kind === 'ajuste'
          ? `${API_BASE_URL}/movimientos-fondos/${target.id}/rollback-ajuste`
          : target.kind === 'pago_proveedor'
            ? `${API_BASE_URL}/pagos-proveedores/${target.id}/rollback`
          : target.kind === 'egreso'
            ? `${API_BASE_URL}/movimientos-fondos/${target.id}/rollback-egreso-manual`
            : `${API_BASE_URL}/transferencias/${target.id}/rollback`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        await showAlert({
          title: 'No se pudo revertir',
          message: data?.message || data?.error || 'No se pudo revertir el movimiento.',
          confirmText: 'Entendido',
          variant: 'danger',
        });
        return;
      }
      await refreshCuentaData(selectedCuenta);
      await showAlert({
        title: 'Reversión completada',
        message:
          data?.message
          || (target.kind === 'pago'
            ? 'Pago revertido correctamente.'
            : target.kind === 'ajuste'
              ? 'Ajuste revertido correctamente.'
              : target.kind === 'pago_proveedor'
                ? 'Pago a proveedor revertido correctamente.'
              : target.kind === 'egreso'
                ? 'Movimiento manual revertido correctamente.'
                : 'Transferencia revertida correctamente.'),
        confirmText: 'Entendido',
        variant: 'success',
      });
    } catch {
      await showAlert({
        title: 'Error de conexión',
        message: 'No se pudo revertir el movimiento por un error de conexión.',
        confirmText: 'Entendido',
        variant: 'danger',
      });
    } finally {
      setRollbackingKey('');
    }
  };

  if (mode === 'admin' && userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  if (mode === 'owner' && userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;
  const loadingOverlay = loading ? (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
      <HabiooLoader size="md" message="Generando estado de cuenta..." className="py-0" />
    </div>
  ) : null;

  if (mode === 'owner') {
    const meses = [
      { v: '01', l: 'Enero' }, { v: '02', l: 'Febrero' }, { v: '03', l: 'Marzo' }, { v: '04', l: 'Abril' },
      { v: '05', l: 'Mayo' }, { v: '06', l: 'Junio' }, { v: '07', l: 'Julio' }, { v: '08', l: 'Agosto' },
      { v: '09', l: 'Septiembre' }, { v: '10', l: 'Octubre' }, { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' },
    ];
    const aniosDisponibles = Array.from(new Set(ownerPeriodos.map((p) => String(p.anio))));
    const mesesDisponibles = Array.from(
      new Set(
        ownerPeriodos
          .filter((p) => String(p.anio) === ownerFiltroAnio)
          .map((p) => String(p.mes).padStart(2, '0')),
      ),
    ).sort((a, b) => Number(a) - Number(b));
    const noHayPeriodos = aniosDisponibles.length === 0;

    return (
      <div className="relative space-y-6 animate-fadeIn">
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className={`grid grid-cols-1 gap-4 ${ownerVista === 'actual' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cuenta a inspeccionar</label>
              <select
                value={selectedCuenta}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCuenta(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
              >
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCuentaLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Vista</label>
              <select
                value={ownerVista}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setOwnerVista(e.target.value as 'actual' | 'corte')}
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
              >
                <option value="actual">Día a día (actual)</option>
                <option value="corte">Corte mensual por aviso</option>
              </select>
            </div>

            {ownerVista === 'actual' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fondo</label>
                <select
                  value={ownerFondoSeleccionado}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setOwnerFondoSeleccionado(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
                  disabled={fondosCuenta.length === 0}
                >
                  <option value="ALL">Todos los fondos</option>
                  {fondosCuenta.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>
                      {f.nombre || `Fondo ${f.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {ownerVista === 'corte' && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Año</label>
                  <select
                    value={ownerFiltroAnio}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const nextAnio = e.target.value;
                      setOwnerFiltroAnio(nextAnio);
                      const firstMes = ownerPeriodos
                        .filter((p) => String(p.anio) === nextAnio)
                        .map((p) => String(p.mes).padStart(2, '0'))
                        .sort((a, b) => Number(a) - Number(b))[0] || '';
                      setOwnerFiltroMes(firstMes);
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
                    disabled={noHayPeriodos}
                  >
                    {noHayPeriodos && <option value="">Sin cortes generados</option>}
                    {aniosDisponibles.map((anio) => (
                      <option key={anio} value={anio}>{anio}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mes</label>
                  <select
                    value={ownerFiltroMes}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setOwnerFiltroMes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
                    disabled={noHayPeriodos || !ownerFiltroAnio || mesesDisponibles.length === 0}
                  >
                    {(noHayPeriodos || mesesDisponibles.length === 0) && <option value="">Sin meses</option>}
                    {meses.filter((m) => mesesDisponibles.includes(m.v)).map((m) => (
                      <option key={m.v} value={m.v}>{m.l}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {ownerVista === 'actual' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex flex-col justify-center items-center gap-3 text-center">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Saldo total visible (USD)</p>
                <h2 className="text-4xl font-black text-blue-700 dark:text-blue-300">${formatCurrency(ownerResumenActual.reduce((a, f) => a + f.equivalenteUsd, 0))}</h2>
                <p className="text-xs font-medium text-blue-700/90 dark:text-blue-200">
                  Toque el botón BCV para actualizar el equivalente en USD al día de hoy
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={fetchBCV}
                    disabled={loadingBcv}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800 disabled:opacity-60"
                  >
                    {loadingBcv ? 'Consultando BCV...' : 'Obtener BCV'}
                  </button>
                  {tasaBcvNum > 0 && <span className="text-xs font-bold text-blue-700 dark:text-blue-200">Tasa: {formatRate(tasaBcvNum)}</span>}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center opacity-80">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Saldo total visible (Bs)</p>
                <h2 className="text-3xl font-black text-gray-700 dark:text-gray-300">Bs {formatCurrency(ownerResumenActual.reduce((a, f) => a + (f.moneda === 'BS' ? f.saldo : (tasaBcvNum > 0 ? f.saldo * tasaBcvNum : 0)), 0))}</h2>
              </div>
            </div>

            <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Egresos del fondo seleccionado</h3>
              </div>
              <DataTable<IMovimiento>
                columns={[
                  { key: 'fecha', header: 'Fecha', headerClassName: 'w-[1%] whitespace-nowrap', className: 'w-[1%] whitespace-nowrap font-mono text-gray-600 dark:text-gray-400 text-xs', render: (mov) => formatFecha(mov.fecha) },
                  { key: 'referencia', header: 'Referencia', className: 'font-mono text-xs text-gray-500', render: (mov) => mov.referencia || '-' },
                  {
                    key: 'descripcion',
                    header: 'Descripción',
                    headerClassName: 'w-[280px] max-w-[280px]',
                    className: 'w-[280px] max-w-[280px] font-medium text-gray-800 dark:text-gray-200',
                    render: (mov) => <span className="block truncate" title={mov.concepto || '-'}>{mov.concepto || '-'}</span>,
                  },
                  { key: 'monto_bs', header: 'Monto (Bs)', headerClassName: 'text-right min-w-[150px] whitespace-nowrap', className: 'text-right min-w-[150px] whitespace-nowrap font-black font-mono', render: (mov) => <>Bs {formatCurrency(getMontoBsVista(mov))}</> },
                  { key: 'cargo', header: 'Cargo ($)', headerClassName: 'text-right min-w-[120px] whitespace-nowrap', className: 'text-right min-w-[120px] whitespace-nowrap font-black font-mono text-red-600 dark:text-red-400', render: (mov) => <>-{formatCurrency(mov.monto_usd)}</> },
                  { key: 'tasa', header: 'Tasa', headerClassName: 'text-right min-w-[110px] whitespace-nowrap', className: 'text-right min-w-[110px] whitespace-nowrap font-mono text-xs text-blue-600 dark:text-blue-400', render: (mov) => mov.tasa_cambio ? formatRate(mov.tasa_cambio) : '-' },
                ]}
                data={ownerEgresosFondo}
                enableTanstackPagination
                pageSize={10}
                keyExtractor={(mov) => String(mov.id)}
                emptyMessage="No hay egresos en el fondo seleccionado."
                rowClassName="border-b border-gray-50 dark:border-gray-800/50"
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex flex-col justify-center items-center">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Corte total (USD)</p>
                <h2 className="text-4xl font-black text-blue-700 dark:text-blue-300">${formatCurrency(ownerCorteTotales.usd)}</h2>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center opacity-80">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Corte total (Bs)</p>
                <h2 className="text-3xl font-black text-gray-700 dark:text-gray-300">Bs {formatCurrency(ownerCorteTotales.bs)}</h2>
              </div>
            </div>

            <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <DataTable
                columns={[
                  { key: 'fondo', header: 'Fondo', className: 'font-semibold text-gray-800 dark:text-gray-200', render: (corte) => corte.nombre_fondo },
                  { key: 'banco', header: 'Banco', className: 'text-gray-600 dark:text-gray-400', render: (corte) => `${corte.nombre_banco || 'Cuenta'} (${corte.apodo_cuenta || '-'})` },
                  { key: 'saldo_bs', header: 'Saldo (Bs)', headerClassName: 'text-right', className: 'text-right font-black font-mono', render: (corte) => <>Bs {formatCurrency(corte.saldo_bs)}</> },
                  { key: 'saldo_usd', header: 'Saldo (USD)', headerClassName: 'text-right', className: 'text-right font-black font-mono', render: (corte) => <>$ {formatCurrency(corte.saldo_usd)}</> },
                  { key: 'tasa', header: 'Tasa Ref.', headerClassName: 'text-right', className: 'text-right text-blue-600 dark:text-blue-400 font-mono', render: (corte) => corte.tasa_referencia ? formatRate(corte.tasa_referencia) : '-' },
                ]}
                data={ownerCortesFiltrados}
                enableTanstackPagination
                pageSize={10}
                keyExtractor={(corte) => corte.id}
                emptyMessage="No hay cortes mensuales para el período seleccionado."
                rowClassName="border-b border-gray-50 dark:border-gray-800/50"
              />
            </div>
          </>
        )}
        {loadingOverlay}
      </div>
    );
  }

  return (
    <div className="relative space-y-5 animate-fadeIn">
      <div className="space-y-5 overflow-auto pr-1" style={{ maxHeight: `${topPanelHeight}px` }}>
      <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Estado de Cuentas</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Libro mayor y movimientos bancarios del condominio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCuenta}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCuenta(e.target.value)}
            className="h-11 min-w-[260px] rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {getCuentaLabel(c)}
              </option>
            ))}
          </select>
          {mode === 'admin' && (
            <>
              <button
                onClick={() => setShowTransfModal(true)}
                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Transf. Interbancaria
              </button>
              <button
                onClick={() => setShowEgresoModal(true)}
                className="h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                Egreso Bancario
              </button>
              <button
                onClick={() => setShowIngresoModal(true)}
                className="h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              >
                Ingreso Bancario
              </button>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Saldo en bolívares</p>
          <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">Bs {formatCurrency(saldoCuentaBsActual)}</p>
        </article>
        {fondosDestacadosBs.map((fondo) => (
          <article key={`bs-${fondo.id}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">{fondo.nombre}</p>
            <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">
              Bs {formatCurrency(fondo.saldo)}
            </p>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">≈ ${formatCurrency(fondo.equivalenteUsd)} USD</p>
          </article>
        ))}
        {!isCuentaUsd && (
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Tránsito / Extra</p>
            <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">
              {saldoTransitoExtraBsActual < 0
                ? `-Bs ${formatCurrency(Math.abs(saldoTransitoExtraBsActual))}`
                : `Bs ${formatCurrency(saldoTransitoExtraBsActual)}`}
            </p>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {saldoTransitoExtraUsdActual < 0
                ? `≈ -$${formatCurrency(Math.abs(saldoTransitoExtraUsdActual))} USD`
                : `≈ $${formatCurrency(saldoTransitoExtraUsdActual)} USD`}
            </p>
          </article>
        )}
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Tasa BCV</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-4xl font-black text-gray-900 dark:text-white">{tasaBcvNum > 0 ? formatRate(tasaBcvNum) : '-'}</p>
            <button
              type="button"
              onClick={fetchBCV}
              disabled={loadingBcv}
              title={loadingBcv ? 'Actualizando tasa BCV...' : 'Actualizar tasa BCV'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-lg font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              <span className={loadingBcv ? 'animate-spin' : ''}>↻</span>
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Bs por USD</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Saldo equivalente USD</p>
          <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">${formatCurrency(saldoCuentaUsdActual)}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Total ingresos</p>
          <p className="mt-2 text-4xl font-black text-emerald-600 dark:text-emerald-400">+${formatCurrency(totalIngresosUsd)}</p>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">+Bs {formatCurrency(totalIngresosBs)}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Total egresos</p>
          <p className="mt-2 text-4xl font-black text-red-600 dark:text-red-400">-${formatCurrency(totalEgresosUsd)}</p>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">-Bs {formatCurrency(totalEgresosBs)}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {fondosDestacadosUsd.map((fondo) => (
          <article key={fondo.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">{fondo.nombre}</p>
            <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">
              $ {formatCurrency(fondo.saldo)}
            </p>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">≈ ${formatCurrency(fondo.equivalenteUsd)} USD</p>
          </article>
        ))}
      </section>
      </div>

      <div
        className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-gray-800 dark:text-white">Libro Mayor</h3>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                {cuentaActual ? getCuentaLabel(cuentaActual) : 'Sin cuenta'}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-2 xl:justify-end">
              <div className="min-w-[300px]">
                <label className="block text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Rango</label>
                <DateRangePicker
                  from={ymdToDate(fechaDesde)}
                  to={ymdToDate(fechaHasta)}
                  onChange={({ from, to }) => {
                    setFechaDesde(dateToYmd(from));
                    setFechaHasta(dateToYmd(to));
                  }}
                  maxDate={new Date()}
                  locale={es}
                  placeholderText="Rango (dd/mm/yyyy - dd/mm/yyyy)"
                  wrapperClassName="w-full min-w-0"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 pr-10 text-xs outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Buscar</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder="Inmueble, referencia o monto"
                  className="h-10 w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFechaDesde('');
                  setFechaHasta('');
                  setSearchTerm('');
                }}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
              >
                Descargar Excel
              </button>
              <button
                type="button"
                onClick={() => setTableFontBoost((prev) => (prev >= 4 ? 0 : prev + 1))}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                title="Aumentar tamaño de fuente de la tabla"
              >
                A+
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('cuenta')}
                className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                  activeTab === 'cuenta'
                    ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Cuenta bancaria
              </button>
              {fondosCuenta.map((fondo) => (
                <button
                  key={String(fondo.id)}
                  type="button"
                  onClick={() => setActiveTab(`fondo-${fondo.id}`)}
                  className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                    activeTab === `fondo-${fondo.id}`
                      ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {fondo.nombre || `Fondo ${fondo.id}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActiveTab('sin-fondo')}
                className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                  activeTab === 'sin-fondo'
                    ? 'bg-amber-50 text-amber-700 shadow-sm dark:bg-amber-900/20 dark:text-amber-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Tránsito / Extra
              </button>
            </div>
          </div>

        </div>

        <div>
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <HabiooLoader size="sm" message="Generando estado de cuenta..." className="py-0" />
          </div>
        ) : activeTab === 'sin-fondo' ? (
          <div className="px-5 pt-4 pb-2 space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-900/20">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Extras Aplicados Al Fondo Principal (Informativo)
              </p>
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                Estos montos ya fueron acreditados al fondo principal; aquí se muestran para seguimiento.
              </p>
            </div>
            <DataTable<IExtraInfo>
              columns={[
                { key: 'fecha', header: 'Fecha', className: 'font-mono text-xs text-gray-600', render: (row) => formatFecha(row.fecha) },
                { key: 'referencia', header: 'Referencia', className: 'font-mono text-xs text-gray-500', render: (row) => row.referencia || '-' },
                { key: 'inmueble', header: 'Inmueble', className: 'font-semibold text-gray-700 dark:text-gray-300', render: (row) => row.inmueble || '-' },
                { key: 'concepto', header: 'Descripción', className: 'font-medium text-gray-800 dark:text-gray-200', render: (row) => row.concepto },
                {
                  key: 'monto_bs',
                  header: 'Monto (Bs)',
                  headerClassName: 'text-right',
                  className: 'text-right font-black font-mono text-slate-700 dark:text-slate-200',
                  render: (row) => row.monto_bs && row.monto_bs > 0 ? `Bs ${formatCurrency(row.monto_bs)}` : '-'
                },
                {
                  key: 'monto_usd',
                  header: 'Abono ($)',
                  headerClassName: 'text-right',
                  className: 'text-right font-black font-mono text-emerald-600 dark:text-emerald-400',
                  render: (row) => row.monto_usd > 0 ? `+${formatCurrency(row.monto_usd)}` : '-'
                },
                {
                  key: 'tasa',
                  header: 'Tasa (Bs)',
                  headerClassName: 'text-right',
                  className: 'text-right font-mono text-blue-600 dark:text-blue-400',
                  render: (row) => {
                    const montoBs = toNumber(row.monto_bs);
                    const montoUsd = toNumber(row.monto_usd);
                    if (montoBs <= 0 || montoUsd <= 0) return '-';
                    const tasa = montoBs / montoUsd;
                    return formatRate(tasa);
                  }
                },
                { key: 'fondo_destino', header: 'Fondo destino', className: 'font-semibold text-gray-700 dark:text-gray-300', render: (row) => row.fondo_destino || 'Fondo principal' },
              ]}
              data={extrasInfoPorVista}
              enableTanstackPagination
              pageSize={25}
              keyExtractor={(row, index) => `extra-${row.pago_id}-${index}`}
              onRowDoubleClick={(row) => {
                const montoBs = toNumber(row.monto_bs);
                const montoUsd = toNumber(row.monto_usd);
                const tasa = montoBs > 0 && montoUsd > 0 ? Number((montoBs / montoUsd).toFixed(4)) : 0;
                setMovimientoDetalle({
                  id: `extra-${row.pago_id}`,
                  fecha: row.fecha,
                  fecha_registro: row.fecha,
                  referencia: String(row.referencia || ''),
                  concepto: row.concepto,
                  tipo: 'INGRESO',
                  monto_bs: montoBs,
                  tasa_cambio: tasa,
                  monto_usd: montoUsd,
                  pago_id: row.pago_id,
                } as IMovimiento);
              }}
              emptyMessage="No hay datos disponibles."
            />
          </div>
        ) : movimientosPorVista.length === 0 ? (
          <p className="text-center text-gray-400 py-10 font-medium">No hay movimientos registrados en esta cuenta.</p>
        ) : (
          <DataTable<IMovimiento>
            tableStyle={{ fontSize: `${tableFontSizePx}px`, tableLayout: 'fixed' }}
            columns={[
              {
                key: 'fecha',
                header: 'Fecha',
                headerClassName: 'whitespace-nowrap',
                className: 'whitespace-nowrap',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.fecha,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.fecha,
                enableSorting: true,
                sortAccessor: (movimiento) => new Date(String(movimiento.fecha || movimiento.fecha_registro || '')).getTime() || 0,
                render: (movimiento) => (
                  <>
                    <span className="block font-mono font-bold text-gray-800 dark:text-gray-200" style={{ fontSize: `${tableCompactFontPx}px` }}>
                      <span className="font-bold text-gray-500 dark:text-gray-300 uppercase mr-1" style={{ fontSize: `${tableTagFontPx}px` }}>pago</span>{formatFecha(movimiento.fecha)}
                    </span>
                    {movimiento.fecha_registro && (
                      <span className="block font-mono text-gray-600 dark:text-gray-200 mt-0.5" style={{ fontSize: `${tableMetaFontPx}px` }}>
                        <span className="font-bold text-gray-600 dark:text-gray-200 uppercase mr-1" style={{ fontSize: `${tableTagFontPx}px` }}>sistema</span>{formatFecha(movimiento.fecha_registro)}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'referencia',
                header: 'Referencia',
                className: 'font-mono text-gray-500',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.referencia,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.referencia,
                enableSorting: true,
                sortAccessor: (movimiento) => {
                  const referencia = String(movimiento.referencia || '').trim();
                  const numero = Number(referencia.replace(/[^\d.-]/g, ''));
                  return Number.isFinite(numero) ? numero : referencia.toLowerCase();
                },
                render: (movimiento) => <span style={{ fontSize: `${tableCompactFontPx}px` }}>{movimiento.referencia || '-'}</span>,
              },
              {
                key: 'inmueble',
                header: 'Inmueble',
                className: 'font-semibold text-gray-700 dark:text-gray-300',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.inmueble,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.inmueble,
                enableSorting: true,
                sortAccessor: (movimiento) => getInmuebleVista(movimiento).toLowerCase(),
                render: (movimiento) => <span style={{ fontSize: `${tableCompactFontPx}px` }}>{getInmuebleVista(movimiento)}</span>,
              },
              {
                key: 'descripcion',
                header: 'Descripción',
                className: 'font-medium text-gray-800 dark:text-gray-200',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.descripcion,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.descripcion,
                enableSorting: true,
                sortAccessor: (movimiento) => getConceptoVista(movimiento).toLowerCase(),
                render: (movimiento) => {
                  const conceptoVista = getConceptoVista(movimiento);
                  return (
                    <span className="block truncate" title={typeof conceptoVista === 'string' ? conceptoVista : undefined}>
                      {conceptoVista}
                    </span>
                  );
                },
              },
              ...(!isCuentaUsd ? [{
                key: 'monto_bs',
                header: 'Monto (Bs)',
                headerClassName: 'text-right whitespace-nowrap',
                className: 'text-right whitespace-nowrap font-black font-mono text-slate-700 dark:text-slate-200',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.monto_bs,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.monto_bs,
                enableSorting: true,
                sortAccessor: (movimiento: IMovimiento) => getMontoBsVista(movimiento),
                render: (movimiento: IMovimiento) => {
                  const montoBsVista = getMontoBsVista(movimiento);
                  return montoBsVista > 0 ? (
                    movimiento.tipo === 'EGRESO' ? (
                      <span className="text-red-600 dark:text-red-400">-Bs {formatCurrency(montoBsVista)}</span>
                    ) : (
                      <span>Bs {formatCurrency(montoBsVista)}</span>
                    )
                  ) : <>-</>;
                },
              } as Column<IMovimiento>] : []),
              {
                key: 'cargo',
                header: 'Cargo ($)',
                headerClassName: 'text-right whitespace-nowrap',
                className: 'text-right whitespace-nowrap font-black font-mono',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.cargo,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.cargo,
                enableSorting: true,
                sortAccessor: (movimiento) => (movimiento.tipo === 'EGRESO' ? getMontoUsdVista(movimiento) : 0),
                render: (movimiento) => {
                  const montoUsdVista = getMontoUsdVista(movimiento);
                  return movimiento.tipo === 'EGRESO' && montoUsdVista > 0 ? (
                    <span className="text-red-600 dark:text-red-400">-{formatCurrency(montoUsdVista)}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  );
                },
              },
              {
                key: 'abono',
                header: 'Abono ($)',
                headerClassName: 'text-right whitespace-nowrap',
                className: 'text-right whitespace-nowrap font-black font-mono',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.abono,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.abono,
                enableSorting: true,
                sortAccessor: (movimiento) => (movimiento.tipo === 'INGRESO' ? getMontoUsdVista(movimiento) : 0),
                render: (movimiento) => {
                  const montoUsdVista = getMontoUsdVista(movimiento);
                  return movimiento.tipo === 'INGRESO' && montoUsdVista > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(montoUsdVista)}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  );
                },
              },
              ...(!isCuentaUsd ? [{
                key: 'tasa',
                header: 'Tasa (Bs.)',
                headerClassName: 'text-right whitespace-nowrap',
                className: 'text-right whitespace-nowrap font-mono text-blue-600 dark:text-blue-400',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.tasa,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.tasa,
                enableSorting: true,
                sortAccessor: (movimiento: IMovimiento) => toNumber(movimiento.tasa_cambio),
                render: (movimiento: IMovimiento) => (
                  <span style={{ fontSize: `${tableCompactFontPx}px` }}>
                    {movimiento.tasa_cambio ? formatRate(movimiento.tasa_cambio) : '-'}
                  </span>
                ),
              } as Column<IMovimiento>] : []),
              ...(mode === 'admin' ? [{
                key: 'acciones',
                header: 'Acciones',
                headerClassName: 'text-right whitespace-nowrap',
                className: 'text-right whitespace-nowrap',
                size: MAIN_TABLE_COLUMN_DEFAULT_WIDTHS.acciones,
                minSize: MAIN_TABLE_COLUMN_MIN_WIDTHS.acciones,
                render: (movimiento: IMovimiento) => {
                  const rollbackTarget = extractRollbackTarget(movimiento);
                  const rollbackButtonKey = rollbackTarget ? `${rollbackTarget.kind}-${rollbackTarget.id}` : '';
                  const canAssignInmueble = isIngresoPendienteInmueble(movimiento);
                  if (!rollbackTarget && !canAssignInmueble) {
                    return (
                      <span className="text-gray-300">-</span>
                    );
                  }

                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      {canAssignInmueble && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void abrirAsignacionInmueble(movimiento);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                          title="Asignar este ingreso pendiente a un inmueble y abrir el registro de pago."
                        >
                          Asignar inmueble
                        </button>
                      )}
                      {rollbackTarget && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRollbackMovimiento(movimiento);
                          }}
                          disabled={rollbackingKey === rollbackButtonKey}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title={rollbackTarget.kind === 'pago'
                            ? 'Disponible para reversión (sujeto a validaciones contables).'
                            : rollbackTarget.kind === 'ajuste'
                              ? 'Disponible para reversión (sujeto a validaciones contables).'
                          : rollbackTarget.kind === 'pago_proveedor'
                            ? 'Revertir pago a proveedor y restaurar saldos.'
                          : rollbackTarget.kind === 'egreso'
                            ? 'Revertir movimiento manual y restaurar saldo en el fondo.'
                            : 'Revertir transferencia y hacer rollback de saldos entre fondos.'}
                        >
                          {rollbackingKey === rollbackButtonKey ? 'Revirtiendo...' : 'Revertir'}
                        </button>
                      )}
                    </div>
                  );
                },
              } as Column<IMovimiento>] : []),
            ]}
            data={movimientosPorVistaConAperturaAlFinal}
            enableTanstackSorting
            enableTanstackColumnSizing
            defaultSorting={[{ id: 'referencia', desc: true }] as SortingState}
            sortPinnedBottomPredicate={isAperturaMovimiento}
            enableTanstackPagination
            pageSize={10}
            onVisibleRowsChange={setMovimientosTablaVisibles}
            keyExtractor={(movimiento) => String(movimiento.id)}
            rowClassName="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
            onRowDoubleClick={(movimiento) => setMovimientoDetalle(movimiento)}
            renderFooter={() => (
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40">
                  <td colSpan={4} className="p-3 font-black text-right text-gray-700 dark:text-gray-200">
                    Total vista
                  </td>
                  {!isCuentaUsd && (
                    <td className="p-3 text-right font-black font-mono text-slate-700 dark:text-slate-200">
                      {totalesPagina.montoBs < 0
                        ? `-Bs ${formatCurrency(Math.abs(totalesPagina.montoBs))}`
                        : `Bs ${formatCurrency(totalesPagina.montoBs)}`}
                    </td>
                  )}
                  <td className="p-3 text-right font-black font-mono text-red-600 dark:text-red-400">
                    {`-${formatCurrency(totalesPagina.cargoUsd)}`}
                  </td>
                  <td className="p-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {`+${formatCurrency(totalesPagina.abonoUsd)}`}
                  </td>
                  {!isCuentaUsd && (
                    <td className="p-3 text-right font-mono text-gray-400">-</td>
                  )}
                  {mode === 'admin' && <td className="p-3 text-right text-gray-400">-</td>}
                </tr>
              </tfoot>
            )}
          />
        )}
        </div>
      </div>

      {mode === 'admin' && showAsignarInmuebleModal && movimientoPendienteAsignar && (
        <ModalBase
          title="Asignar Inmueble"
          onClose={() => {
            setShowAsignarInmuebleModal(false);
            setMovimientoPendienteAsignar(null);
            setPropiedadAsignacionId('');
          }}
          maxWidth="max-w-lg"
          helpTooltip="Selecciona el inmueble al que pertenece este ingreso bancario pendiente para abrir el registro de pago con monto bloqueado."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
              Este ingreso ya impactó el saldo bancario. Aquí solo vas a vincularlo al inmueble y registrar el pago con el monto en Bs bloqueado.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
              <div><span className="font-semibold">Referencia:</span> {movimientoPendienteAsignar.referencia || '-'}</div>
              <div><span className="font-semibold">Monto Bs:</span> Bs {formatCurrency(getMontoBsVista(movimientoPendienteAsignar))}</div>
            </div>
            <FormField label="Inmueble" required>
              <SearchableCombobox
                options={propiedadOptions}
                value={propiedadAsignacionId}
                onChange={setPropiedadAsignacionId}
                disabled={loadingPropiedadesAdmin}
                placeholder={loadingPropiedadesAdmin ? 'Cargando inmuebles...' : 'Buscar inmueble...'}
                emptyMessage="Sin inmuebles disponibles"
                className="w-full p-3 rounded-xl border border-gray-200 bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
              />
            </FormField>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowAsignarInmuebleModal(false);
                  setMovimientoPendienteAsignar(null);
                  setPropiedadAsignacionId('');
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const propiedad = propiedadesAdmin.find((p) => String(p.id) === propiedadAsignacionId) || null;
                  if (!propiedad || !movimientoPendienteAsignar) {
                    await showAlert({
                      title: 'Seleccione un inmueble',
                      message: 'Debes seleccionar un inmueble para continuar.',
                      confirmText: 'Entendido',
                      variant: 'warning',
                    });
                    return;
                  }
                  setPagoPropiedadSeleccionada({
                    id: propiedad.id,
                    identificador: propiedad.identificador,
                    saldo_actual: propiedad.saldo_actual ?? 0,
                  });
                  setPagoMontoBsBloqueado(getMontoBsVista(movimientoPendienteAsignar));
                  setPagoTasaBloqueada(toNumber(movimientoPendienteAsignar.tasa_cambio));
                  setPagoReferenciaPrefill(String(movimientoPendienteAsignar.referencia || '').trim());
                  setPagoMovimientoFondoPendienteId(toNullableInt(String(movimientoPendienteAsignar.id).replace(/^ING-MF-/i, '')));
                  setShowAsignarInmuebleModal(false);
                  setMovimientoPendienteAsignar(null);
                  setPropiedadAsignacionId('');
                }}
                className="px-3 py-2 rounded-lg border border-transparent bg-donezo-primary text-sm font-semibold text-white hover:bg-green-700"
              >
                Continuar con registro de pago
              </button>
            </div>
          </div>
        </ModalBase>
      )}

      {mode === 'admin' && pagoPropiedadSeleccionada && (
        <ModalRegistrarPago
          propiedadPreseleccionada={pagoPropiedadSeleccionada}
          montoBsBloqueado={pagoMontoBsBloqueado}
          tasaBloqueada={pagoTasaBloqueada}
          cuentaIdBloqueada={selectedCuenta || null}
          referenciaPrefill={pagoReferenciaPrefill || null}
          movimientoFondoPendienteId={pagoMovimientoFondoPendienteId}
          onClose={() => {
            setPagoPropiedadSeleccionada(null);
            setPagoMontoBsBloqueado(0);
            setPagoTasaBloqueada(0);
            setPagoReferenciaPrefill('');
            setPagoMovimientoFondoPendienteId(null);
          }}
          onSuccess={() => {
            setPagoPropiedadSeleccionada(null);
            setPagoMontoBsBloqueado(0);
            setPagoTasaBloqueada(0);
            setPagoReferenciaPrefill('');
            setPagoMovimientoFondoPendienteId(null);
            void refreshCuentaData(selectedCuenta);
          }}
        />
      )}

      {mode === 'admin' && showTransfModal && (
        <ModalTransferencia
          onClose={() => setShowTransfModal(false)}
          onSuccess={() => {
            setShowTransfModal(false);
            void refreshCuentaData(selectedCuenta);
          }}
        />
      )}

      {mode === 'admin' && showEgresoModal && (
        <ModalRegistrarEgreso
          initialCuentaId={selectedCuenta}
          tipoMovimiento="EGRESO"
          onClose={() => setShowEgresoModal(false)}
          onSuccess={() => {
            setShowEgresoModal(false);
            void refreshCuentaData(selectedCuenta);
          }}
        />
      )}

      {mode === 'admin' && showIngresoModal && (
        <ModalRegistrarEgreso
          initialCuentaId={selectedCuenta}
          tipoMovimiento="INGRESO"
          onClose={() => setShowIngresoModal(false)}
          onSuccess={() => {
            setShowIngresoModal(false);
            void refreshCuentaData(selectedCuenta);
          }}
        />
      )}

      {movimientoDetalle && (
        <ModalDetalleMovimiento
          movimiento={movimientoDetalle}
          isCuentaUsd={isCuentaUsd}
          onClose={() => setMovimientoDetalle(null)}
          formatCurrency={formatCurrency}
          formatFecha={formatFecha}
        />
      )}
      {loadingOverlay}
    </div>
  );
};

export default EstadoCuentaBancariaView;




