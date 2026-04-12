import { useState, useEffect } from 'react';
import type { FC, ChangeEvent } from 'react';
import DropdownMenu from '../components/ui/DropdownMenu';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { toYmdVE } from '../utils/datetime';
import { API_BASE_URL } from '../config/api';
import ModalBase from '../components/ui/ModalBase';
import DataTable from '../components/ui/DataTable';
import HabiooLoader from '../components/ui/HabiooLoader';
import ModalRegistrarPago from '../components/ModalRegistrarPago';
import { ModalEstadoCuenta } from '../components/propiedades/PropiedadesModals';
import FormField from '../components/ui/FormField';
import DatePicker from '../components/ui/DatePicker';

interface CuentasPorCobrarProps { }

interface OutletContextType {
  userRole?: string;
  condominioTipo?: string;
}

type ActiveTab = 'Deudores' | 'Todos';

interface Propiedad {
  id: number;
  identificador?: string;
  alicuota?: string | number;
  prop_nombre?: string;
  prop_cedula?: string;
  saldo_actual?: string | number;
  inq_nombre?: string;
}

interface EstadoCuentaMovimientoRaw {
  fecha_registro?: string;
  fecha_operacion?: string;
  tipo?: string;
  concepto?: string;
  monto_bs?: string | number;
  tasa_cambio?: string | number;
  cargo?: string | number;
  abono?: string | number;
  [key: string]: unknown;
}

