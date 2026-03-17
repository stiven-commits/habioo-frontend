import { useState, useEffect } from 'react';
import type { FC, ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import ModalRegistrarPago from '../components/ModalRegistrarPago';
import { ModalEstadoCuenta } from '../components/propiedades/PropiedadesModals';

interface CuentasPorCobrarProps {}

interface OutletContextType {
  userRole?: string;
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
}

interface PagosPendientesResponse {
  status: string;
  message?: string;
  pagos?: PagoPendienteAprobacion[];
}

interface PendingCountMap {
  [propiedadId: number]: number;
}

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;
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

const CuentasPorCobrar: FC<CuentasPorCobrarProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Nuevo estado para las pestañas
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
  const [openOptionsFor, setOpenOptionsFor] = useState<number | null>(null);

  const montoUsdAjuste = parseNumberInput(tasaBcvAjuste) > 0
    ? (parseNumberInput(montoBsAjuste) / parseNumberInput(tasaBcvAjuste))
    : 0;

  const toLocalYmd = (dateLike: string | number | Date | undefined): string => {
    const d = new Date(dateLike ?? '');
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

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
      fetchData();
      fetchPendingCounts();
    }
  }, [userRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-options-menu]')) return;
      setOpenOptionsFor(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]); // Resetea la paginación si cambia el buscador o la pestaña

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
    setRejectingPagoId(null);
    setShowAprobacionModal(true);
    void fetchPagosPendientes(prop.id);
  };

  const aprobarPagoPendiente = async (pagoId: number): Promise<void> => {
    setDecisionLoadingId(pagoId);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/pagos/${pagoId}/validar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
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
    if (montoUsd <= 0) {
      alert('Debe ingresar un monto en Bs y una tasa BCV válida.');
      return;
    }
    setIsSavingAjuste(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const payload = {
        tipo_ajuste: ajusteTipo === 'DEUDA' ? 'CARGAR_DEUDA' : 'AGREGAR_FAVOR',
        monto: Number(montoUsd.toFixed(2)),
        nota: `${(conceptoAjuste || 'Ajuste manual').trim()} | Ajuste desde Cuentas por Cobrar (${ajusteTipo}) - Bs ${montoBsAjuste} | Tasa ${tasaBcvAjuste}`
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
        setShowAjusteModal(false);
        setSelectedPropAjuste(null);
        fetchData();
      } else {
        alert(data.error || data.message || 'No se pudo guardar el ajuste.');
      }
    } catch {
      alert('Error de conexión al guardar ajuste.');
    } finally {
      setIsSavingAjuste(false);
    }
  };

  // Lógica de filtrado por pestañas
  const baseProperties = activeTab === 'Deudores'
    ? propiedades.filter((p: Propiedad) => toNumber(p.saldo_actual) > 0)
    : propiedades;

  const filteredProperties = baseProperties.filter(
    (p: Propiedad) =>
      p.identificador?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
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
    const movYmd = toLocalYmd((m.fecha_registro as string) || (m.fecha_operacion as string));
    if (!movYmd) return false;
    if (fechaDesde && movYmd < fechaDesde) return false;
    if (fechaHasta && movYmd > fechaHasta) return false;
    return true;
  });

  const totalCargo = estadoCuentaFiltrado.reduce((acc: number, m: EstadoCuentaMovimientoConSaldo) => acc + toNumber(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc: number, m: EstadoCuentaMovimientoConSaldo) => acc + toNumber(m.abono), 0);

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;
  if (loading) return <p className="text-gray-500 dark:text-gray-400">Cargando cuentas por cobrar...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Cobranza de Inmuebles</h3>
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

        {/* Pestañas de navegación */}
        <div className="flex gap-6 border-b border-gray-100 dark:border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('Deudores')}
            className={`py-3 px-2 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'Deudores'
                ? 'border-donezo-primary text-donezo-primary dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            ⚠️ Con Deuda Pendiente
          </button>
          <button
            onClick={() => setActiveTab('Todos')}
            className={`py-3 px-2 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'Todos'
                ? 'border-donezo-primary text-donezo-primary dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            🏢 Todos los Inmuebles
          </button>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {activeTab === 'Deudores' ? '🎉 ¡Genial! No hay inmuebles con deuda pendiente.' : 'No se encontraron inmuebles.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="p-3">Inmueble</th>
                  <th className="p-3 text-right">Alícuota</th>
                  <th className="p-3">Propietario</th>
                  <th className="p-3 text-right">Saldo Actual</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProperties.map((p: Propiedad, index: number) => {
                  const saldo = toNumber(p.saldo_actual);
                  const abrirHaciaArriba = index >= paginatedProperties.length - 2;
                  
                  // Lógica de colores dinámicos para el saldo
                  const isDeuda = saldo > 0;
                  const isFavor = saldo < 0;
                  const colorClass = isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-500 dark:text-gray-400';
                  const label = isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Al Día';

                  return (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-bold text-gray-800 dark:text-white text-base">{p.identificador}</td>
                      <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{String(p.alicuota || 0).replace('.', ',')}%</td>
                      <td className="p-3">
                        <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre || 'Sin asignar'}</div>
                        <div className="text-xs text-gray-500">{p.prop_cedula || '-'}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-black font-mono tracking-tight text-lg ${colorClass}`}>
                          {isFavor ? '+' : ''}${formatMoney(Math.abs(saldo))}
                        </div>
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${isDeuda ? 'text-red-400' : isFavor ? 'text-green-400' : 'text-gray-400'}`}>
                          {label}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="relative inline-block text-left" data-options-menu>
                          <button
                            type="button"
                            onClick={() => setOpenOptionsFor((prev) => (prev === p.id ? null : p.id))}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            Opciones
                            <span className="text-[10px]">▼</span>
                          </button>

                          {openOptionsFor === p.id && (
                            <div className={`absolute right-0 z-50 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 ${abrirHaciaArriba ? 'bottom-12' : 'top-12'} animate-fadeIn`}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenEstadoCuenta(p);
                                  setOpenOptionsFor(null);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
                              >
                                Estado de Cuenta
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenRegistrarPago(p);
                                  setOpenOptionsFor(null);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs font-bold text-green-600 transition-colors hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/30"
                              >
                                Registrar Pago
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenAjuste(p);
                                  setOpenOptionsFor(null);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30"
                              >
                                Ajuste
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!pendingByPropiedad[p.id]) return;
                                  handleOpenAprobaciones(p);
                                  setOpenOptionsFor(null);
                                }}
                                disabled={!pendingByPropiedad[p.id]}
                                className="block w-full px-3 py-2 text-left text-xs font-bold text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-300 dark:hover:bg-violet-900/30"
                              >
                                Aprobar pagos{pendingByPropiedad[p.id] ? ` (${pendingByPropiedad[p.id]})` : ''}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
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
        handleOpenAjuste={(_prop) => {}}
        loadingCuenta={loadingCuenta}
        estadoCuentaFiltrado={estadoCuentaFiltrado}
        showAjuste={false}
      />

      {showAprobacionModal && selectedPropAprobacion && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative">
            <button
              onClick={() => {
                setShowAprobacionModal(false);
                setSelectedPropAprobacion(null);
                setPagosPendientes([]);
                setRejectingPagoId(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl"
            >
              X
            </button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Aprobación de Pagos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selectedPropAprobacion.identificador} - {selectedPropAprobacion.prop_nombre || 'Sin propietario'}
            </p>

            {loadingPendientes ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6">Cargando pagos pendientes...</p>
            ) : pagosPendientes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6">No hay pagos pendientes de aprobación para este inmueble.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {pagosPendientes.map((pago: PagoPendienteAprobacion) => (
                  <article key={pago.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p><span className="font-bold">Pago:</span> #{pago.id}</p>
                      <p><span className="font-bold">Ref:</span> {pago.referencia || 'Sin referencia'}</p>
                      <p><span className="font-bold">Monto:</span> {String(pago.moneda || 'USD').toUpperCase() === 'USD' ? '$' : 'Bs '} {formatMoney(pago.moneda?.toUpperCase() === 'USD' ? toNumber(pago.monto_usd) : toNumber(pago.monto_origen))}</p>
                      <p><span className="font-bold">Fecha:</span> {pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : '-'}</p>
                    </div>

                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={decisionLoadingId === pago.id}
                        onClick={() => aprobarPagoPendiente(pago.id)}
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
                        <label className="block text-xs font-bold text-red-700 dark:text-red-300 mb-1">Motivo de rechazo (obligatorio)</label>
                        <textarea
                          value={rechazoDraft[pago.id] || ''}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            setRechazoDraft((prev) => ({ ...prev, [pago.id]: e.target.value }))
                          }
                          className="w-full p-2.5 rounded-xl border border-red-200 dark:border-red-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-red-400 dark:text-white text-sm"
                          rows={2}
                          placeholder="Ej: El comprobante no coincide con el monto reportado."
                        />
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
          </div>
        </div>
      )}

      {showAjusteModal && selectedPropAjuste && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 dark:border-gray-800 relative">
            <button
              onClick={() => setShowAjusteModal(false)}
              disabled={isSavingAjuste}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl disabled:opacity-40"
            >
              X
            </button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Ajuste de Saldo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selectedPropAjuste.identificador} - {selectedPropAjuste.prop_nombre || 'Sin asignar'}
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Tipo:</span>
                <button
                  type="button"
                  onClick={() => setAjusteTipo('DEUDA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${ajusteTipo === 'DEUDA'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  Deuda
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteTipo('FAVOR')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${ajusteTipo === 'FAVOR'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  A favor
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Concepto</label>
                  <input
                    type="text"
                    value={conceptoAjuste}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setConceptoAjuste(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                    placeholder="Ej: Ajuste por revisión de deuda histórica"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Monto (Bs)</label>
                  <input
                    type="text"
                    value={montoBsAjuste}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMontoBsAjuste(formatNumberInput(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tasa BCV</label>
                  <input
                    type="text"
                    value={tasaBcvAjuste}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setTasaBcvAjuste(formatNumberInput(e.target.value, 3))}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                    placeholder="Ej: 36,500"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchBCVAjuste}
                  disabled={isFetchingBCV}
                  className="w-full p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-60"
                >
                  {isFetchingBCV ? 'Consultando...' : 'BCV'}
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs uppercase font-bold text-gray-500 mb-1">Equivalente en USD</p>
                <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(montoUsdAjuste)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => setShowAjusteModal(false)}
                disabled={isSavingAjuste}
                className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarAjuste}
                disabled={isSavingAjuste}
                className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isSavingAjuste ? 'Guardando...' : 'Guardar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentasPorCobrar;
