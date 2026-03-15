import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { ModalTransferencia } from '../components/BancosModals';
import ModalDetalleMovimiento, { type IMovimientoDetalle } from '../components/libro-mayor/ModalDetalleMovimiento';

interface EstadoCuentasBancariasProps {}

interface OutletContextType {
  userRole?: string;
}

type ActiveTab = 'cuenta' | 'sin-fondo' | `fondo-${number | string}`;

interface CuentaBancaria {
  id: number | string;
  nombre_banco: string;
  apodo: string;
  moneda?: string;
  es_predeterminada?: boolean;
}

interface Fondo {
  id: number | string;
  cuenta_bancaria_id?: number | string;
  nombre?: string;
  moneda?: 'USD' | 'BS' | string;
  saldo_actual?: string | number;
}

interface IMovimiento extends IMovimientoDetalle {
  saldo_acumulado?: string | number;
  monto_origen_pago?: number;
  fondo_id?: number | null;
  fondo_origen_id?: number | null;
  fondo_destino_id?: number | null;
  fondo_nombre?: string;
}

interface BancosResponse {
  status: string;
  bancos: CuentaBancaria[];
}

interface FondosResponse {
  status: string;
  fondos?: Fondo[];
}

interface MovimientosResponse {
  status: string;
  movimientos: Array<Partial<IMovimiento>>;
}

interface BcvResponse {
  promedio?: string | number;
}

const toNumber = (value: string | number | undefined | null): number => {
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

const formatFecha = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const datePart = dateString.split('T')[0] ?? '';
    const parts = datePart.split('-');
    if (parts.length < 3) return dateString;
    const year = parts[0] ?? '';
    const month = parts[1] ?? '';
    const day = parts[2] ?? '';
    if (!year || !month || !day) return dateString;
    return `${day}/${month}/${year}`;
  } catch (_e) {
    return dateString;
  }
};