interface EstadoCuentaMovimientoConSaldo {
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

interface EstadoCuentaPropCuenta {
  id: number;
  identificador: string;
  prop_nombre: string;
  inq_nombre?: string;
  [key: string]: unknown;
}

interface PropiedadPreseleccionadaPago {
  id: number;
  identificador: string;
  saldo_actual: string | number;
}

interface PropiedadesResponse {
  status: string;
  propiedades?: Propiedad[];
}

interface EstadoCuentaResponse {
  status: string;
  movimientos?: EstadoCuentaMovimientoRaw[];
}

interface BcvApiResponse {
  promedio?: string | number;
}

interface ApiActionResponse {
  status?: string;
  message?: string;
  error?: string;
}

interface PagoPendienteAprobacion {
  id: number;
  propiedad_id: number;
  recibo_id: number | null;
  identificador: string;
  propietario?: string | null;
  monto_origen?: string | number | null;
  monto_usd?: string | number | null;
  moneda?: string | null;
  referencia?: string | null;
  fecha_pago?: string | null;
  estado: string;
  nota?: string | null;
  metodo?: string | null;
  banco_origen?: string | null;
  cedula_origen?: string | null;
  telefono_origen?: string | null;
  es_ajuste_historico?: boolean;
}

interface PagosPendientesResponse {
  status: string;
  message?: string;
  pagos?: PagoPendienteAprobacion[];
}

interface JuntaGeneralResumenRow {
  miembro_id: number;
  nombre_junta_individual: string;
  rif: string;
  vinculada: boolean;
  condominio_individual_id: number | null;
  cuota_participacion: number;
  saldo_usd_generado: number;
  saldo_usd_pagado: number;
  saldo_usd_pendiente: number;
  porcentaje_morosidad: number;
  estado_cuenta: string;
}

interface JuntaGeneralMetricas {
  total_juntas: number;
  total_vinculadas: number;
  total_usd_generado: number;
  total_usd_pagado: number;
  total_usd_pendiente: number;
  porcentaje_morosidad_global: number;
}

interface JuntaGeneralResumenResponse {
  status: string;
  data?: {
    juntas?: JuntaGeneralResumenRow[];
    metricas?: JuntaGeneralMetricas;
  };
  message?: string;
}

interface PendingCountMap {
  [propiedadId: number]: number;
}

interface GastoExtraOption {
  id: number | string;
  concepto?: string | null;
  deuda_restante?: string | number | null;
}

interface DesvioPagoDraft {
  enabled: boolean;
  items: Array<{
    id: string;
    gastoExtraId: string;
    montoBs: string;
  }>;
}

type DesvioPagoDraftMap = Record<number, DesvioPagoDraft>;

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;
const inferBancoMoneda = (cuenta: any): 'USD' | 'BS' => {
  // El tipo tiene prioridad para tipos que implican claramente una moneda
  const tipo = String(cuenta?.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isStrongUsd = tipo === 'zelle' || tipo === 'efectivo usd' || tipo === 'transferencia internacional'
    || tipo.includes('usd') || tipo.includes('zelle') || tipo.includes('internacional');
  if (isStrongUsd) return 'USD';
  const isStrongBs = tipo === 'transferencia' || tipo === 'deposito' || tipo === 'pago movil'
    || tipo === 'efectivo bs' || tipo.includes('movil') || tipo.includes('transferencia');
  if (isStrongBs) return 'BS';
  // Para tipos ambiguos, usar el campo almacenado en BD
  const stored = String(cuenta?.moneda || '').toUpperCase();
  if (stored === 'USD') return 'USD';
  if (stored === 'BS') return 'BS';
  // Último recurso: inferir del nombre/apodo
  const text = `${String(cuenta?.apodo || '')} ${String(cuenta?.nombre_banco || '')}`.toUpperCase();
  return text.includes('USD') || text.includes('ZELLE') ? 'USD' : 'BS';
};

const getCuentaLabel = (cuenta: any): string => {
  const nombreBanco = String(cuenta?.nombre_banco || cuenta?.nombre || '').trim();
  const apodo = String(cuenta?.apodo || '').trim();
  const tipo = String(cuenta?.tipo || '').trim();
  const numeroCuenta = String(cuenta?.numero_cuenta || '').trim();
  const moneda = String(cuenta?.moneda || '').trim().toUpperCase();

  const tituloBase = nombreBanco || apodo || tipo || `Cuenta #${String(cuenta?.id || '')}`;
  const descriptor = apodo && apodo !== tituloBase ? apodo : (tipo && tipo !== tituloBase ? tipo : '');
  const detalle = numeroCuenta || (moneda ? `Moneda ${moneda}` : '');
  const partes = [tituloBase, descriptor, detalle].filter(Boolean);

  return partes.join(' - ');
};

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

const toYmdLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ymdToDateLocal = (ymd: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [yPart, mPart, dPart] = ymd.split('-');
  const y = Number(yPart);
  const m = Number(mPart);
  const d = Number(dPart);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const CuentasPorCobrar: FC<CuentasPorCobrarProps> = () => {
  const { userRole, condominioTipo } = useOutletContext<OutletContextType>();
  const isJuntaGeneral = String(condominioTipo || '').trim().toLowerCase() === 'junta general';
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [juntasResumen, setJuntasResumen] = useState<JuntaGeneralResumenRow[]>([]);
  const [metricasGeneral, setMetricasGeneral] = useState<JuntaGeneralMetricas | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Nuevo estado para las pestanas
  const [activeTab, setActiveTab] = useState<ActiveTab>('Deudores');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 13;

  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [selectedPropPago, setSelectedPropPago] = useState<PropiedadPreseleccionadaPago | null>(null);

  const [estadoCuentaModalOpen, setEstadoCuentaModalOpen] = useState<boolean>(false);
  const [selectedPropCuenta, setSelectedPropCuenta] = useState<EstadoCuentaPropCuenta | null>(null);
  const [estadoCuentaData, setEstadoCuentaData] = useState<EstadoCuentaMovimientoRaw[]>([]);
  const [loadingCuenta, setLoadingCuenta] = useState<boolean>(false);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [showAjusteModal, setShowAjusteModal] = useState<boolean>(false);
  const [selectedPropAjuste, setSelectedPropAjuste] = useState<Propiedad | null>(null);
  const [ajusteTipo, setAjusteTipo] = useState<'DEUDA' | 'FAVOR'>('DEUDA');
  const [montoBsAjuste, setMontoBsAjuste] = useState<string>('');
  const [tasaBcvAjuste, setTasaBcvAjuste] = useState<string>('');
  const [conceptoAjuste, setConceptoAjuste] = useState<string>('');
  const [fechaOperacionAjuste, setFechaOperacionAjuste] = useState<string>(toYmdLocal(new Date()));
  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const [isSavingAjuste, setIsSavingAjuste] = useState<boolean>(false);
  const [showAprobacionModal, setShowAprobacionModal] = useState<boolean>(false);
  const [selectedPropAprobacion, setSelectedPropAprobacion] = useState<Propiedad | null>(null);
  const [pagosPendientes, setPagosPendientes] = useState<PagoPendienteAprobacion[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState<boolean>(false);
  const [decisionLoadingId, setDecisionLoadingId] = useState<number | null>(null);
  const [rechazoDraft, setRechazoDraft] = useState<Record<number, string>>({});
  const [pendingByPropiedad, setPendingByPropiedad] = useState<PendingCountMap>({});
  const [rejectingPagoId, setRejectingPagoId] = useState<number | null>(null);
  const [destinoIngreso, setDestinoIngreso] = useState<'CUENTA' | 'EXTRA' | 'SOLO_INMUEBLE'>('CUENTA');
  const [subtipoFavor, setSubtipoFavor] = useState<'directo' | 'distribuido'>('directo');
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [gastosExtras, setGastosExtras] = useState<GastoExtraOption[]>([]);
  const [gastoExtraSeleccionado, setGastoExtraSeleccionado] = useState<string>('');
  const [desvioPagoDraft, setDesvioPagoDraft] = useState<DesvioPagoDraftMap>({});
  const [monedaAjuste, setMonedaAjuste] = useState<'USD' | 'BS'>('USD');
  const [montoUsdDirecto, setMontoUsdDirecto] = useState<string>('');

  const fetchGastosExtras = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/gastos-extras-procesados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        const gastos = Array.isArray(data.gastos) ? data.gastos : [];
        setGastosExtras(gastos);
        if (gastos.length > 0) {
          setGastoExtraSeleccionado(String(gastos[0].id));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCuentasBancarias = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/bancos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCuentasBancarias(data.bancos || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const esUsdDirecto = ajusteTipo === 'FAVOR' && monedaAjuste === 'USD';
  const montoUsdAjuste = esUsdDirecto
    ? parseNumberInput(montoUsdDirecto)
    : (parseNumberInput(tasaBcvAjuste) > 0
        ? (parseNumberInput(montoBsAjuste) / parseNumberInput(tasaBcvAjuste))
        : 0);
  const cuentaPrincipal = cuentasBancarias.find((c: any) => c.es_predeterminada) ?? null;

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: PropiedadesResponse = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneralResumen = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/resumen`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: JuntaGeneralResumenResponse = await res.json();
      if (res.ok && data.status === 'success') {
        setJuntasResumen(Array.isArray(data.data?.juntas) ? data.data?.juntas || [] : []);
        setMetricasGeneral(data.data?.metricas || null);
      } else {
        setJuntasResumen([]);
        setMetricasGeneral(null);
      }
    } catch (error) {
      console.error(error);
      setJuntasResumen([]);
      setMetricasGeneral(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCounts = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/pagos/pendientes-aprobacion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: PagosPendientesResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setPendingByPropiedad({});
        return;
      }
      const rows = Array.isArray(data.pagos) ? data.pagos : [];
      const grouped: PendingCountMap = {};
      rows.forEach((p: PagoPendienteAprobacion) => {
        grouped[p.propiedad_id] = (grouped[p.propiedad_id] || 0) + 1;
      });
      setPendingByPropiedad(grouped);
    } catch {
      setPendingByPropiedad({});
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') {
      if (isJuntaGeneral) {
        fetchGeneralResumen();
      } else {
        fetchData();
        fetchPendingCounts();
        fetchCuentasBancarias();
        fetchGastosExtras();
      }
    }
  }, [userRole, isJuntaGeneral]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]); // Resetea la paginacion si cambia el buscador o la pestana

  const handleOpenRegistrarPago = (prop: Propiedad): void => {
    setSelectedPropPago({
      id: prop.id,
      identificador: prop.identificador || '',
      saldo_actual: prop.saldo_actual ?? 0,
    });
    setShowPayModal(true);
  };

  const fetchEstadoCuenta = async (propId: number): Promise<void> => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${propId}/estado-cuenta`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: EstadoCuentaResponse = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCuenta(false);
    }
  };

  const handleOpenEstadoCuenta = (prop: Propiedad): void => {
    const baseProp: EstadoCuentaPropCuenta = {
      id: prop.id,
      identificador: prop.identificador || '',
      prop_nombre: prop.prop_nombre || 'Sin asignar',
    };
    if (prop.inq_nombre) baseProp.inq_nombre = prop.inq_nombre;
    setSelectedPropCuenta(baseProp);
    setFechaDesde('');
    setFechaHasta('');
    fetchEstadoCuenta(prop.id);
    setEstadoCuentaModalOpen(true);
  };

  const handleOpenAjuste = (prop: Propiedad): void => {
    setSelectedPropAjuste(prop);
    setAjusteTipo('DEUDA');
    setMontoBsAjuste('');
    setTasaBcvAjuste('');
    setConceptoAjuste('');
    setFechaOperacionAjuste(toYmdLocal(new Date()));
    setDestinoIngreso('CUENTA');
    setMonedaAjuste('USD');
    setMontoUsdDirecto('');
    if (gastosExtras.length > 0) {
      const primerGasto = gastosExtras[0];
      if (primerGasto) setGastoExtraSeleccionado(String(primerGasto.id));
    }
    setShowAjusteModal(true);
  };

  const fetchPagosPendientes = async (propiedadId: number): Promise<void> => {
    setLoadingPendientes(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/pagos/pendientes-aprobacion?propiedad_id=${propiedadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: PagosPendientesResponse = await res.json();
      if (res.ok && data.status === 'success') {
        setPagosPendientes(Array.isArray(data.pagos) ? data.pagos : []);
      } else {
        setPagosPendientes([]);
      }
    } catch {
      setPagosPendientes([]);
    } finally {
      setLoadingPendientes(false);
    }
  };

  const handleOpenAprobaciones = (prop: Propiedad): void => {
    setSelectedPropAprobacion(prop);
    setRechazoDraft({});
    setDesvioPagoDraft({});
    setRejectingPagoId(null);
    setShowAprobacionModal(true);
    void fetchGastosExtras();
    void fetchPagosPendientes(prop.id);
  };

  const aprobarPagoPendiente = async (pago: PagoPendienteAprobacion): Promise<void> => {
    const pagoId = pago.id;
    const draft = desvioPagoDraft[pagoId] || { enabled: false, items: [] };
    const montoPagoUsd = Math.max(
      0,
      toNumber(pago.monto_usd) || (String(pago.moneda || '').toUpperCase() === 'USD' ? toNumber(pago.monto_origen) : 0)
    );
    const monedaPago = String(pago.moneda || '').toUpperCase();
    const tasaEfectiva = monedaPago === 'BS'
      ? (montoPagoUsd > 0 ? (toNumber(pago.monto_origen) / montoPagoUsd) : 0)
      : 1;
    const desviosPayload = draft.enabled
      ? draft.items
          .map((item) => {
            const montoBs = parseNumberInput(item.montoBs);
            const montoUsd = tasaEfectiva > 0 ? (montoBs / tasaEfectiva) : 0;
            return {
              gasto_extra_id: item.gastoExtraId ? Number(item.gastoExtraId) : null,
              monto_desvio_bs: montoBs > 0 ? Number(montoBs.toFixed(2)) : null,
              monto_desvio_usd: montoUsd > 0 ? Number(montoUsd.toFixed(2)) : null,
            };
          })
          .filter((item) => Number(item.gasto_extra_id) > 0 && Number(item.monto_desvio_usd) > 0)
      : [];
    const montoDesvioUsdNum = desviosPayload.reduce((acc, item) => acc + Number(item.monto_desvio_usd || 0), 0);

    if (draft.enabled) {
      if (!desviosPayload.length) {
        alert('Agregue al menos una fila de desvío válida.');
        return;
      }
      if (tasaEfectiva <= 0) {
        alert('No se puede convertir desvíos en Bs porque la tasa del pago no es válida.');
        return;
      }
      if (montoDesvioUsdNum > montoPagoUsd) {
        alert('El monto a desviar no puede ser mayor al monto total del pago.');
        return;
      }
    }

    setDecisionLoadingId(pagoId);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/pagos/${pagoId}/validar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          gasto_extra_id: draft.enabled && desviosPayload[0] ? Number(desviosPayload[0].gasto_extra_id) : null,
          monto_desvio_usd: draft.enabled && desviosPayload[0] ? Number(desviosPayload[0].monto_desvio_usd) : null,
          desvios_gastos: draft.enabled ? desviosPayload : null,
        })
      });
      const data: ApiActionResponse = await res.json();
      if (!res.ok) {
        alert(data.error || data.message || 'No se pudo aprobar el pago.');
        return;
      }
      if (selectedPropAprobacion?.id) {
        await fetchPagosPendientes(selectedPropAprobacion.id);
      }
      await fetchData();
      await fetchPendingCounts();
      setRejectingPagoId(null);
    } catch {
      alert('Error al aprobar el pago.');
    } finally {
      setDecisionLoadingId(null);
    }
  };

