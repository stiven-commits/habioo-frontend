import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { ModalRegistrarEgreso, ModalTransferencia } from '../BancosModals';
import ModalDetalleMovimiento, { type IMovimientoDetalle } from './ModalDetalleMovimiento';
import 'react-datepicker/dist/react-datepicker.css';

type ViewMode = 'admin' | 'owner';
type ActiveTab = 'cuenta' | 'sin-fondo' | `fondo-${number | string}`;
type SortDirection = 'asc' | 'desc';
type SortKey = 'ejecucion' | 'fecha' | 'referencia' | 'inmueble' | 'descripcion' | 'monto_bs' | 'cargo' | 'abono' | 'tasa';

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
  es_predeterminada?: boolean;
}

interface Fondo {
  id: number | string;
  cuenta_bancaria_id?: number | string;
  nombre?: string;
  moneda?: 'USD' | 'BS' | string;
  saldo_actual?: string | number;
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
}

interface RollbackTarget {
  kind: 'pago' | 'ajuste';
  id: string;
}

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
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

interface BcvResponse {
  promedio?: string | number;
}

const toNumber = (value: unknown): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const toNullableInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
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
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
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

const parseFilterDate = (value: string): Date | null => {
  const txt = value.trim();
  if (!txt) return null;
  const d = new Date(`${txt}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const EstadoCuentaBancariaView: FC<EstadoCuentaBancariaViewProps> = ({ mode }) => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const ownerCondominioId = propiedadActiva?.id_condominio;

  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [selectedCuenta, setSelectedCuenta] = useState<string>('');
  const [movimientos, setMovimientos] = useState<IMovimiento[]>([]);
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
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [movimientoDetalle, setMovimientoDetalle] = useState<IMovimiento | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ejecucion', direction: 'desc' });
  const [tasaBcv, setTasaBcv] = useState<string>('');
  const [loadingBcv, setLoadingBcv] = useState<boolean>(false);
  const [rollbackingKey, setRollbackingKey] = useState<string>('');
  const [tableFontBoost, setTableFontBoost] = useState<number>(0);
  const itemsPerPage = 13;
  const tableFontSizePx = 14 + tableFontBoost;
  const tableMetaFontPx = 10 + tableFontBoost;
  const tableTagFontPx = 9 + tableFontBoost;
  const tableCompactFontPx = 12 + tableFontBoost;

  const fetchCuentas = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      if (mode === 'owner') {
        if (!ownerCondominioId) {
          setCuentas([]);
          setSelectedCuenta('');
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
          const predeterminada = cuentasOwner.find((c) => c.es_predeterminada);
          const cuentaInicial = predeterminada ?? cuentasOwner[0];
          if (cuentaInicial) setSelectedCuenta(String(cuentaInicial.id));
        } else {
          setCuentas([]);
          setSelectedCuenta('');
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
        const predeterminada = bancos.find((c) => c.es_predeterminada);
        const cuentaInicial = predeterminada ?? bancos[0];
        if (cuentaInicial) setSelectedCuenta(String(cuentaInicial.id));
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

    setLoading(true);
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
        const concepto = String(
          safeMov.concepto
          || (safeMov as { fondo_nombre?: string }).fondo_nombre
          || (safeMov as { nota?: unknown }).nota
          || '-'
        );
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
          referencia: String(safeMov.referencia ?? (safeMov as { referencia_id?: unknown }).referencia_id ?? ''),
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
          fecha_registro: fechaRegistro,
          ...(safeMov.saldo_acumulado !== undefined ? { saldo_acumulado: safeMov.saldo_acumulado } : {})
        };
      });

      setMovimientos(normalizados);
    } catch (error) {
      console.error(error);
      setMovimientos([]);
    } finally {
      setLoading(false);
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
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('No se pudo consultar BCV');
      const data: BcvResponse = await response.json();
      if (data?.promedio) {
        const rateNumber = parseFloat(String(data.promedio));
        setTasaBcv(Number.isFinite(rateNumber) ? rateNumber.toFixed(3) : String(data.promedio));
      }
    } catch {
      alert('Error obteniendo tasa BCV.');
    } finally {
      setLoadingBcv(false);
    }
  };

  useEffect(() => {
    if ((mode === 'admin' && userRole === 'Administrador') || (mode === 'owner' && userRole === 'Propietario')) {
      fetchCuentas();
      fetchFondos();
    }
  }, [mode, userRole, ownerCondominioId]);

  useEffect(() => {
    fetchMovimientos(selectedCuenta);
  }, [selectedCuenta, mode, ownerCondominioId]);

  useEffect(() => {
    if (mode !== 'owner') return;
    void fetchCortesOwner(selectedCuenta, ownerFiltroAnio, ownerFiltroMes);
  }, [mode, selectedCuenta, ownerCondominioId, ownerFiltroAnio, ownerFiltroMes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [fechaDesde, fechaHasta, selectedCuenta, movimientos.length, activeTab, searchTerm, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    setActiveTab('cuenta');
  }, [selectedCuenta, mode]);

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
  const saldoCuentaUsdActual = useMemo(
    () =>
      fondosCuenta.reduce((acc, f) => {
        const saldo = toNumber(f.saldo_actual);
        if (String(f.moneda).toUpperCase() === 'USD') return acc + saldo;
        if (String(f.moneda).toUpperCase() === 'BS' && tasaBcvNum > 0) return acc + (saldo / tasaBcvNum);
        return acc;
      }, 0),
    [fondosCuenta, tasaBcvNum]
  );

  const saldoCuentaBsActual = useMemo(
    () =>
      fondosCuenta.reduce((acc, f) => {
        const saldo = toNumber(f.saldo_actual);
        return String(f.moneda).toUpperCase() === 'BS' ? acc + saldo : acc;
      }, 0),
    [fondosCuenta]
  );

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

  const movimientosCuentaConsolidados = useMemo(() => {
    const movimientosDirectos: IMovimiento[] = [];
    const ingresosPorPago = new Map<string, IMovimiento[]>();
    const ingresosPorAjuste = new Map<string, IMovimiento[]>();
    const getFechaRegistroGrupo = (grupo: IMovimiento[]): string => {
      const candidatas = grupo
        .map((item) => String(item.fecha_registro ?? '').trim())
        .filter(Boolean);
      if (candidatas.length === 0) return '';
      return candidatas.sort((a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0))[0] || '';
    };

    movimientosFiltrados.forEach((mov) => {
      const pagoId = mov.pago_id ? String(mov.pago_id) : '';
      const concepto = String(mov.concepto || '');
      const esDistribucionPorFondo = /-\s*Fondo:\s*/i.test(concepto);
      const pagoMatchLegacy = concepto.match(/Pago de Recibo #(\d+)/i);
      const pagoMatchRef = concepto.match(/Pago Ref:\s*([^\s|]+)/i);
      const pagoClave = pagoId || (pagoMatchLegacy?.[1] || '') || (pagoMatchRef?.[1] || '');

      if (mov.tipo === 'INGRESO' && esDistribucionPorFondo && pagoClave) {
        const groupKey = `pago-${pagoClave}`;
        const grupo = ingresosPorPago.get(groupKey) || [];
        grupo.push(mov);
        ingresosPorPago.set(groupKey, grupo);
        return;
      }

      const rawId = String(mov.id || '');
      const referencia = String(mov.referencia || '').trim();
      const esAjusteDistribuido = mov.tipo === 'INGRESO'
        && /^ING-MF-\d+$/i.test(rawId)
        && !mov.pago_id
        && /ajuste/i.test(concepto)
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
      const montoBsOriginal = grupo
        .map((item) => toNumber(item.monto_origen_pago))
        .find((valor) => valor > 0) || 0;
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
        monto_bs: Number((montoBsOriginal > 0 ? montoBsOriginal : montoBsTotal).toFixed(2)),
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

    return [...movimientosDirectos, ...ingresosConsolidados, ...ajustesConsolidados].sort((a, b) => {
      const ordenA = getExecutionOrder(a);
      const ordenB = getExecutionOrder(b);
      if (ordenA !== ordenB) return ordenB - ordenA;
      const fechaA = new Date(a.fecha || '').getTime();
      const fechaB = new Date(b.fecha || '').getTime();
      if (fechaA !== fechaB) return fechaB - fechaA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [movimientosFiltrados]);

  const movimientosBasePorVista = useMemo(() => {
    if (activeTab === 'cuenta') return movimientosCuentaConsolidados;
    if (activeTab === 'sin-fondo') {
      return movimientosFiltrados.filter((movimiento) => {
        const hasFondoId = toNullableInt((movimiento as { fondo_id?: unknown }).fondo_id) !== null;
        const hasFondoOrigen = toNullableInt((movimiento as { fondo_origen_id?: unknown }).fondo_origen_id) !== null;
        const hasFondoDestino = toNullableInt((movimiento as { fondo_destino_id?: unknown }).fondo_destino_id) !== null;
        return !hasFondoId && !hasFondoOrigen && !hasFondoDestino;
      });
    }

    const fondoId = parseInt(activeTab.replace('fondo-', ''), 10);
    if (!Number.isFinite(fondoId)) return [];
    const fondoActivo = fondosCuenta.find((f) => parseInt(String(f.id), 10) === fondoId);
    const fondoNombreNorm = String(fondoActivo?.nombre || '').trim().toLowerCase();
    return movimientosFiltrados.filter((movimiento) => {
      const movFondo = toNullableInt((movimiento as { fondo_id?: unknown }).fondo_id);
      const movOrigen = toNullableInt((movimiento as { fondo_origen_id?: unknown }).fondo_origen_id);
      const movDestino = toNullableInt((movimiento as { fondo_destino_id?: unknown }).fondo_destino_id);
      if (movFondo === fondoId || movOrigen === fondoId || movDestino === fondoId) return true;
      const movFondoNombre = String((movimiento as { fondo_nombre?: unknown }).fondo_nombre || '').trim().toLowerCase();
      return Boolean(fondoNombreNorm) && Boolean(movFondoNombre) && movFondoNombre === fondoNombreNorm;
    });
  }, [movimientosFiltrados, activeTab, fondosCuenta, movimientosCuentaConsolidados]);

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
      const inmueble = getInmuebleTexto(mov).toLowerCase();
      const referencia = String(mov.referencia || '').toLowerCase();
      const montoUsd = toNumber(mov.monto_usd);
      const montoBs = toNumber(mov.monto_bs);
      const montoRaw = `${montoUsd.toFixed(2)} ${montoBs.toFixed(2)}`.toLowerCase();
      const montoFmt = `${formatCurrency(montoUsd)} ${formatCurrency(montoBs)}`.toLowerCase();
      return inmueble.includes(txt) || referencia.includes(txt) || montoRaw.includes(txt) || montoFmt.includes(txt);
    });
  }, [movimientosBasePorVista, searchTerm]);

  const sortedMovimientosPorVista = useMemo(() => {
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
    const getConceptoTexto = (mov: IMovimiento): string => {
      const banco = mov.banco_origen?.trim();
      const cedula = mov.cedula_origen?.trim();
      if (mov.tipo === 'INGRESO' && (banco || cedula)) {
        const extras = [banco ? `Banco: ${banco}` : '', cedula ? `Cédula/RIF: ${cedula}` : ''].filter(Boolean);
        return `${mov.concepto} | ${extras.join(' | ')}`;
      }
      return mov.concepto;
    };

    const getExecutionOrder = (mov: IMovimiento): number => {
      if (mov.pago_id && Number.isFinite(mov.pago_id)) return Number(mov.pago_id);
      const refAjuste = String(mov.referencia || '').match(/^AJ-(\d+)$/i);
      if (refAjuste?.[1]) return Number(refAjuste[1]);
      const raw = String(mov.id || '');
      const matchId = raw.match(/(\d+)/);
      return matchId?.[1] ? Number(matchId[1]) : 0;
    };

    const getSortValue = (mov: IMovimiento, key: SortKey): string | number => {
      if (key === 'ejecucion') return getExecutionOrder(mov);
      if (key === 'fecha') return new Date(mov.fecha || '').getTime() || 0;
      if (key === 'referencia') return String(mov.referencia || '').toLowerCase();
      if (key === 'inmueble') return getInmuebleTexto(mov).toLowerCase();
      if (key === 'descripcion') return getConceptoTexto(mov).toLowerCase();
      if (key === 'monto_bs') return getMontoBsVista(mov);
      if (key === 'cargo') return mov.tipo === 'EGRESO' ? toNumber(mov.monto_usd) : 0;
      if (key === 'abono') return mov.tipo === 'INGRESO' ? toNumber(mov.monto_usd) : 0;
      if (key === 'tasa') return toNumber(mov.tasa_cambio);
      return 0;
    };

    return [...movimientosPorVista].sort((a, b) => {
      const av = getSortValue(a, sortConfig.key);
      const bv = getSortValue(b, sortConfig.key);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortConfig.direction === 'asc' ? av - bv : bv - av;
      }
      const comp = String(av).localeCompare(String(bv), 'es', { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? comp : -comp;
    });
  }, [movimientosPorVista, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedMovimientosPorVista.length / itemsPerPage));
  const movimientosPagina = sortedMovimientosPorVista.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const cuentaActual = cuentas.find((c) => String(c.id) === selectedCuenta);
  const isCuentaUsd = String(cuentaActual?.moneda || '').toUpperCase() === 'USD';
  const saldoUsdEnBs = tasaBcvNum > 0 ? saldoCuentaUsdActual * tasaBcvNum : 0;
  const hasFullDateRange = Boolean(fechaDesde && fechaHasta);

  const resumenFondos = useMemo(
    () => fondosCuenta.map((fondo) => {
      const moneda = String(fondo.moneda || '').toUpperCase();
      const fondoId = toNullableInt(fondo.id);
      const fondoNombreNorm = String(fondo.nombre || '').trim().toLowerCase();

      if (!hasFullDateRange) {
        const saldo = toNumber(fondo.saldo_actual);
        const equivalenteUsd = moneda === 'USD'
          ? saldo
          : (moneda === 'BS' && tasaBcvNum > 0 ? (saldo / tasaBcvNum) : 0);
        return { id: String(fondo.id), nombre: fondo.nombre || `Fondo ${fondo.id}`, moneda, saldo, equivalenteUsd };
      }

      const movimientosFondo = movimientosFiltrados.filter((mov) => {
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

      const saldo = moneda === 'USD' ? netoUsd : netoBs;
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
    [fondosCuenta, hasFullDateRange, movimientosFiltrados, tasaBcvNum]
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

  const fondosDestacados = useMemo(
    () => resumenFondos.slice(0, 2),
    [resumenFondos],
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

  const getMontoBsVista = (movimiento: IMovimiento): number => {
    const montoBs = toNumber(movimiento.monto_bs);
    if (montoBs > 0) return montoBs;
    const tasa = toNumber(movimiento.tasa_cambio);
    const montoUsd = toNumber(movimiento.monto_usd);
    if (tasa > 0 && montoUsd > 0) return montoUsd * tasa;
    return 0;
  };

  const getConceptoVista = (movimiento: IMovimiento): string => {
    const banco = movimiento.banco_origen?.trim();
    const cedula = movimiento.cedula_origen?.trim();
    if (movimiento.tipo === 'INGRESO' && (banco || cedula)) {
      const extras = [banco ? `Banco: ${banco}` : '', cedula ? `Cédula/RIF: ${cedula}` : ''].filter(Boolean);
      return `${movimiento.concepto} | ${extras.join(' | ')}`;
    }
    return movimiento.concepto;
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

  const handleSort = (key: SortKey): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'fecha' || key === 'ejecucion' ? 'desc' : 'asc' };
    });
  };

  const getSortArrow = (key: SortKey): string => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const extractPagoIdForRollback = (movimiento: IMovimiento): string | null => {
    if (movimiento.tipo !== 'INGRESO') return null;
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

  const extractRollbackTarget = (movimiento: IMovimiento): RollbackTarget | null => {
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
      alert('Este movimiento no corresponde a un registro reversible.');
      return;
    }

    const confirmMessage = target.kind === 'pago'
      ? '¿Deseas revertir este pago? Se aplicarán las validaciones contables correspondientes.'
      : '¿Deseas revertir este ajuste? Se aplicarán las validaciones contables correspondientes.';
    const ok = window.confirm(confirmMessage);
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    const rollbackKey = `${target.kind}-${target.id}`;
    setRollbackingKey(rollbackKey);
    try {
      const endpoint = target.kind === 'pago'
        ? `${API_BASE_URL}/pagos/${target.id}/rollback`
        : `${API_BASE_URL}/movimientos-fondos/${target.id}/rollback-ajuste`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        alert(data?.message || data?.error || 'No se pudo revertir el movimiento.');
        return;
      }
      await Promise.all([fetchMovimientos(selectedCuenta), fetchFondos()]);
      alert(data?.message || (target.kind === 'pago' ? 'Pago revertido correctamente.' : 'Ajuste revertido correctamente.'));
    } catch {
      alert('No se pudo revertir el movimiento por un error de conexión.');
    } finally {
      setRollbackingKey('');
    }
  };

  if (mode === 'admin' && userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  if (mode === 'owner' && userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

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
      <div className="space-y-6 animate-fadeIn">
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
                    {c.nombre_banco || 'Banco'} ({c.apodo || 'Cuenta'})
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-bold">Fecha</th>
                      <th className="p-4 font-bold">Referencia</th>
                      <th className="p-4 font-bold">Descripción</th>
                      <th className="p-4 font-bold text-right">Monto (Bs)</th>
                      <th className="p-4 font-bold text-right">Cargo ($)</th>
                      <th className="p-4 font-bold text-right">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerEgresosFondo.map((mov) => (
                      <tr key={String(mov.id)} className="border-b border-gray-50 dark:border-gray-800/50">
                        <td className="p-4 font-mono text-gray-600 dark:text-gray-400 text-xs">{formatFecha(mov.fecha)}</td>
                        <td className="p-4 font-mono text-xs text-gray-500">{mov.referencia || '-'}</td>
                        <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{mov.concepto || '-'}</td>
                        <td className="p-4 text-right font-black font-mono">Bs {formatCurrency(getMontoBsVista(mov))}</td>
                        <td className="p-4 text-right font-black font-mono text-red-600 dark:text-red-400">-{formatCurrency(mov.monto_usd)}</td>
                        <td className="p-4 text-right font-mono text-xs text-blue-600 dark:text-blue-400">{mov.tasa_cambio ? formatCurrency(mov.tasa_cambio) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ownerEgresosFondo.length === 0 && (
                <p className="text-center text-gray-400 py-10 font-medium">No hay egresos en el fondo seleccionado.</p>
              )}
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-bold">Fondo</th>
                      <th className="p-4 font-bold">Banco</th>
                      <th className="p-4 font-bold text-right">Saldo (Bs)</th>
                      <th className="p-4 font-bold text-right">Saldo (USD)</th>
                      <th className="p-4 font-bold text-right">Tasa Ref.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerCortesFiltrados.map((corte) => (
                      <tr key={corte.id} className="border-b border-gray-50 dark:border-gray-800/50">
                        <td className="p-4 font-semibold text-gray-800 dark:text-gray-200">{corte.nombre_fondo}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400">{corte.nombre_banco || 'Cuenta'} ({corte.apodo_cuenta || '-'})</td>
                        <td className="p-4 text-right font-black font-mono">Bs {formatCurrency(corte.saldo_bs)}</td>
                        <td className="p-4 text-right font-black font-mono">$ {formatCurrency(corte.saldo_usd)}</td>
                        <td className="p-4 text-right text-blue-600 dark:text-blue-400 font-mono">{corte.tasa_referencia ? formatCurrency(corte.tasa_referencia) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ownerCortesFiltrados.length === 0 && (
                <p className="text-center text-gray-400 py-10 font-medium">No hay cortes mensuales para el período seleccionado.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
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
                {c.nombre_banco || 'Banco'} ({c.apodo || 'Cuenta'})
              </option>
            ))}
          </select>
          {mode === 'admin' && (
            <>
              <button
                onClick={() => setShowTransfModal(true)}
                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Transferir
              </button>
              <button
                onClick={() => setShowEgresoModal(true)}
                className="h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                Egreso
              </button>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Saldo equivalente USD</p>
          <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">${formatCurrency(saldoCuentaUsdActual)}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Saldo en bolívares</p>
          <p className="mt-2 text-4xl font-black text-gray-900 dark:text-white">Bs {formatCurrency(saldoCuentaBsActual)}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Total ingresos</p>
          <p className="mt-2 text-4xl font-black text-emerald-600 dark:text-emerald-400">+${formatCurrency(totalIngresosUsd)}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Total egresos</p>
          <p className="mt-2 text-4xl font-black text-red-600 dark:text-red-400">-${formatCurrency(totalEgresosUsd)}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Tasa BCV</p>
          <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">{tasaBcvNum > 0 ? formatRate(tasaBcvNum) : '-'}</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Bs por USD</p>
          <button
            type="button"
            onClick={fetchBCV}
            disabled={loadingBcv}
            className="mt-4 h-10 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {loadingBcv ? 'Actualizando...' : 'Actualizar'}
          </button>
        </article>

        {fondosDestacados.map((fondo) => (
          <article key={fondo.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">{fondo.nombre}</p>
            <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">
              {fondo.moneda === 'USD' ? '$' : 'Bs'} {formatCurrency(fondo.saldo)}
            </p>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">≈ ${formatCurrency(fondo.equivalenteUsd)} USD</p>
          </article>
        ))}
      </section>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-gray-800 dark:text-white">Libro Mayor</h3>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                {cuentaActual ? `${cuentaActual.nombre_banco || 'Banco'} (${cuentaActual.apodo || 'Cuenta'})` : 'Sin cuenta'}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-2 xl:justify-end">
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Desde</label>
                <DatePicker
                  selected={ymdToDate(fechaDesde)}
                  onChange={(date: Date | Date[] | null) => setFechaDesde(dateToYmd(toSingleDate(date)))}
                  selectsStart
                  startDate={ymdToDate(fechaDesde)}
                  endDate={ymdToDate(fechaHasta)}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={es}
                  placeholderText="Desde (dd/mm/yyyy)"
                  showIcon
                  toggleCalendarOnIconClick
                  wrapperClassName="w-full min-w-0"
                  popperClassName="habioo-datepicker-popper"
                  calendarClassName="habioo-datepicker-calendar"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 pr-10 text-xs outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Hasta</label>
                <DatePicker
                  selected={ymdToDate(fechaHasta)}
                  onChange={(date: Date | Date[] | null) => setFechaHasta(dateToYmd(toSingleDate(date)))}
                  selectsEnd
                  startDate={ymdToDate(fechaDesde)}
                  endDate={ymdToDate(fechaHasta)}
                  {...(ymdToDate(fechaDesde) ? { minDate: ymdToDate(fechaDesde) as Date } : {})}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={es}
                  placeholderText="Hasta (dd/mm/yyyy)"
                  showIcon
                  toggleCalendarOnIconClick
                  wrapperClassName="w-full min-w-0"
                  popperClassName="habioo-datepicker-popper"
                  calendarClassName="habioo-datepicker-calendar"
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

          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2">
            Doble clic en un movimiento para ver el detalle completo.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-10">Generando estado de cuenta...</p>
        ) : movimientosPorVista.length === 0 ? (
          <p className="text-center text-gray-400 py-10 font-medium">No hay movimientos registrados en esta cuenta.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ fontSize: `${tableFontSizePx}px` }}>
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-bold">
                    <button type="button" onClick={() => handleSort('fecha')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Fecha <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('fecha')}</span>
                    </button>
                  </th>
                  <th className="p-4 font-bold">
                    <button type="button" onClick={() => handleSort('referencia')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Referencia <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('referencia')}</span>
                    </button>
                  </th>
                  <th className="p-4 font-bold">
                    <button type="button" onClick={() => handleSort('inmueble')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Inmueble <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('inmueble')}</span>
                    </button>
                  </th>
                  <th className="p-4 font-bold">
                    <button type="button" onClick={() => handleSort('descripcion')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Descripción <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('descripcion')}</span>
                    </button>
                  </th>
                  {!isCuentaUsd && (
                    <th className="p-4 font-bold text-right">
                      <button type="button" onClick={() => handleSort('monto_bs')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                        Monto (Bs) <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('monto_bs')}</span>
                      </button>
                    </th>
                  )}
                  <th className="p-4 font-bold text-right">
                    <button type="button" onClick={() => handleSort('cargo')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Cargo ($) <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('cargo')}</span>
                    </button>
                  </th>
                  <th className="p-4 font-bold text-right">
                    <button type="button" onClick={() => handleSort('abono')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                      Abono ($) <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('abono')}</span>
                    </button>
                  </th>
                  {!isCuentaUsd && (
                    <th className="p-4 font-bold text-right">
                      <button type="button" onClick={() => handleSort('tasa')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                        Tasa (Bs.) <span style={{ fontSize: `${tableMetaFontPx}px` }}>{getSortArrow('tasa')}</span>
                      </button>
                    </th>
                  )}
                  {mode === 'admin' && <th className="p-4 font-bold text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {movimientosPagina.map((movimiento) => {
                  const montoBsVista = getMontoBsVista(movimiento);
                  const rollbackTarget = extractRollbackTarget(movimiento);
                  const rollbackButtonKey = rollbackTarget ? `${rollbackTarget.kind}-${rollbackTarget.id}` : '';
                  return (
                    <tr
                      key={String(movimiento.id)}
                      onDoubleClick={() => setMovimientoDetalle(movimiento)}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <span className="block font-mono font-bold text-gray-800 dark:text-gray-200" style={{ fontSize: `${tableCompactFontPx}px` }}>
                          <span className="font-bold text-gray-400 uppercase mr-1" style={{ fontSize: `${tableTagFontPx}px` }}>pago</span>{formatFecha(movimiento.fecha)}
                        </span>
                        {movimiento.fecha_registro && (
                          <span className="block font-mono text-gray-400 mt-0.5" style={{ fontSize: `${tableMetaFontPx}px` }}>
                            <span className="font-bold text-gray-400 uppercase mr-1" style={{ fontSize: `${tableTagFontPx}px` }}>sistema</span>{formatFecha(movimiento.fecha_registro)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-500" style={{ fontSize: `${tableCompactFontPx}px` }}>{movimiento.referencia || '-'}</td>
                      <td className="p-4 font-semibold text-gray-700 dark:text-gray-300" style={{ fontSize: `${tableCompactFontPx}px` }}>{getInmuebleVista(movimiento)}</td>
                      <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{getConceptoVista(movimiento)}</td>
                      {!isCuentaUsd && (
                        <td className="p-4 text-right font-black font-mono text-slate-700 dark:text-slate-200">
                          {montoBsVista > 0 ? `Bs ${formatCurrency(montoBsVista)}` : '-'}
                        </td>
                      )}
                      <td className="p-4 text-right font-black font-mono">
                        {movimiento.tipo === 'EGRESO' ? (
                          <span className="text-red-600 dark:text-red-400">-{formatCurrency(movimiento.monto_usd)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-black font-mono">
                        {movimiento.tipo === 'INGRESO' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(movimiento.monto_usd)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {!isCuentaUsd && (
                        <td className="p-4 text-right font-mono text-blue-600 dark:text-blue-400" style={{ fontSize: `${tableCompactFontPx}px` }}>
                          {movimiento.tasa_cambio ? formatCurrency(movimiento.tasa_cambio) : '-'}
                        </td>
                      )}
                      {mode === 'admin' && (
                        <td className="p-4 text-center">
                          {rollbackTarget ? (
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
                                : 'Disponible para reversión (sujeto a validaciones contables).'}
                            >
                              {rollbackingKey === rollbackButtonKey ? 'Revirtiendo...' : 'Revertir'}
                            </button>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && movimientosPorVista.length > 0 && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              ← Anterior
            </button>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {mode === 'admin' && showTransfModal && (
        <ModalTransferencia
          onClose={() => setShowTransfModal(false)}
          onSuccess={() => {
            setShowTransfModal(false);
            fetchMovimientos(selectedCuenta);
            fetchFondos();
          }}
        />
      )}

      {mode === 'admin' && showEgresoModal && (
        <ModalRegistrarEgreso
          initialCuentaId={selectedCuenta}
          onClose={() => setShowEgresoModal(false)}
          onSuccess={() => {
            setShowEgresoModal(false);
            fetchMovimientos(selectedCuenta);
            fetchFondos();
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
    </div>
  );
};

export default EstadoCuentaBancariaView;