const parseFilterDate = (value: string): Date | null => {
  const txt = value.trim();
  if (!txt) return null;

  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y = '', m = '', d = ''] = iso;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
    const date = new Date(year, month - 1, day, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dmy) return null;
  const [, d = '', m = '', y = ''] = dmy;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
  const date = new Date(year, month - 1, day, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const EstadoCuentasBancarias: FC<EstadoCuentasBancariasProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();

  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [selectedCuenta, setSelectedCuenta] = useState<string>('');
  const [movimientos, setMovimientos] = useState<IMovimiento[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuenta');
  const [loading, setLoading] = useState<boolean>(true);
  const [showTransfModal, setShowTransfModal] = useState<boolean>(false);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [movimientoDetalle, setMovimientoDetalle] = useState<IMovimiento | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tasaBcv, setTasaBcv] = useState<string>('');
  const [loadingBcv, setLoadingBcv] = useState<boolean>(false);

  const itemsPerPage = 13;

  const fetchCuentas = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/bancos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: BancosResponse = await res.json();
      if (data.status === 'success') {
        setCuentas(data.bancos);
        if (data.bancos.length > 0) {
          const predeterminada = data.bancos.find((c) => c.es_predeterminada);
          const cuentaInicial = predeterminada ?? data.bancos[0];
          if (cuentaInicial) setSelectedCuenta(String(cuentaInicial.id));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFondos = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
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
    if (!cuentaId) return;
    setLoading(true);
    const token = localStorage.getItem('habioo_token');

    try {
      const res = await fetch(`${API_BASE_URL}/bancos-admin/${cuentaId}/estado-cuenta`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: MovimientosResponse = await res.json();

      if (data.status === 'success') {
        const rawMovimientos: Array<Partial<IMovimiento> | null | undefined> = Array.isArray(data.movimientos) ? data.movimientos : [];
        const normalizados: IMovimiento[] = rawMovimientos.map((mov, index): IMovimiento => {
          const safeMov: Partial<IMovimiento> = mov ?? {};
          const tipoRaw = String(safeMov.tipo || '').toUpperCase();
          const tipo: 'INGRESO' | 'EGRESO' = tipoRaw === 'EGRESO' ? 'EGRESO' : 'INGRESO';
          const montoOrigenRaw = (safeMov as { monto_origen_pago?: unknown }).monto_origen_pago;
          const montoOrigenPago = (montoOrigenRaw === null || montoOrigenRaw === undefined || montoOrigenRaw === '')
            ? null
            : toNumber(String(montoOrigenRaw));

          return {
            id: safeMov.id ?? `mov-${index}`,
            fecha: String(safeMov.fecha ?? ''),
            referencia: String(safeMov.referencia ?? ''),
            concepto: String(safeMov.concepto ?? '-'),
            tipo,
            monto_bs: safeMov.monto_bs ?? 0,
            tasa_cambio: safeMov.tasa_cambio ?? 0,
            monto_usd: safeMov.monto_usd ?? 0,
            ...(montoOrigenPago !== null ? { monto_origen_pago: montoOrigenPago } : {}),
            banco_origen: safeMov.banco_origen ? String(safeMov.banco_origen) : '',
            cedula_origen: safeMov.cedula_origen ? String(safeMov.cedula_origen) : '',
            fondo_id: toNullableInt((safeMov as { fondo_id?: unknown }).fondo_id),
            fondo_origen_id: toNullableInt((safeMov as { fondo_origen_id?: unknown }).fondo_origen_id),
            fondo_destino_id: toNullableInt((safeMov as { fondo_destino_id?: unknown }).fondo_destino_id),
            fondo_nombre: (safeMov as { fondo_nombre?: unknown }).fondo_nombre ? String((safeMov as { fondo_nombre?: unknown }).fondo_nombre) : '',
            ...(safeMov.saldo_acumulado !== undefined ? { saldo_acumulado: safeMov.saldo_acumulado } : {})
          };
        });

        setMovimientos(normalizados);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBCV = async (): Promise<void> => {
    setLoadingBcv(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('No se pudo consultar BCV');
      const data: BcvResponse = await response.json();
      if (data?.promedio) setTasaBcv(String(data.promedio));
    } catch {
      alert('Error obteniendo tasa BCV.');
    } finally {
      setLoadingBcv(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') {
      fetchCuentas();
      fetchFondos();
    }
  }, [userRole]);

  useEffect(() => {
    fetchMovimientos(selectedCuenta);
  }, [selectedCuenta]);

  useEffect(() => {
    setActiveTab('cuenta');
  }, [selectedCuenta]);

  useEffect(() => {
    setCurrentPage(1);
  }, [fechaDesde, fechaHasta, selectedCuenta, movimientos.length, activeTab]);

  const fondosCuenta = useMemo(
    () => fondos.filter((f) => String(f.cuenta_bancaria_id) === selectedCuenta),
    [fondos, selectedCuenta]
  );

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

    movimientosFiltrados.forEach((mov) => {
      const pagoMatch = String(mov.concepto || '').match(/Pago de Recibo #(\d+)/i);

      if (mov.tipo === 'INGRESO' && pagoMatch && pagoMatch[1]) {
        const pagoId = pagoMatch[1];
        const grupo = ingresosPorPago.get(pagoId) || [];
        grupo.push(mov);
        ingresosPorPago.set(pagoId, grupo);
        return;
      }

      movimientosDirectos.push(mov);
    });

    const ingresosConsolidados: IMovimiento[] = Array.from(ingresosPorPago.entries()).map(([pagoId, grupo]) => {
      const base = grupo[0];
      const conceptoLimpio = String(base?.concepto || '').replace(/\s*-\s*Fondo:\s*.+$/i, '').trim();
      const montoUsdTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_usd), 0);
      const montoBsTotal = grupo.reduce((acc, item) => acc + toNumber(item.monto_bs), 0);
      const montoBsOriginal = grupo
        .map((item) => toNumber(item.monto_origen_pago))
        .find((valor) => valor > 0) || 0;
      const referencias = Array.from(
        new Set(grupo.map((item) => String(item.referencia || '').trim()).filter(Boolean))
      );
      const tasa = toNumber(base?.tasa_cambio);

      return {
        id: `ING-CONS-${pagoId}`,
        fecha: String(base?.fecha ?? ''),
        referencia: referencias[0] || (base?.referencia || ''),
        concepto: conceptoLimpio || `Pago de Recibo #${pagoId}`,
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
        fondo_nombre: ''
      };
    });

    return [...movimientosDirectos, ...ingresosConsolidados].sort((a, b) => {
      const fechaA = new Date(a.fecha || '').getTime();
      const fechaB = new Date(b.fecha || '').getTime();
      if (fechaA !== fechaB) return fechaB - fechaA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [movimientosFiltrados]);

  const movimientosPorVista = useMemo(() => {
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

  const totalPages = Math.max(1, Math.ceil(movimientosPorVista.length / itemsPerPage));
  const movimientosPagina = movimientosPorVista.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const cuentaActual = cuentas.find((c) => String(c.id) === selectedCuenta);
  const isCuentaUsd = String(cuentaActual?.moneda || '').toUpperCase() === 'USD';
  const saldoUsdEnBs = tasaBcvNum > 0 ? saldoCuentaUsdActual * tasaBcvNum : 0;

  const resumenFondos = useMemo(
    () =>
      fondosCuenta.map((fondo) => {
        const moneda = String(fondo.moneda || '').toUpperCase();
        const saldo = toNumber(fondo.saldo_actual);
        const equivalenteUsd = moneda === 'USD'
          ? saldo
          : (moneda === 'BS' && tasaBcvNum > 0 ? (saldo / tasaBcvNum) : 0);

        return {
          id: String(fondo.id),
          nombre: fondo.nombre || `Fondo ${fondo.id}`,
          moneda,
          saldo,
          equivalenteUsd
        };
      }),
    [fondosCuenta, tasaBcvNum]
  );

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
      const extras = [
        banco ? `Banco: ${banco}` : '',
        cedula ? `Cédula/RIF: ${cedula}` : ''
      ].filter(Boolean);
      return `${movimiento.concepto} | ${extras.join(' | ')}`;
    }

    return movimiento.concepto;
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="w-full md:w-1/3">
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cuenta a inspeccionar</label>
          <select
            value={selectedCuenta}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCuenta(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_banco} ({c.apodo})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowTransfModal(true)}
            className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 px-5 rounded-xl transition-all text-sm border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
          >
            Transferir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex flex-col justify-center items-center">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Saldo en banco (equivalente USD)</p>
          <h2 className="text-4xl font-black text-blue-700 dark:text-blue-300">${formatCurrency(saldoCuentaUsdActual)}</h2>
          {tasaBcvNum > 0 && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              Equivalente del saldo USD a Bs: <span className="font-bold">Bs {formatCurrency(saldoUsdEnBs)}</span>
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center opacity-80 gap-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Saldo original Bs (si aplica)</p>
          <h2 className="text-3xl font-black text-gray-700 dark:text-gray-300">Bs {formatCurrency(saldoCuentaBsActual)}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBCV}
              disabled={loadingBcv}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 disabled:opacity-60"
            >
              {loadingBcv ? 'Consultando BCV...' : 'Obtener BCV'}
            </button>
            {tasaBcvNum > 0 && <span className="text-xs font-bold text-gray-500">Tasa: {formatCurrency(tasaBcvNum)}</span>}
          </div>
          {cuentaActual?.moneda === 'USD' && <p className="text-xs text-red-400 font-bold mt-1">Cuenta en divisas</p>}
        </div>
      </div>

      {resumenFondos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {resumenFondos.map((fondo) => (
            <div key={fondo.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">{fondo.nombre}</p>
              <p className="text-lg font-black text-gray-800 dark:text-gray-100 mt-1">
                {fondo.moneda === 'BS' ? 'Bs ' : '$'}{formatCurrency(fondo.saldo)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Equivalente USD: ${formatCurrency(fondo.equivalenteUsd)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Libro mayor
              {cuentaActual ? ` - ${cuentaActual.nombre_banco} (${cuentaActual.apodo})` : ''}
            </h3>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
                <input
                  type="date"
                  lang="es-ES"
                  title="dd/mm/yyyy"
                  value={fechaDesde}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaDesde(e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 outline-none dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
                <input
                  type="date"
                  lang="es-ES"
                  title="dd/mm/yyyy"
                  value={fechaHasta}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaHasta(e.target.value)}
                  className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 outline-none dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFechaDesde('');
                  setFechaHasta('');
                }}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                Limpiar
              </button>
            </div>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-1 -mb-px">
              <button
              type="button"
              onClick={() => setActiveTab('cuenta')}
                className={`px-3 py-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'cuenta'
                    ? 'text-gray-800 border-donezo-primary dark:text-white dark:border-white'
                    : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Cuenta bancaria
              </button>
              {fondosCuenta.map((fondo) => (
                <button
                key={String(fondo.id)}
                type="button"
                onClick={() => setActiveTab(`fondo-${fondo.id}`)}
                  className={`px-3 py-2 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === `fondo-${fondo.id}`
                      ? 'text-gray-800 border-donezo-primary dark:text-white dark:border-white'
                      : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                 }`}
               >
                 {fondo.nombre || `Fondo ${fondo.id}`}
                </button>
              ))}
              <button
              type="button"
              onClick={() => setActiveTab('sin-fondo')}
                className={`px-3 py-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'sin-fondo'
                    ? 'text-amber-300 border-amber-300'
                    : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
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
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-bold">Fecha</th>
                  <th className="p-4 font-bold">Referencia</th>
                  <th className="p-4 font-bold">Descripción</th>
                  <th className="p-4 font-bold text-right">Monto (Bs)</th>
                  <th className="p-4 font-bold text-right">Cargo ($)</th>
                  <th className="p-4 font-bold text-right">Abono ($)</th>
                  {!isCuentaUsd && <th className="p-4 font-bold text-right">Tasa (Bs.)</th>}
                </tr>
              </thead>
              <tbody>
                {movimientosPagina.map((movimiento) => {
                  const montoBsVista = getMontoBsVista(movimiento);
                  const mostrarBsEnUsd = isCuentaUsd && montoBsVista > 0;

                  return (
                    <tr
                      key={String(movimiento.id)}
                      onDoubleClick={() => setMovimientoDetalle(movimiento)}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-400 text-xs">{formatFecha(movimiento.fecha)}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{movimiento.referencia || '-'}</td>
                      <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{getConceptoVista(movimiento)}</td>
                      <td className="p-4 text-right font-black font-mono text-slate-700 dark:text-slate-200">
                        {isCuentaUsd
                          ? (mostrarBsEnUsd ? `Bs ${formatCurrency(montoBsVista)}` : 'N/A')
                          : (montoBsVista > 0 ? `Bs ${formatCurrency(montoBsVista)}` : '-')}
                      </td>
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
                        <td className="p-4 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                          {movimiento.tasa_cambio ? formatCurrency(movimiento.tasa_cambio) : '-'}
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

      {showTransfModal && (
        <ModalTransferencia
          onClose={() => setShowTransfModal(false)}
          onSuccess={() => {
            setShowTransfModal(false);
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

export default EstadoCuentasBancarias;