  const rechazarPagoPendiente = async (pagoId: number): Promise<void> => {
    const nota = String(rechazoDraft[pagoId] || '').trim();
    if (!nota) {
      alert('Debe escribir una nota para rechazar el pago.');
      return;
    }
    setDecisionLoadingId(pagoId);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/pagos/${pagoId}/rechazar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nota })
      });
      const data: ApiActionResponse = await res.json();
      if (!res.ok) {
        alert(data.error || data.message || 'No se pudo rechazar el pago.');
        return;
      }
      if (selectedPropAprobacion?.id) {
        await fetchPagosPendientes(selectedPropAprobacion.id);
      }
      await fetchPendingCounts();
      setRejectingPagoId(null);
    } catch {
      alert('Error al rechazar el pago.');
    } finally {
      setDecisionLoadingId(null);
    }
  };

  const fetchBCVAjuste = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('API Error');
      const json: BcvApiResponse = await response.json();
      if (!json?.promedio) {
        alert('No se pudo obtener la tasa BCV actual.');
        return;
      }
      const rateNumber = parseFloat(String(json.promedio));
      const formattedRate = Number.isFinite(rateNumber) ? rateNumber.toFixed(3).replace('.', ',') : String(json.promedio).replace('.', ',');
      setTasaBcvAjuste(formatNumberInput(formattedRate, 3));
    } catch {
      alert('Error al consultar BCV.');
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const handleGuardarAjuste = async (): Promise<void> => {
    if (!selectedPropAjuste?.id) return;
    const montoUsd = montoUsdAjuste;
    if (esUsdDirecto && montoUsd <= 0) {
      alert('Debe ingresar un monto en USD valido.');
      return;
    }
    if (!esUsdDirecto && montoUsd <= 0) {
      alert('Debe ingresar un monto en Bs y una tasa BCV valida.');
      return;
    }
    if (!fechaOperacionAjuste) {
      alert('Debe seleccionar la fecha de operacion del ajuste.');
      return;
    }
    if (ajusteTipo === 'FAVOR' && destinoIngreso === 'CUENTA' && !cuentaPrincipal) {
      alert('No hay una cuenta bancaria principal configurada. Configure una cuenta principal antes de usar esta operacion.');
      return;
    }
    if (ajusteTipo === 'FAVOR' && destinoIngreso === 'EXTRA' && !gastoExtraSeleccionado) {
      alert('Debe seleccionar el Gasto Extra procesado.');
      return;
    }
    if (ajusteTipo === 'FAVOR' && destinoIngreso === 'EXTRA' && !cuentaPrincipal) {
      alert('No hay una cuenta bancaria marcada como predeterminada. Vaya al perfil de Bancos y configure una cuenta principal antes de usar esta operacion.');
      return;
    }
    setIsSavingAjuste(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const payload = {
        tipo_ajuste: ajusteTipo === 'DEUDA' ? 'CARGAR_DEUDA' : 'AGREGAR_FAVOR',
        monto: Number(montoUsd.toFixed(2)),
        monto_bs: esUsdDirecto ? null : parseNumberInput(montoBsAjuste),
        tasa_cambio: esUsdDirecto ? null : parseNumberInput(tasaBcvAjuste),
        cuenta_bancaria_id: ajusteTipo === 'FAVOR' && (destinoIngreso === 'CUENTA' || destinoIngreso === 'EXTRA') && cuentaPrincipal
            ? Number(cuentaPrincipal.id)
            : null,
        es_gasto_extra: ajusteTipo === 'FAVOR' && destinoIngreso === 'EXTRA',
        gasto_extra_id: ajusteTipo === 'FAVOR' && destinoIngreso === 'EXTRA' ? Number(gastoExtraSeleccionado) : null,
        subtipo_favor: ajusteTipo === 'FAVOR' && destinoIngreso === 'CUENTA' ? subtipoFavor : undefined,
        fecha_operacion: fechaOperacionAjuste,
        nota: esUsdDirecto
          ? `${(conceptoAjuste || 'Ajuste manual').trim()} | [usd_directo:${montoUsd.toFixed(2)}]`
          : `${(conceptoAjuste || 'Ajuste manual').trim()} | [bs_raw:${parseNumberInput(montoBsAjuste).toFixed(2)}] | [tasa_raw:${parseNumberInput(tasaBcvAjuste).toFixed(6)}]`
      };
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${selectedPropAjuste.id}/ajustar-saldo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data: ApiActionResponse = await res.json();
      if (res.ok && data.status === 'success') {
        const ajustePropId = selectedPropAjuste.id;
        setShowAjusteModal(false);
        setSelectedPropAjuste(null);
        await fetchData();
        await fetchPendingCounts();
        if (selectedPropCuenta?.id === ajustePropId) {
          await fetchEstadoCuenta(ajustePropId);
        }
      } else {
        alert(data.error || data.message || 'No se pudo guardar el ajuste.');
      }
    } catch {
      alert('Error de conexion al guardar ajuste.');
    } finally {
      setIsSavingAjuste(false);
    }
  };

  // Logica de filtrado por pestanas
  const baseProperties = activeTab === 'Deudores'
    ? propiedades.filter((p: Propiedad) => {
      const saldo = toNumber(p.saldo_actual);
      const pendientes = Number(pendingByPropiedad[p.id] || 0);
      return saldo > 0 || pendientes > 0;
    })
    : propiedades;

  const filteredProperties = baseProperties.filter(
    (p: Propiedad) =>
      p.identificador?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a: Propiedad, b: Propiedad) => 
    String(a.identificador || '').localeCompare(String(b.identificador || ''), 'es', { numeric: true, sensitivity: 'base' })
  );

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = filteredProperties.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  let saldoAcumulado = 0;
  const dataConSaldo: EstadoCuentaMovimientoConSaldo[] = estadoCuentaData.map((mov: EstadoCuentaMovimientoRaw) => {
    const cargo = toNumber(mov.cargo as string | number | undefined);
    const abono = toNumber(mov.abono as string | number | undefined);
    saldoAcumulado += cargo - abono;
    return {
      fecha_operacion: String(mov.fecha_operacion || ''),
      fecha_registro: String(mov.fecha_registro || ''),
      tipo: String(mov.tipo || ''),
      concepto: String(mov.concepto || ''),
      monto_bs: toNumber(mov.monto_bs as string | number | undefined),
      tasa_cambio: toNumber(mov.tasa_cambio as string | number | undefined),
      cargo,
      abono,
      saldoFila: saldoAcumulado,
    };
  });

  const estadoCuentaFiltrado: EstadoCuentaMovimientoConSaldo[] = dataConSaldo.filter((m: EstadoCuentaMovimientoConSaldo) => {
    if (!fechaDesde && !fechaHasta) return true;
    const movYmd = toYmdVE((m.fecha_operacion as string) || (m.fecha_registro as string));
    if (!movYmd) return false;
    if (fechaDesde && movYmd < fechaDesde) return false;
    if (fechaHasta && movYmd > fechaHasta) return false;
    return true;
  });

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HabiooLoader size="md" message="" className="py-0" />
      </div>
    );
  }

  if (isJuntaGeneral) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-2xl font-black text-gray-800 dark:text-white">Cuentas por Cobrar</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Estado de cuenta entre Junta General y Juntas Individuales (sin detalle de inmuebles).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs font-bold uppercase text-gray-500">Total juntas</p>
              <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{metricasGeneral?.total_juntas || 0}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs font-bold uppercase text-gray-500">USD generado</p>
              <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">${formatMoney(metricasGeneral?.total_usd_generado || 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs font-bold uppercase text-gray-500">USD pagado</p>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">${formatMoney(metricasGeneral?.total_usd_pagado || 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs font-bold uppercase text-gray-500">USD pendiente</p>
              <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">${formatMoney(metricasGeneral?.total_usd_pendiente || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {juntasResumen.length === 0 ? (
            <div className="py-10 text-center text-gray-500 dark:text-gray-400">No hay juntas individuales registradas para mostrar.</div>
          ) : (
            <DataTable
              columns={[
                { key: 'junta', header: 'Junta Individual', className: 'font-semibold text-gray-900 dark:text-white', render: (r) => r.nombre_junta_individual },
                { key: 'rif', header: 'RIF', className: 'font-mono text-gray-700 dark:text-gray-300', render: (r) => r.rif || '-' },
                { key: 'cuota', header: 'Cuota', headerClassName: 'text-right', className: 'text-right font-mono', render: (r) => `${Number(r.cuota_participacion || 0).toFixed(4)}%` },
                { key: 'generado', header: 'Generado USD', headerClassName: 'text-right', className: 'text-right font-mono', render: (r) => `$${formatMoney(r.saldo_usd_generado || 0)}` },
                { key: 'pagado', header: 'Pagado USD', headerClassName: 'text-right', className: 'text-right font-mono text-emerald-600 dark:text-emerald-400', render: (r) => `$${formatMoney(r.saldo_usd_pagado || 0)}` },
                { key: 'pendiente', header: 'Pendiente USD', headerClassName: 'text-right', className: 'text-right font-mono text-red-600 dark:text-red-400', render: (r) => `$${formatMoney(r.saldo_usd_pendiente || 0)}` },
                { key: 'estado', header: 'Estado', className: 'text-xs font-bold', render: (r) => r.estado_cuenta },
              ]}
              data={juntasResumen}
              keyExtractor={(r) => r.miembro_id}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">

        <div className="px-6 pt-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black text-gray-800 dark:text-white">Cuentas por Cobrar</h3>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
              Cobranza de Inmuebles
            </span>
          </div>
          <div className="flex-1 w-full max-w-md relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Buscar inmueble o propietario..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-6 inline-flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('Deudores')}
            className={`py-2.5 px-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'Deudores'
              ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
          >
            ⚠️ Con Deuda Pendiente
          </button>
          <button
            onClick={() => setActiveTab('Todos')}
            className={`py-2.5 px-3 font-bold text-sm rounded-lg transition-all ${activeTab === 'Todos'
              ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
          >
            🏢 Todos los Inmuebles
          </button>
        </div>

        </div>

        {filteredProperties.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {activeTab === 'Deudores' ? '🎉 ¡Genial! No hay inmuebles con deuda pendiente.' : 'No se encontraron inmuebles.'}
            </p>
          </div>
        ) : (
          <DataTable
              columns={[
                {
                  key: 'inmueble',
                  header: 'Inmueble',
                  className: 'font-bold text-gray-800 dark:text-white text-base',
                  render: (p) => p.identificador,
                },
                {
                  key: 'alicuota',
                  header: 'Alícuota',
                  headerClassName: 'text-right',
                  className: 'text-right font-mono text-blue-600 dark:text-blue-400 font-bold',
                  render: (p) => `${String(p.alicuota || 0).replace('.', ',')}%`,
                },
                {
                  key: 'propietario',
                  header: 'Propietario',
                  render: (p) => (
                    <>
                      <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre || 'Sin asignar'}</div>
                      <div className="text-xs text-gray-500">{p.prop_cedula || '-'}</div>
                    </>
                  ),
                },
                {
                  key: 'saldo',
                  header: 'Saldo Actual',
                  headerClassName: 'text-right',
                  className: 'text-right',
                  render: (p) => {
                    const saldo = toNumber(p.saldo_actual);
                    const isDeuda = saldo > 0;
                    const isFavor = saldo < 0;
                    return (
                      <>
                        <div className={`font-black font-mono tracking-tight text-lg ${isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isFavor ? '+' : ''}${formatMoney(Math.abs(saldo))}
                        </div>
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${isDeuda ? 'text-red-400' : isFavor ? 'text-green-400' : 'text-gray-400'}`}>
                          {isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Al Día'}
                        </div>
                      </>
                    );
                  },
                },
                {
                  key: 'notificacion',
                  header: 'Notificación',
                  className: 'text-center',
                  render: (p) => {
                    const pendientes = Number(pendingByPropiedad[p.id] || 0);
                    if (pendientes > 0) {
                      return (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                          Pendiente aprobacion ({pendientes})
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                        Sin pendientes
                      </span>
                    );
                  },
                },
                {
                  key: 'acciones',
                  header: 'Acciones',
                  headerClassName: 'text-center',
                  className: 'text-center',
                  render: (p) => (
                    <DropdownMenu width={208} items={[
                      { label: '📄 Estado de Cuenta', onClick: () => handleOpenEstadoCuenta(p) },
                      { label: '💵 Registrar Pago', onClick: () => handleOpenRegistrarPago(p) },
                      { label: '⚙️ Ajuste', onClick: () => handleOpenAjuste(p) },
                      { label: `⏳ Aprobar pagos${pendingByPropiedad[p.id] ? ` (${pendingByPropiedad[p.id]})` : ''}`, onClick: () => handleOpenAprobaciones(p), disabled: !pendingByPropiedad[p.id] },
                    ]} />
                  ),
                },
              ]}
              data={paginatedProperties}
              keyExtractor={(p) => p.id}
            />
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {showPayModal && (
        <ModalRegistrarPago
          propiedadPreseleccionada={selectedPropPago}
          onClose={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
          }}
          onSuccess={() => {
            setShowPayModal(false);
            setSelectedPropPago(null);
            fetchData();
          }}
        />
      )}

      <ModalEstadoCuenta
        isOpen={estadoCuentaModalOpen}
        selectedPropCuenta={selectedPropCuenta}
        setEstadoCuentaModalOpen={setEstadoCuentaModalOpen}
        selectedPropAjuste={null}
        fechaDesde={fechaDesde}
        setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        setFechaHasta={setFechaHasta}
        handleOpenAjuste={(prop) => {
          const propId = Number((prop as { id?: unknown }).id || 0);
          if (!propId) return;
          handleOpenAjuste({
            id: propId,
            identificador: String(prop.identificador || ''),
            prop_nombre: String(prop.prop_nombre || ''),
            saldo_actual: 0,
            alicuota: 0,
            prop_cedula: '',
          } as Propiedad);
        }}
        loadingCuenta={loadingCuenta}
        estadoCuentaFiltrado={estadoCuentaFiltrado}
        showAjuste={true}
      />

      {showAprobacionModal && selectedPropAprobacion && (
        <ModalBase
          onClose={() => { setShowAprobacionModal(false); setSelectedPropAprobacion(null); setPagosPendientes([]); setRejectingPagoId(null); }}
          title="Aprobación de Pagos"
          subtitle={<>{selectedPropAprobacion.identificador} - {selectedPropAprobacion.prop_nombre || 'Sin propietario'}</>}
          maxWidth="max-w-3xl"
        >

            {loadingPendientes ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6">Cargando pagos pendientes...</p>
            ) : pagosPendientes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6">No hay pagos pendientes de aprobación para este inmueble.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {pagosPendientes.map((pago: PagoPendienteAprobacion) => (
                  <article key={pago.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                    {(() => {
                      const draft: DesvioPagoDraft = desvioPagoDraft[pago.id] || { enabled: false, items: [] };
                      const montoPagoUsd = Math.max(
                        0,
                        toNumber(pago.monto_usd) || (String(pago.moneda || '').toUpperCase() === 'USD' ? toNumber(pago.monto_origen) : 0)
                      );
                      const monedaPago = String(pago.moneda || '').toUpperCase();
                      const tasaEfectiva = monedaPago === 'BS'
                        ? (montoPagoUsd > 0 ? (toNumber(pago.monto_origen) / montoPagoUsd) : 0)
                        : 1;
                      const totalDesvioUsd = draft.items.reduce((acc, item) => {
                        const bs = parseNumberInput(item.montoBs);
                        const usd = tasaEfectiva > 0 ? (bs / tasaEfectiva) : 0;
                        return acc + usd;
                      }, 0);
                      const montoFifoUsd = Math.max(0, montoPagoUsd - totalDesvioUsd);
                      return (
                        <div className="mb-3 rounded-xl border border-blue-100 dark:border-blue-800/40 bg-blue-50/70 dark:bg-blue-900/20 p-3">
                          <button
                            type="button"
                            onClick={() => setDesvioPagoDraft((prev: DesvioPagoDraftMap) => {
                              const nextEnabled = !draft.enabled;
                              const defaultItem = gastosExtras[0]
                                ? [{ id: `${Date.now()}-0`, gastoExtraId: String(gastosExtras[0].id), montoBs: '' }]
                                : [];
                              return {
                                ...prev,
                                [pago.id]: {
                                  enabled: nextEnabled,
                                  items: nextEnabled ? (draft.items.length ? draft.items : defaultItem) : [],
                                },
                              };
                            })}
                            className="text-sm font-bold text-donezo-primary hover:text-donezo-primary/80 transition-colors"
                          >
                            {draft.enabled ? '− Quitar desvío a Gasto Extra' : '+ Asignar parte del pago a un Gasto Extra'}
                          </button>

                          {draft.enabled && (
                            <div className="mt-3 space-y-2">
                              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                <div className="col-span-6">Gasto Extra / Proyecto</div>
                                <div className="col-span-3">Monto Bs</div>
                                <div className="col-span-2">Equiv. USD</div>
                                <div className="col-span-1 text-right">Acción</div>
                              </div>
                              {draft.items.map((item) => {
                                const bs = parseNumberInput(item.montoBs);
                                const usd = tasaEfectiva > 0 ? (bs / tasaEfectiva) : 0;
                                return (
                                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-6">
                                      <select
                                        value={item.gastoExtraId}
                                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setDesvioPagoDraft((prev: DesvioPagoDraftMap) => ({
                                          ...prev,
                                          [pago.id]: {
                                            ...draft,
                                            items: draft.items.map((r) => r.id === item.id ? { ...r, gastoExtraId: e.target.value } : r),
                                          },
                                        }))}
                                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                                      >
                                        <option value="">{gastosExtras.length ? 'Seleccione un gasto...' : 'No hay gastos extras disponibles'}</option>
                                        {gastosExtras.map((g: GastoExtraOption) => (
                                          <option key={String(g.id)} value={String(g.id)}>
                                            {String(g.concepto || `Gasto #${g.id}`)} - Deuda act.: ${formatMoney(toNumber(g.deuda_restante))}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-span-3">
                                      <input
                                        type="text"
                                        value={item.montoBs}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDesvioPagoDraft((prev: DesvioPagoDraftMap) => ({
                                          ...prev,
                                          [pago.id]: {
                                            ...draft,
                                            items: draft.items.map((r) => r.id === item.id ? { ...r, montoBs: formatNumberInput(e.target.value, 2) } : r),
                                          },
                                        }))}
                                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                                        placeholder="0,00"
                                      />
                                    </div>
                                    <div className="col-span-2 text-sm font-black text-emerald-600 dark:text-emerald-400">${formatMoney(usd)}</div>
                                    <div className="col-span-1 text-right">
                                      <button
                                        type="button"
                                        onClick={() => setDesvioPagoDraft((prev: DesvioPagoDraftMap) => ({
                                          ...prev,
                                          [pago.id]: {
                                            ...draft,
                                            items: draft.items.filter((r) => r.id !== item.id),
                                          },
                                        }))}
                                        className="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setDesvioPagoDraft((prev: DesvioPagoDraftMap) => ({
                                    ...prev,
                                    [pago.id]: {
                                      ...draft,
                                      items: [
                                        ...draft.items,
                                        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, gastoExtraId: gastosExtras[0] ? String(gastosExtras[0].id) : '', montoBs: '' },
                                      ],
                                    },
                                  }))}
                                  className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                                >
                                  + Agregar fila
                                </button>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                  Tasa usada: {tasaEfectiva > 0 ? formatMoney(tasaEfectiva, 3) : 'N/A'}
                                </span>
                              </div>
                              <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                {`Si apruebas este pago: $${formatMoney(totalDesvioUsd)} irán a gastos extras y $${formatMoney(montoFifoUsd)} se distribuirán en recibos/fondos.`}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {(() => {
                      const monedaPago = String(pago.moneda || 'USD').toUpperCase() === 'USD' ? 'USD' : 'BS';
                      const montoMostrar = monedaPago === 'USD' ? toNumber(pago.monto_usd) : toNumber(pago.monto_origen);
                      return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p><span className="font-bold">Pago:</span> #{pago.id}</p>
                      <p><span className="font-bold">Ref:</span> {pago.referencia || 'Sin referencia'}</p>
                      <p><span className="font-bold">Monto:</span> {monedaPago === 'USD' ? '$' : 'Bs '} {formatMoney(montoMostrar)}</p>
                      <p><span className="font-bold">Moneda:</span> {monedaPago}</p>
                      <p className={pago.es_ajuste_historico ? 'text-red-600 dark:text-red-300 font-semibold' : ''}>
                        <span className="font-bold">Fecha:</span> {pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : '-'}
                      </p>
                      <p><span className="font-bold">Metodo:</span> {pago.metodo || '-'}</p>
                      <p><span className="font-bold">Banco origen:</span> {pago.banco_origen || '-'}</p>
                      <p><span className="font-bold">Cedula/RIF origen:</span> {pago.cedula_origen || '-'}</p>
                      <p><span className="font-bold">Telefono origen:</span> {pago.telefono_origen || '-'}</p>
                      <p className="md:col-span-2"><span className="font-bold">Nota:</span> {pago.nota || '-'}</p>
                    </div>
                      );
                    })()}
                    {pago.es_ajuste_historico && (
                      <div className="mt-2 inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                        SOLICITUD DE AJUSTE HISTORICO
                      </div>
                    )}

                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={decisionLoadingId === pago.id}
                        onClick={() => aprobarPagoPendiente(pago)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={decisionLoadingId === pago.id}
                        onClick={() => setRejectingPagoId((prev: number | null) => (prev === pago.id ? null : pago.id))}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-50"
                      >
                        {rejectingPagoId === pago.id ? 'Cancelar rechazo' : 'Rechazar'}
                      </button>
                    </div>

                    {rejectingPagoId === pago.id && (
                      <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3">
                        <FormField label={<span className="text-red-700 dark:text-red-300">Motivo de rechazo</span>} required>
                          <textarea
                            value={rechazoDraft[pago.id] || ''}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                              setRechazoDraft((prev) => ({ ...prev, [pago.id]: e.target.value }))
                            }
                            className="w-full p-2.5 rounded-xl border border-red-200 dark:border-red-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-red-400 dark:text-white text-sm"
                            rows={2}
                            placeholder="Ej: El comprobante no coincide con el monto reportado."
                          />
                        </FormField>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            disabled={decisionLoadingId === pago.id}
                            onClick={() => rechazarPagoPendiente(pago.id)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Enviar rechazo del pago
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
        </ModalBase>
      )}

      {showAjusteModal && selectedPropAjuste && (
        <ModalBase
          onClose={() => setShowAjusteModal(false)}
          title="Ajuste de Saldo"
          subtitle={<>{selectedPropAjuste.identificador} - {selectedPropAjuste.prop_nombre || 'Sin asignar'}</>}
          maxWidth="max-w-3xl"
          disableClose={isSavingAjuste}
        >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Tipo:</span>
                <button
                  type="button"
                  onClick={() => setAjusteTipo('DEUDA')}
                  className={`min-h-10 px-4 py-2 rounded-xl text-sm font-bold border ${ajusteTipo === 'DEUDA'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  Deuda
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteTipo('FAVOR')}
                  className={`min-h-10 px-4 py-2 rounded-xl text-sm font-bold border ${ajusteTipo === 'FAVOR'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  A favor
                </button>
              </div>

              {ajusteTipo === 'FAVOR' && (
                <>
                  {/* Selector de moneda */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Moneda:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMonedaAjuste('USD');
                      }}
                      className={`min-h-10 px-4 py-2 rounded-xl text-sm font-bold border ${monedaAjuste === 'USD'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50'
                        : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}
                    >
                      USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMonedaAjuste('BS');
                      }}
                      className={`min-h-10 px-4 py-2 rounded-xl text-sm font-bold border ${monedaAjuste === 'BS'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50'
                        : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}
                    >
                      Bs
                    </button>
                  </div>

                  {/* Destino del ingreso */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="md:col-span-2">
                      <FormField label="Destino del Ingreso">
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="radio"
                              checked={destinoIngreso === 'CUENTA'}
                              onChange={() => setDestinoIngreso('CUENTA')}
                              className="text-donezo-primary focus:ring-donezo-primary"
                            />
                            A cuenta bancaria
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="radio"
                              checked={destinoIngreso === 'EXTRA'}
                              onChange={() => { setDestinoIngreso('EXTRA'); }}
                              className="text-donezo-primary focus:ring-donezo-primary"
                            />
                            A gasto extra
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="radio"
                              checked={destinoIngreso === 'SOLO_INMUEBLE'}
                              onChange={() => { setDestinoIngreso('SOLO_INMUEBLE'); }}
                              className="text-donezo-primary focus:ring-donezo-primary"
                            />
                            Solo inmueble
                          </label>
                        </div>
                      </FormField>
                    </div>
                    {destinoIngreso === 'CUENTA' && (
                      <div className="md:col-span-2">
                        {cuentaPrincipal ? (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                            El ajuste se registrara usando la cuenta principal: <span className="font-black">{getCuentaLabel(cuentaPrincipal)}</span>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                            No hay cuenta bancaria principal configurada. Vaya a Bancos y marque una cuenta como principal.
                          </div>
                        )}
                      </div>
                    )}
                    {destinoIngreso === 'CUENTA' && (
                      <div className="md:col-span-2">
                        <FormField label="Distribucion en Fondos">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setSubtipoFavor('directo')}
                              className={`flex-1 min-h-11 py-2.5 px-3 rounded-xl text-sm font-bold border transition-colors ${subtipoFavor === 'directo' ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}
                            >
                              Directo<br /><span className="font-normal opacity-70">100% al fondo principal</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubtipoFavor('distribuido')}
                              className={`flex-1 min-h-11 py-2.5 px-3 rounded-xl text-sm font-bold border transition-colors ${subtipoFavor === 'distribuido' ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}
                            >
                              Distribuido<br /><span className="font-normal opacity-70">Por % de fondos</span>
                            </button>
                          </div>
                        </FormField>
                      </div>
                    )}
                    {destinoIngreso === 'EXTRA' && (
                      <div className="md:col-span-2 space-y-3">
                        <FormField label="Gasto Extra a Rebajar">
                          {gastosExtras.length === 0 ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">No hay gastos extras disponibles. Asegurese que hayan sido generados en recibos o avisos.</p>
                          ) : (
                            <select
                              value={gastoExtraSeleccionado}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) => setGastoExtraSeleccionado(e.target.value)}
                              className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-medium text-sm"
                            >
                              <option value="">Seleccione un gasto extra...</option>
                              {gastosExtras.map((g: any) => (
                                <option key={g.id} value={g.id}>
                                  {g.concepto} - Deuda act.: ${parseFloat(String(g.deuda_restante)).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          )}
                        </FormField>
                        {cuentaPrincipal ? (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                            El pago se registrara en el inmueble y se acreditara 100% al fondo principal de: <span className="font-black">{getCuentaLabel(cuentaPrincipal)}</span>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                            No hay cuenta bancaria predeterminada configurada. Vaya a Bancos y marque una cuenta como principal antes de usar esta operacion.
                          </div>
                        )}
                      </div>
                    )}
                    {destinoIngreso === 'SOLO_INMUEBLE' && (
                      <div className="md:col-span-2">
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                          El saldo a favor se aplicara solo al estado de cuenta del inmueble. No afectara cuentas bancarias ni fondos.
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              {esUsdDirecto ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormField label="Fecha de Operacion">
                      <DatePicker
                        selected={ymdToDateLocal(fechaOperacionAjuste)}
                        onChange={(date) => setFechaOperacionAjuste(date ? toYmdLocal(date) : '')}
                        className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white text-sm"
                        placeholderText="dd/mm/yyyy"
                        required
                      />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Monto (USD)" required>
                      <input
                        type="text"
                        value={montoUsdDirecto}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setMontoUsdDirecto(formatNumberInput(e.target.value, 2))}
                        className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-base"
                        placeholder="0,00"
                      />
                    </FormField>
                  </div>
                </div>
              ) : ajusteTipo === 'DEUDA' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FormField label="Fecha de Operacion">
                        <DatePicker
                          selected={ymdToDateLocal(fechaOperacionAjuste)}
                          onChange={(date) => setFechaOperacionAjuste(date ? toYmdLocal(date) : '')}
                          className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white text-sm"
                          placeholderText="dd/mm/yyyy"
                          required
                        />
                      </FormField>
                    </div>
                    <div>
                      <FormField label="Tasa BCV">
                        <input
                          type="text"
                          value={tasaBcvAjuste}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setTasaBcvAjuste(formatNumberInput(e.target.value, 3))}
                          className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-base"
                          placeholder="Ej: 36,500"
                        />
                      </FormField>
                    </div>
                    <div>
                      <FormField label="BCV">
                        <button
                          type="button"
                          onClick={fetchBCVAjuste}
                          disabled={isFetchingBCV}
                          className="w-full min-h-11 p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-60 text-sm"
                        >
                          {isFetchingBCV ? 'Consultando...' : 'BCV'}
                        </button>
                      </FormField>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FormField label="Monto (Bs)">
                        <input
                          type="text"
                          value={montoBsAjuste}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setMontoBsAjuste(formatNumberInput(e.target.value))}
                          className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-base"
                          placeholder="0,00"
                        />
                      </FormField>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <FormField label="Fecha de Operacion">
                      <DatePicker
                        selected={ymdToDateLocal(fechaOperacionAjuste)}
                        onChange={(date) => setFechaOperacionAjuste(date ? toYmdLocal(date) : '')}
                        className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white text-sm"
                        placeholderText="dd/mm/yyyy"
                        required
                      />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Tasa BCV">
                      <input
                        type="text"
                        value={tasaBcvAjuste}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setTasaBcvAjuste(formatNumberInput(e.target.value, 3))}
                        className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-base"
                        placeholder="Ej: 36,500"
                      />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Monto (Bs)">
                      <input
                        type="text"
                        value={montoBsAjuste}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setMontoBsAjuste(formatNumberInput(e.target.value))}
                        className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono text-base"
                        placeholder="0,00"
                      />
                    </FormField>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <FormField label="Concepto">
                    <input
                      type="text"
                      value={conceptoAjuste}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setConceptoAjuste(e.target.value)}
                      className="w-full min-h-11 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white text-sm"
                      placeholder="Ej: Ajuste por revisión de deuda histórica"
                    />
                  </FormField>
                </div>
              </div>

              {!esUsdDirecto && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-xs uppercase font-bold text-gray-500 mb-1">Equivalente en USD</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">${formatMoney(montoUsdAjuste)}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => setShowAjusteModal(false)}
                disabled={isSavingAjuste}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarAjuste}
                disabled={isSavingAjuste}
                className="px-5 py-2.5 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSavingAjuste ? 'Guardando...' : 'Guardar Ajuste'}
              </button>
            </div>
        </ModalBase>
      )}
    </div>
  );
};

export default CuentasPorCobrar;

