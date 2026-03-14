import React, { useEffect, useMemo, useState } from 'react';
import type { FC, MouseEvent, ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalAgregarGasto from '../components/ModalAgregarGasto';
import ModalDetallesGasto from '../components/ModalDetallesGasto';
import ModalPagarProveedor from '../components/gastos/ModalPagarProveedor';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';

interface GastosProps {}

interface OutletContextType {
  userRole?: string;
}

type ActiveTab = 'Todos' | 'Comun' | 'Zona' | 'Individual' | 'Extra';

interface GastoCuota {
  cuota_id: number | string;
  gasto_id: number | string;
  proveedor: string;
  concepto: string;
  fecha_factura?: string;
  fecha_registro?: string;
  factura_img?: string;
  imagenes?: string[];
  monto_bs?: string | number;
  tasa_cambio?: string | number;
  monto_total_usd?: string | number;
  monto_pagado_usd?: string | number;
  total_cuotas: number;
  nota?: string;
  tipo?: string;
  zona_nombre?: string;
  propiedad_identificador?: string;
  estado: string;
  mes_asignado?: string;
  numero_cuota?: number;
  saldo_pendiente?: string | number;
  monto_cuota_usd?: string | number;
}

interface GastoAgrupado {
  gasto_id: number | string;
  proveedor: string;
  concepto: string;
  fecha_factura: string;
  fecha_registro: string;
  factura_img?: string;
  imagenes: string[];
  monto_bs: string | number;
  tasa_cambio: string | number;
  monto_total_usd: string | number;
  monto_pagado_usd: string | number;
  total_cuotas: number;
  nota?: string;
  tipo: string;
  zona_nombre?: string;
  propiedad_identificador?: string;
  cuotas: GastoCuota[];
  canDelete: boolean;
}

type IGasto = GastoAgrupado;

interface Proveedor {
  id: number | string;
  nombre: string;
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
}

interface Zona {
  id: number | string;
  activa: boolean;
  nombre: string;
}

interface Propiedad {
  id: number | string;
  identificador: string;
}

interface BaseApiResponse {
  status: string;
  message?: string;
  error?: string;
}

interface GastosApiResponse extends BaseApiResponse {
  gastos: GastoCuota[];
}

interface ProveedoresApiResponse extends BaseApiResponse {
  proveedores: Proveedor[];
}

interface ZonasApiResponse extends BaseApiResponse {
  zonas: Zona[];
}

interface PropiedadesApiResponse extends BaseApiResponse {
  propiedades: Propiedad[];
}

interface BancosApiResponse extends BaseApiResponse {
  bancos: BancoCuenta[];
}

interface FondosApiResponse extends BaseApiResponse {
  fondos: Fondo[];
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'warning';
}

interface DialogContextType {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ExtraProgress {
  pagado: number;
  total: number;
  pct: number;
  isComplete: boolean;
}

interface ExpandedRows {
  [key: string]: boolean;
}

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;

const formatMonthText = (yyyyMm: string | undefined): string => {
  if (!yyyyMm) return '';
  const [year = '', month = '01'] = yyyyMm.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthLabel = meses[parseInt(month, 10) - 1] ?? '';
  return `${monthLabel} ${year}`.trim();
};

const parseDisplayDate = (ddmmyyyy: string | undefined): Date | null => {
  if (!ddmmyyyy || ddmmyyyy === 'N/A') return null;
  const [dd, mm, yyyy] = String(ddmmyyyy).split('/');
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const Gastos: FC<GastosProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const { showConfirm } = useDialog() as DialogContextType;

  const [gastosAgrupados, setGastosAgrupados] = useState<GastoAgrupado[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [bancos, setBancos] = useState<BancoCuenta[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('Todos');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 13;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedGasto, setSelectedGasto] = useState<GastoAgrupado | null>(null);
  const [expandedRows, setExpandedRows] = useState<ExpandedRows>({});
  const [isModalPagarOpen, setIsModalPagarOpen] = useState<boolean>(false);
  const [gastoPagar, setGastoPagar] = useState<IGasto | null>(null);

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resGastos, resProv, resZonas, resProps, resBancos, resFondos] = await Promise.all([
        fetch(`${API_BASE_URL}/gastos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/proveedores`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/zonas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataGastos: GastosApiResponse = await resGastos.json();
      const dataProv: ProveedoresApiResponse = await resProv.json();
      const dataZonas: ZonasApiResponse = await resZonas.json();
      const dataProps: PropiedadesApiResponse = await resProps.json();
      const dataBancos: BancosApiResponse = await resBancos.json();
      const dataFondos: FondosApiResponse = await resFondos.json();

      if (dataGastos.status === 'success') {
        const agrupados = dataGastos.gastos.reduce<Record<string, GastoAgrupado>>((acc, curr) => {
          const key = String(curr.gasto_id);
          if (!acc[key]) {
            const nuevo: GastoAgrupado = {
              gasto_id: curr.gasto_id,
              proveedor: curr.proveedor,
              concepto: curr.concepto,
              fecha_factura: curr.fecha_factura || 'N/A',
              fecha_registro: curr.fecha_registro || 'N/A',
              imagenes: Array.isArray(curr.imagenes) ? curr.imagenes : [],
              monto_bs: curr.monto_bs ?? 0,
              tasa_cambio: curr.tasa_cambio ?? 0,
              monto_total_usd: curr.monto_total_usd ?? 0,
              monto_pagado_usd: curr.monto_pagado_usd || 0,
              total_cuotas: curr.total_cuotas,
              tipo: curr.tipo || 'Comun',
              cuotas: [],
              canDelete: true,
            };
            if (curr.factura_img) nuevo.factura_img = curr.factura_img;
            if (curr.nota) nuevo.nota = curr.nota;
            if (curr.zona_nombre) nuevo.zona_nombre = curr.zona_nombre;
            if (curr.propiedad_identificador) nuevo.propiedad_identificador = curr.propiedad_identificador;
            acc[key] = nuevo;
          }
          const gastoActual = acc[key];
          if (!gastoActual) return acc;
          gastoActual.monto_pagado_usd = Math.max(
            toNumber(gastoActual.monto_pagado_usd),
            toNumber(curr.monto_pagado_usd)
          );
          gastoActual.cuotas.push(curr);
          if (curr.estado !== 'Pendiente') gastoActual.canDelete = false;
          return acc;
        }, {});
        setGastosAgrupados(Object.values(agrupados));
      }

      if (dataProv.status === 'success') setProveedores(dataProv.proveedores);
      if (dataZonas.status === 'success') setZonas((dataZonas.zonas || []).filter((z: Zona) => z.activa));
      if (dataProps.status === 'success') setPropiedades(dataProps.propiedades || []);
      if (dataBancos.status === 'success') setBancos(dataBancos.bancos || []);
      if (dataFondos.status === 'success') setFondos(dataFondos.fondos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, fechaDesde, fechaHasta]);

  const filteredBySearchAndDate = useMemo<GastoAgrupado[]>(() => {
    return gastosAgrupados.filter((g: GastoAgrupado) => {
      const matchesSearch =
        g.concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const fecha = parseDisplayDate(g.fecha_factura);
      if (fechaDesde) {
        const desde = new Date(`${fechaDesde}T00:00:00`);
        if (!fecha || fecha < desde) return false;
      }
      if (fechaHasta) {
        const hasta = new Date(`${fechaHasta}T23:59:59`);
        if (!fecha || fecha > hasta) return false;
      }
      return true;
    });
  }, [gastosAgrupados, searchTerm, fechaDesde, fechaHasta]);

  const filteredGastos = useMemo<GastoAgrupado[]>(() => {
    return filteredBySearchAndDate.filter((g: GastoAgrupado) => {
      if (activeTab === 'Todos') return true;
      if (activeTab === 'Zona') return g.tipo === 'Zona' || g.tipo === 'No Comun';
      return g.tipo === activeTab;
    });
  }, [filteredBySearchAndDate, activeTab]);

  const totalByType = useMemo<{ Comun: number; Zona: number; Individual: number; Extra: number }>(() => {
    const sum = (arr: GastoAgrupado[]): number => arr.reduce((acc: number, g: GastoAgrupado) => acc + toNumber(g.monto_total_usd), 0);
    return {
      Comun: sum(filteredBySearchAndDate.filter((g: GastoAgrupado) => g.tipo === 'Comun')),
      Zona: sum(filteredBySearchAndDate.filter((g: GastoAgrupado) => g.tipo === 'Zona' || g.tipo === 'No Comun')),
      Individual: sum(filteredBySearchAndDate.filter((g: GastoAgrupado) => g.tipo === 'Individual')),
      Extra: sum(filteredBySearchAndDate.filter((g: GastoAgrupado) => g.tipo === 'Extra')),
    };
  }, [filteredBySearchAndDate]);

  const totalPages = Math.ceil(filteredGastos.length / ITEMS_PER_PAGE);
  const paginatedGastos = filteredGastos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleRow = (id: number | string, e: MouseEvent<HTMLElement>): void => {
    e.stopPropagation();
    const key = String(id);
    setExpandedRows((prev: ExpandedRows) => ({ ...prev, [key]: !prev[key] }));
  };

  const getExtraProgress = (gasto: GastoAgrupado): ExtraProgress => {
    const total = toNumber(gasto?.monto_total_usd);
    const pagado = toNumber(gasto?.monto_pagado_usd);
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const safePagado = Number.isFinite(pagado) ? Math.max(0, pagado) : 0;
    if (safeTotal <= 0) return { pagado: safePagado, total: safeTotal, pct: 0, isComplete: false };
    const pct = Math.min(100, Math.max(0, (safePagado / safeTotal) * 100));
    return { pagado: safePagado, total: safeTotal, pct, isComplete: safePagado >= safeTotal };
  };

  const handleDelete = async (gastoId: number | string, e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: 'Eliminar gasto',
      message: '¿Eliminar este gasto y todas sus cuotas?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`${API_BASE_URL}/gastos/${gastoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchData();
    else alert('No se pudo eliminar');
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🗂️ Gastos</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar concepto, proveedor..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"
          />
        </div>
        <div className="flex items-end gap-2 w-full sm:w-auto">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaDesde(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-xs [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFechaHasta(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none dark:text-white text-xs [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFechaDesde('');
              setFechaHasta('');
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          >
            Limpiar
          </button>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap shadow-md"
        >
          + Nuevo Gasto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Común</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Comun)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Por Áreas / Sectores</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Zona)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Individual</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Individual)}</p>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <p className="text-xs font-bold uppercase text-gray-400">Extra</p>
          <p className="text-xl font-black text-gray-800 dark:text-white">${formatMoney(totalByType.Extra)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 pt-4 gap-6">
          {(['Todos', 'Comun', 'Zona', 'Individual', 'Extra'] as ActiveTab[]).map((tab: ActiveTab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 font-bold text-sm transition-all relative rounded-t-lg ${
                activeTab === tab
                  ? 'text-donezo-primary dark:text-white bg-blue-50 dark:bg-blue-900/40'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {tab === 'Comun' ? 'Comunes' : tab === 'Zona' ? 'Por Áreas / Sectores' : tab === 'Individual' ? 'Individuales' : tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary rounded-t-full"></span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
          ) : filteredGastos.length === 0 ? (
            <p className="text-gray-500 text-center py-8 dark:text-gray-400">No se encontraron gastos.</p>
          ) : (
            <>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse select-none">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 text-sm dark:text-gray-400">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Fechas</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3 text-right">Monto Total</th>
                      <th className="p-3 text-center">Cuotas</th>
                      <th className="p-3 text-center">Estado de Pago</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGastos.map((g: IGasto) => {
                      const extraProgress = g.tipo === 'Extra' ? getExtraProgress(g) : null;
                      const montoTotal = toNumber(g.monto_total_usd);
                      const montoPagado = toNumber(g.monto_pagado_usd);
                      const progresoPago = montoTotal > 0 ? Math.min(100, (montoPagado / montoTotal) * 100) : 0;
                      const estadoPago: 'Pendiente' | 'Abonado' | 'Pagado' =
                        montoPagado <= 0 ? 'Pendiente' : montoPagado < montoTotal ? 'Abonado' : 'Pagado';
                      const estadoPagoClass =
                        estadoPago === 'Pagado'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : estadoPago === 'Abonado'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                      return (
                      <React.Fragment key={g.gasto_id}>
                        <tr
                          onDoubleClick={() => setSelectedGasto(g)}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3 text-center" onClick={(e: MouseEvent<HTMLElement>) => toggleRow(g.gasto_id, e)}>
                            <button className="text-gray-400 hover:text-donezo-primary transition-colors text-lg">
                              {expandedRows[String(g.gasto_id)] ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="p-3">
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-300">📄 {g.fecha_factura}</span>
                            <span className="block text-[10px] text-gray-400">💻 {g.fecha_registro}</span>
                          </td>
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-300 text-sm">{g.proveedor}</td>
                          <td className="p-3">
                            <div className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] text-sm" title={g.concepto}>
                              {g.concepto}
                            </div>
                            {(g.tipo === 'Zona' || g.tipo === 'No Comun') && (
                              <span className="inline-block mt-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Zona: {g.zona_nombre || 'Especifica'}
                              </span>
                            )}
                            {g.tipo === 'Individual' && (
                              <span className="inline-block mt-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Apto/Casa: {g.propiedad_identificador}
                              </span>
                            )}
                            {g.tipo === 'Extra' && (
                              <span className="inline-block mt-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Extra
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-gray-800 dark:text-white text-sm">
                            {g.tipo === 'Extra' && extraProgress ? (
                              <div className="min-w-[210px] ml-auto">
                                <div className="text-right text-sm font-bold text-gray-800 dark:text-white">
                                  ${formatMoney(g.monto_total_usd)}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                                  Recaudado: ${formatMoney(extraProgress.pagado)} / ${formatMoney(extraProgress.total)}
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${extraProgress.isComplete ? 'bg-emerald-500' : 'bg-sky-500 dark:bg-orange-400'}`}
                                    style={{ width: `${extraProgress.pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>${formatMoney(g.monto_total_usd)}</>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-3 rounded-full text-xs font-bold">
                              {g.total_cuotas} Mes{g.total_cuotas > 1 ? 'es' : ''}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${estadoPagoClass}`}>
                              {estadoPago}
                            </span>
                            <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-300">
                              ${formatMoney(montoPagado)} / ${formatMoney(montoTotal)}
                            </p>
                            <div className="mx-auto mt-1 h-1.5 w-28 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${estadoPago === 'Pagado' ? 'bg-emerald-500' : estadoPago === 'Abonado' ? 'bg-amber-500' : 'bg-red-400'}`}
                                style={{ width: `${progresoPago}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={estadoPago === 'Pagado'}
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.stopPropagation();
                                  setGastoPagar(g);
                                  setIsModalPagarOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={estadoPago === 'Pagado' ? 'Gasto pagado completamente' : 'Registrar pago al proveedor'}
                              >
                                💳 Registrar Pago
                              </button>
                              {g.canDelete ? (
                                <button onClick={(e: MouseEvent<HTMLButtonElement>) => handleDelete(g.gasto_id, e)} className="text-red-400 hover:text-red-600 p-2">
                                  🗑️
                                </button>
                              ) : (
                                <span className="text-gray-300">🔒</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedRows[String(g.gasto_id)] &&
                          g.cuotas.map((c: GastoCuota, cuotaIndex: number) => (
                            <tr key={c.cuota_id} className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-50 dark:border-gray-800/50">
                              <td className="p-3 border-l-2 border-donezo-primary"></td>
                              <td className="p-3 text-gray-500 text-xs dark:text-gray-400" colSpan={2}>
                                Cobro en: <strong>{formatMonthText(c.mes_asignado)}</strong>
                              </td>
                              <td className="p-3 text-gray-500 text-xs dark:text-gray-400">
                                Fracción {c.numero_cuota}/{g.total_cuotas}
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-[10px] font-bold bg-white dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                                  {c.estado}
                                </span>
                              </td>
                              <td className="p-3 text-right text-gray-400 text-xs">
                                {cuotaIndex > 0 ? `Restan: $${formatMoney(c.saldo_pendiente)}` : ''}
                              </td>
                              <td className="p-3 text-right text-gray-600 dark:text-gray-400 font-medium text-sm">
                                ${formatMoney(c.monto_cuota_usd)}
                              </td>
                              <td></td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );})}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 disabled:opacity-50 text-sm font-bold"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 disabled:opacity-50 text-sm font-bold"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isModalOpen && (
        <ModalAgregarGasto
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
          }}
          proveedores={proveedores}
          zonas={zonas}
          propiedades={propiedades}
        />
      )}

      {selectedGasto && <ModalDetallesGasto gasto={selectedGasto} onClose={() => setSelectedGasto(null)} />}

      {isModalPagarOpen && gastoPagar && (
        <ModalPagarProveedor
          isOpen={isModalPagarOpen}
          onClose={() => {
            setIsModalPagarOpen(false);
            setGastoPagar(null);
            fetchData();
          }}
          gasto={{
            gasto_id: gastoPagar.gasto_id,
            monto_usd: gastoPagar.monto_total_usd,
            monto_pagado_usd: gastoPagar.monto_pagado_usd,
          }}
          bancos={bancos}
          fondos={fondos}
        />
      )}
    </div>
  );
};

export default Gastos;
