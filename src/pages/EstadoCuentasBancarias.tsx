import { useState, useEffect } from 'react';
import type { FC, ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { ModalPagoProveedor, ModalTransferencia } from '../components/BancosModals';

interface EstadoCuentasBancariasProps {}

interface OutletContextType {
  userRole?: string;
}

type ActiveTab = 'cuenta' | `fondo-${number | string}`;

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
  nombre: string;
  moneda?: 'USD' | 'BS' | string;
  saldo_actual?: string | number;
  es_operativo?: boolean;
  porcentaje_asignacion?: string | number;
}

interface Movimiento {
  fecha: string;
  referencia?: string;
  concepto: string;
  tipo?: string;
  monto_bs?: string | number;
  tasa_cambio?: string | number;
  monto_usd?: string | number;
  fondo_origen_id?: string | number;
  fondo_destino_id?: string | number;
  fondo_id?: string | number;
}

interface MovimientoTabla extends Movimiento {
  isEntrada: boolean;
  isSalida: boolean;
  isInterna: boolean;
  montoBsVista: number;
  montoUsdCalculado: number;
  saldoFilaBs: number;
  saldoFilaUsd: number;
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
  movimientos: Movimiento[];
}

interface BcvResponse {
  promedio?: string | number;
}

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;

const formatMonthText = (yyyyMm: string | undefined): string => {
  if (!yyyyMm) return '';
  const [year, month] = yyyyMm.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(month, 10) - 1]} ${year}`;
};
void formatMonthText;

const parseDisplayDate = (ddmmyyyy: string | undefined): Date | null => {
  if (!ddmmyyyy || ddmmyyyy === 'N/A') return null;
  const [dd, mm, yyyy] = String(ddmmyyyy).split('/');
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
void parseDisplayDate;

const EstadoCuentasBancarias: FC<EstadoCuentasBancariasProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [selectedCuenta, setSelectedCuenta] = useState<string>('');
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cuenta');
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [tasaBcv, setTasaBcv] = useState<string>('');
  const [loadingBcv, setLoadingBcv] = useState<boolean>(false);
  const itemsPerPage = 13;

  // Estados para las modales
  const [showPagoModal, setShowPagoModal] = useState<boolean>(false);
  const [showTransfModal, setShowTransfModal] = useState<boolean>(false);

  const fetchCuentas = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } });
      const data: BancosResponse = await res.json();
      if (data.status === 'success') {
        setCuentas(data.bancos);
        if (data.bancos.length > 0) {
          const predeterminada = data.bancos.find((c: CuentaBancaria) => c.es_predeterminada) || data.bancos[0];
          setSelectedCuenta(String(predeterminada.id));
        }
      }
    } catch (error) { console.error(error); }
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
      if (data.status === 'success') setMovimientos(data.movimientos);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const fetchFondos = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } });
      const data: FondosResponse = await res.json();
      if (data.status === 'success') setFondos(data.fondos || []);
    } catch (error) { console.error(error); }
  };

  // Cargar cuentas iniciales
  useEffect(() => {
    if (userRole === 'Administrador') {
      fetchCuentas();
      fetchFondos();
    }
  }, [userRole]);

  // Refrescar movimientos cuando cambia la cuenta seleccionada
  useEffect(() => {
    fetchMovimientos(selectedCuenta);
  }, [selectedCuenta]);

  useEffect(() => {
    setActiveTab('cuenta');
  }, [selectedCuenta]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCuenta, movimientos.length, fechaDesde, fechaHasta, activeTab]);

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

  // Calcular saldos acumulativos para la tabla (Libro Mayor)
  let saldoAcumuladoBs = 0;
  let saldoAcumuladoUSD = 0;
  const tasaBcvNum = toNumber(tasaBcv || 0);
  const fondosCuenta = fondos.filter((f: Fondo) => String(f.cuenta_bancaria_id) === selectedCuenta);
  const saldoCuentaUsdActual = fondosCuenta.reduce((acc: number, f: Fondo) => {
    const saldo = toNumber(f.saldo_actual);
    if (f.moneda === 'USD') return acc + saldo;
    if (f.moneda === 'BS' && tasaBcvNum > 0) return acc + (saldo / tasaBcvNum);
    return acc;
  }, 0);
  const saldoCuentaBsActual = fondosCuenta.reduce((acc: number, f: Fondo) => {
    const saldo = toNumber(f.saldo_actual);
    return f.moneda === 'BS' ? acc + saldo : acc;
  }, 0);

  const movimientosFiltrados = movimientos.filter((mov: Movimiento) => {
    if (!fechaDesde && !fechaHasta) return true;
    const fechaMov = new Date(mov.fecha);
    if (fechaDesde) {
      const desde = new Date(`${fechaDesde}T00:00:00`);
      if (fechaMov < desde) return false;
    }
    if (fechaHasta) {
      const hasta = new Date(`${fechaHasta}T23:59:59`);
      if (fechaMov > hasta) return false;
    }
    return true;
  });

  const activeFondoId = activeTab.startsWith('fondo-') ? parseInt(activeTab.replace('fondo-', ''), 10) : null;
  const fondoActivo = activeFondoId
    ? fondosCuenta.find((f: Fondo) => parseInt(String(f.id), 10) === activeFondoId)
    : null;
  const cuentaTieneUnSoloFondo = fondosCuenta.length === 1;
  const porcentajeNoOperativo = fondosCuenta
    .filter((f: Fondo) => !f.es_operativo)
    .reduce((acc: number, f: Fondo) => acc + toNumber(f.porcentaje_asignacion), 0);
  const porcentajeOperativo = Math.max(0, 100 - porcentajeNoOperativo);
  const movimientosPorVista = activeTab === 'cuenta'
    ? movimientosFiltrados
    : movimientosFiltrados.filter((mov: Movimiento) => {
        const origen = parseInt(String(mov.fondo_origen_id || 0), 10);
        const destino = parseInt(String(mov.fondo_destino_id || 0), 10);
        const fondo = parseInt(String(mov.fondo_id || 0), 10);
        const movimientoAmarradoAFondo = origen === activeFondoId || destino === activeFondoId || fondo === activeFondoId;
        if (movimientoAmarradoAFondo) return true;

        // Para ingresos/egresos que no vienen con fondo_id explÃ­cito:
        // si la cuenta tiene un solo fondo (o el fondo activo absorbe 100%), se reflejan en ese fondo.
        const movimientoSinFondo = origen === 0 && destino === 0 && fondo === 0;
        if (!movimientoSinFondo) return false;

        if (cuentaTieneUnSoloFondo) return true;
        if (fondoActivo?.es_operativo) return porcentajeOperativo > 0;
        return toNumber(fondoActivo?.porcentaje_asignacion) > 0;
      });

  const movimientosOrdenados = [...movimientosPorVista].sort((a: Movimiento, b: Movimiento) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const tablaConSaldos: MovimientoTabla[] = movimientosOrdenados.map((mov: Movimiento) => {
    const montoBs = toNumber(mov.monto_bs);
    const tasa = toNumber(mov.tasa_cambio);
    let montoUsd = toNumber(mov.monto_usd);
    if ((!montoUsd || Number.isNaN(montoUsd)) && montoBs > 0 && tasa > 0) {
      montoUsd = montoBs / tasa;
    }

    let factorFondo = 1;
    if (activeFondoId && !mov.fondo_id && !mov.fondo_origen_id && !mov.fondo_destino_id && fondosCuenta.length > 1) {
      if (fondoActivo?.es_operativo) {
        factorFondo = porcentajeOperativo / 100;
      } else {
        factorFondo = toNumber(fondoActivo?.porcentaje_asignacion) / 100;
      }
    }
    const montoBsVista = montoBs * factorFondo;
    const montoUsdVista = montoUsd * factorFondo;

    const tipo = String(mov.tipo || '').toUpperCase();
    let isEntrada = tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA_IN' || tipo === 'ABONO';
    let isSalida = tipo === 'SALIDA' || tipo === 'TRANSFERENCIA_OUT' || tipo === 'CARGO';
    const isInterna = tipo === 'INTERNA';
    if (activeFondoId && isInterna) {
      const esOrigen = parseInt(String(mov.fondo_origen_id || 0), 10) === activeFondoId;
      const esDestino = parseInt(String(mov.fondo_destino_id || 0), 10) === activeFondoId;
      isEntrada = esDestino;
      isSalida = esOrigen;
    }

    if (isEntrada) {
      saldoAcumuladoBs += montoBsVista;
      saldoAcumuladoUSD += montoUsdVista;
    } else if (isSalida) {
      saldoAcumuladoBs -= montoBsVista;
      saldoAcumuladoUSD -= montoUsdVista;
    }

    return {
      ...mov,
      isEntrada,
      isSalida,
      isInterna,
      montoBsVista,
      montoUsdCalculado: montoUsdVista,
      saldoFilaBs: saldoAcumuladoBs,
      saldoFilaUsd: saldoAcumuladoUSD
    };
  });

  // Invertir el array para mostrar los mÃ¡s recientes arriba
  const tablaInvertida = [...tablaConSaldos].reverse();
  const cuentaActual = cuentas.find((c: CuentaBancaria) => String(c.id) === selectedCuenta);
  const totalPages = Math.ceil(tablaInvertida.length / itemsPerPage);
  const movimientosPagina = tablaInvertida.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const saldoUsdEnBs = tasaBcvNum > 0 ? saldoCuentaUsdActual * tasaBcvNum : 0;

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* ðŸ’¡ PANEL SUPERIOR: SELECTOR Y BOTONES GLOBALES */}
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="w-full md:w-1/3">
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cuenta a inspeccionar</label>
          <select 
            value={selectedCuenta} 
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCuenta(e.target.value)} 
            className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary font-bold text-gray-800"
          >
            {cuentas.map((c: CuentaBancaria) => (
              <option key={c.id} value={c.id}>{c.nombre_banco} ({c.apodo})</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowTransfModal(true)} 
            className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 px-5 rounded-xl transition-all text-sm border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
          >
            ðŸ”„ Transferir
          </button>
          <button 
            onClick={() => setShowPagoModal(true)} 
            className="flex-1 md:flex-none bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 px-5 rounded-xl transition-all text-sm border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 shadow-sm"
          >
            ðŸ’¸ Pagar Proveedor
          </button>
        </div>
      </div>

      {/* ðŸ’¡ RESUMEN DE SALDOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex flex-col justify-center items-center">
           <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Saldo en Banco (Equivalente USD)</p>
           <h2 className="text-4xl font-black text-blue-700 dark:text-blue-300">${formatMoney(saldoCuentaUsdActual)}</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center opacity-80 gap-2">
           <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Saldo Original Bs (Si aplica)</p>
           <h2 className="text-3xl font-black text-gray-700 dark:text-gray-300">Bs {formatMoney(saldoCuentaBsActual)}</h2>
           <div className="flex items-center gap-2">
             <button
               type="button"
               onClick={fetchBCV}
               disabled={loadingBcv}
               className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 disabled:opacity-60"
             >
               {loadingBcv ? 'Consultando BCV...' : 'Obtener BCV'}
             </button>
             {tasaBcvNum > 0 && <span className="text-xs font-bold text-gray-500">Tasa: {formatMoney(tasaBcvNum)}</span>}
           </div>
           {tasaBcvNum > 0 && <p className="text-xs text-gray-500">Equivalente del saldo USD a Bs: <span className="font-bold">Bs {formatMoney(saldoUsdEnBs)}</span></p>}
           {cuentaActual?.moneda === 'USD' && <p className="text-xs text-red-400 font-bold mt-1">Cuenta en Divisas</p>}
        </div>
      </div>

      {/* ðŸ’¡ TABLA LIBRO MAYOR */}
      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Movimientos de la Cuenta
              {cuentaActual ? ` - ${cuentaActual.nombre_banco} (${cuentaActual.apodo})` : ''}
            </h3>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaDesde(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaHasta(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
              </div>
              <button type="button" onClick={() => { setFechaDesde(''); setFechaHasta(''); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300">
                Limpiar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('cuenta')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                activeTab === 'cuenta'
                  ? 'bg-donezo-primary text-white border-donezo-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              Cuenta Bancaria
            </button>
            {fondosCuenta.map((fondo: Fondo) => (
              <button
                key={fondo.id}
                type="button"
                onClick={() => setActiveTab(`fondo-${fondo.id}`)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  activeTab === `fondo-${fondo.id}`
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                {fondo.nombre}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-10">Generando estado de cuenta...</p>
        ) : tablaInvertida.length === 0 ? (
          <p className="text-center text-gray-400 py-10 font-medium">No hay movimientos registrados en esta cuenta.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-bold">Fecha</th>
                  <th className="p-4 font-bold">Referencia</th>
                  <th className="p-4 font-bold">Concepto</th>
                  <th className="p-4 font-bold text-right">Cargo (-)</th>
                  <th className="p-4 font-bold text-right">Abono (+)</th>
                  <th className="p-4 font-bold text-right">Tasa</th>
                  <th className="p-4 font-bold text-right border-l border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">Saldo USD</th>
                </tr>
              </thead>
              <tbody>
                {movimientosPagina.map((m: MovimientoTabla, i: number) => (
                    <tr key={i} className={`border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${m.isInterna ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                      {(() => {
                        const montoBsNum = toNumber(m.montoBsVista || 0);
                        const tasaNum = toNumber(m.tasa_cambio || 0);
                        const montoBsCalculado = (!montoBsNum && tasaNum > 0 && toNumber(m.monto_usd || 0) > 0)
                          ? toNumber(m.monto_usd) * tasaNum
                          : montoBsNum;
                        const mostrarTasa = tasaNum > 0;
                        return (
                          <>
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-400 text-xs">{new Date(m.fecha).toLocaleDateString('es-ES')}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{m.referencia || 'N/A'}</td>
                      <td className="p-4 font-medium text-gray-800 dark:text-gray-200">
                        {m.concepto}
                      </td>
                      
                      {/* COLUMNA CARGO (-) */}
                      <td className="p-4 text-right font-black font-mono">
                        {m.isSalida 
                           ? <span className="text-red-500">-Bs {formatMoney(montoBsCalculado || 0)}</span> 
                           : m.isInterna ? <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Mismo Banco</span> : ''}
                      </td>

                      {/* COLUMNA ABONO (+) */}
                      <td className="p-4 text-right font-black font-mono">
                        {m.isEntrada 
                           ? <span className="text-green-500">+Bs {formatMoney(montoBsCalculado || 0)}</span> 
                           : m.isInterna ? <span className="text-gray-400 text-xs italic">Bs {formatMoney(montoBsCalculado || 0)}</span> : ''}
                      </td>

                      {/* COLUMNA TASA */}
                      <td className="p-4 text-right font-mono text-xs">
                        {mostrarTasa ? (
                          <span className="text-blue-600 dark:text-blue-400">{formatMoney(tasaNum)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* COLUMNA SALDO USD (equivalente del movimiento) */}
                      <td className="p-4 text-right font-black font-mono text-gray-800 dark:text-white border-l border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
                        {m.isSalida
                          ? <span className="text-red-500">-${formatMoney(m.montoUsdCalculado || 0)}</span>
                          : m.isEntrada
                            ? <span className="text-green-500">+${formatMoney(m.montoUsdCalculado || 0)}</span>
                            : <span>${formatMoney(m.montoUsdCalculado || 0)}</span>}
                      </td>
                          </>
                        );
                      })()}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && tablaInvertida.length > 0 && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              â† Anterior
            </button>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Pagina {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Siguiente â†’
            </button>
          </div>
        )}
      </div>

      {/* RENDERIZADO DE MODALES (INDEPENDIENTES) */}
      {showPagoModal && (
        <ModalPagoProveedor 
          onClose={() => setShowPagoModal(false)} 
          onSuccess={() => { setShowPagoModal(false); fetchMovimientos(selectedCuenta); fetchFondos(); }} 
        />
      )}
      {showTransfModal && (
        <ModalTransferencia 
          onClose={() => setShowTransfModal(false)} 
          onSuccess={() => { setShowTransfModal(false); fetchMovimientos(selectedCuenta); fetchFondos(); }} 
        />
      )}
    </div>
  );
};

export default EstadoCuentasBancarias;
