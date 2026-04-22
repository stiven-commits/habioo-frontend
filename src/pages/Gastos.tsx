import { useEffect, useMemo, useState } from 'react';
import type { FC, MouseEvent as ReactMouseEvent, ChangeEvent } from 'react';
import DataTable from '../components/ui/DataTable';
import DateRangePicker from '../components/ui/DateRangePicker';
import PageHeader from '../components/ui/PageHeader';
import HabiooLoader from '../components/ui/HabiooLoader';
import { es } from 'date-fns/locale/es';
import { useOutletContext } from 'react-router-dom';
import DropdownMenu from '../components/ui/DropdownMenu';
import StatusBadge from '../components/ui/StatusBadge';
import ModalAgregarGasto from '../components/ModalAgregarGasto';
import ModalDetallesGasto from '../components/ModalDetallesGasto';
import ModalPagarProveedor from '../components/gastos/ModalPagarProveedor';
import ModalVerPagosGasto from '../components/gastos/ModalVerPagosGasto';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';

interface GastosProps {}

interface OutletContextType {
  userRole?: string;
  condominioTipo?: string;
}

type ActiveTab = 'Todos' | 'Comun' | 'Zona' | 'Individual' | 'Extra';
type SortColumn = 'fecha_factura' | 'proveedor' | 'concepto' | 'clasificacion' | 'monto_total_usd' | 'total_cuotas' | 'estado_pago';
type SortDirection = 'asc' | 'desc';

interface GastoCuota {
  cuota_id: number | string;
  gasto_id: number | string;
  proveedor_id?: number | string;
  proveedor: string;
  concepto: string;
  fecha_factura?: string;
  fecha_registro?: string;
  factura_img?: string;
  imagenes?: string[] | string;
  monto_bs?: string | number;
  tasa_cambio?: string | number;
  monto_total_usd?: string | number;
  monto_pagado_usd?: string | number;
  monto_pagado_proveedor_usd?: string | number;
  monto_recaudado_usd?: string | number;
  has_real_pago_proveedor?: boolean;
  cuotas_historicas?: string | number;
  monto_historico_proveedor_usd?: string | number;
  monto_historico_recaudado_usd?: string | number;
  total_cuotas: number;
  nota?: string;
  clasificacion?: string;
  tipo?: string;
  zona_id?: number | string | null;
  propiedad_id?: number | string | null;
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
  proveedor_id?: number | string;
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
  monto_pagado_proveedor_usd: string | number;
  monto_recaudado_usd: string | number;
  has_real_pago_proveedor?: boolean;
  cuotas_historicas?: string | number;
  monto_historico_proveedor_usd?: string | number;
  monto_historico_recaudado_usd?: string | number;
  total_cuotas: number;
  nota?: string;
  clasificacion?: string;
  tipo: string;
  zona_nombre?: string;
  propiedad_identificador?: string;
  cuotas: GastoCuota[];
  canDelete: boolean;
  canEdit: boolean;
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

interface SortConfig {
  column: SortColumn;
  direction: SortDirection;
}

interface HistoricalOriginRow {
  id?: string;
  cuenta_bancaria_id?: string;
  fondo_id?: string;
  monto_usd?: string | number;
  monto_bs?: string | number;
  monto_previo_usd?: string | number;
  monto_previo_bs?: string | number;
  fecha_operacion?: string;
}

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;
const toCents = (value: string | number | undefined | null): number => Math.round(toNumber(value) * 100);

const parseSoportes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return trimmed ? [trimmed] : [];
};

const parseNotaToFields = (nota?: string): {
  numero_documento: string;
  nota: string;
  cuotas_historicas: string;
  monto_historico_proveedor_usd: string;
  monto_historico_proveedor_bs: string;
  monto_historico_recaudado_usd: string;
  monto_historico_recaudado_bs: string;
  monto_historico_recaudado_no_cuenta_usd: string;
  monto_historico_recaudado_no_cuenta_bs: string;
  historico_pagado_origenes: HistoricalOriginRow[];
  historico_recaudado_origenes: HistoricalOriginRow[];
  historico_en_cuenta: boolean;
  historico_cuenta_bancaria_id: string;
  historico_fondo_id: string;
  tasa_historica: string;
  es_historico: boolean;
} => {
  const raw = String(nota || '').trim();
  if (!raw) return { numero_documento: '', nota: '', cuotas_historicas: '0', monto_historico_proveedor_usd: '', monto_historico_proveedor_bs: '', monto_historico_recaudado_usd: '', monto_historico_recaudado_bs: '', monto_historico_recaudado_no_cuenta_usd: '', monto_historico_recaudado_no_cuenta_bs: '', historico_pagado_origenes: [], historico_recaudado_origenes: [], historico_en_cuenta: false, historico_cuenta_bancaria_id: '', historico_fondo_id: '', tasa_historica: '', es_historico: false };
  const cuotasMatch = raw.match(/\[hist\.cuotas:(\d+)\]/i);
  const proveedorUsdMatch = raw.match(/\[hist\.proveedor_usd:([0-9]+(?:\.[0-9]+)?)\]/i);
  const proveedorBsMatch = raw.match(/\[hist\.proveedor_bs:([0-9]+(?:\.[0-9]+)?)\]/i);
  const recaudadoUsdMatch = raw.match(/\[hist\.recaudado_usd:([0-9]+(?:\.[0-9]+)?)\]/i);
  const recaudadoBsMatch = raw.match(/\[hist\.recaudado_bs:([0-9]+(?:\.[0-9]+)?)\]/i);
  const recaudadoNoCuentaUsdMatch = raw.match(/\[hist\.recaudado_no_cuenta_usd:([0-9]+(?:\.[0-9]+)?)\]/i);
  const recaudadoNoCuentaBsMatch = raw.match(/\[hist\.recaudado_no_cuenta_bs:([0-9]+(?:\.[0-9]+)?)\]/i);
  const histBankCuentaMatch = raw.match(/\[hist\.bank_cuenta_id:(\d+)\]/i);
  const histBankFondoMatch = raw.match(/\[hist\.bank_fondo_id:(\d+)\]/i);
  const pagadoRowsMatch = raw.match(/\[hist\.pagado_rows_b64:([A-Za-z0-9+/=_-]+)\]/i);
  const recaudadoRowsMatch = raw.match(/\[hist\.recaudado_rows_b64:([A-Za-z0-9+/=_-]+)\]/i);
  const tasaHistoricaMatch = raw.match(/\[hist\.tasa:([0-9]+(?:\.[0-9]+)?)\]/i);
  const histBankEnabled = /\[hist\.bank_enabled:1\]/i.test(raw);
  const esHistorico = /\[hist\.no_aviso:1\]/i.test(raw);
  const decodeRows = (value?: string): HistoricalOriginRow[] => {
    if (!value) return [];
    try {
      const json = atob(value);
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((row) => ({
        cuenta_bancaria_id: String((row as { cuenta_bancaria_id?: string | number }).cuenta_bancaria_id || ''),
        fondo_id: String((row as { fondo_id?: string | number }).fondo_id || ''),
        monto_usd: String((row as { monto_usd?: string | number }).monto_usd || ''),
        monto_bs: String((row as { monto_bs?: string | number }).monto_bs || ''),
        monto_previo_usd: String((row as { monto_previo_usd?: string | number }).monto_previo_usd || ''),
        monto_previo_bs: String((row as { monto_previo_bs?: string | number }).monto_previo_bs || ''),
        fecha_operacion: String((row as { fecha_operacion?: string }).fecha_operacion || ''),
      }));
    } catch {
      return [];
    }
  };
  const pagadoRows = decodeRows(pagadoRowsMatch?.[1]);
  const recaudadoRows = decodeRows(recaudadoRowsMatch?.[1]);
  const hasRowsBank = recaudadoRows.length > 0;

  const clean = raw
    .replace(/\s*\|\s*\[hist\.cuotas:\d+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.proveedor_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.proveedor_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.recaudado_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.recaudado_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.recaudado_no_cuenta_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.recaudado_no_cuenta_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.tasa:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\s*\|\s*\[hist\.bank_enabled:1\]/gi, '')
    .replace(/\s*\|\s*\[hist\.bank_cuenta_id:\d+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.bank_fondo_id:\d+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.pagado_rows_b64:[A-Za-z0-9+/=_-]+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.recaudado_rows_b64:[A-Za-z0-9+/=_-]+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.no_aviso:1\]/gi, '')
    .replace(/\[hist\.cuotas:\d+\]/gi, '')
    .replace(/\[hist\.proveedor_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.proveedor_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.recaudado_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.recaudado_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.recaudado_no_cuenta_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.recaudado_no_cuenta_bs:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.tasa:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.bank_enabled:1\]/gi, '')
    .replace(/\[hist\.bank_cuenta_id:\d+\]/gi, '')
    .replace(/\[hist\.bank_fondo_id:\d+\]/gi, '')
    .replace(/\[hist\.pagado_rows_b64:[A-Za-z0-9+/=_-]+\]/gi, '')
    .replace(/\[hist\.recaudado_rows_b64:[A-Za-z0-9+/=_-]+\]/gi, '')
    .replace(/\[hist\.no_aviso:1\]/gi, '')
    .trim();
  const match = clean.match(/^Nro\.\s*recibo\/factura:\s*([^|]+?)(?:\s*\|\s*(.*))?$/i);
  if (!match) {
    return {
      numero_documento: '',
      nota: clean,
      cuotas_historicas: cuotasMatch?.[1] || '0',
      monto_historico_proveedor_usd: proveedorUsdMatch?.[1] ? formatMoney(Number(proveedorUsdMatch[1])) : '',
      monto_historico_proveedor_bs: proveedorBsMatch?.[1] ? formatMoney(Number(proveedorBsMatch[1])) : '',
      monto_historico_recaudado_usd: recaudadoUsdMatch?.[1] ? formatMoney(Number(recaudadoUsdMatch[1])) : '',
      monto_historico_recaudado_bs: recaudadoBsMatch?.[1] ? formatMoney(Number(recaudadoBsMatch[1])) : '',
      monto_historico_recaudado_no_cuenta_usd: recaudadoNoCuentaUsdMatch?.[1] ? formatMoney(Number(recaudadoNoCuentaUsdMatch[1])) : '',
      monto_historico_recaudado_no_cuenta_bs: recaudadoNoCuentaBsMatch?.[1] ? formatMoney(Number(recaudadoNoCuentaBsMatch[1])) : '',
      historico_pagado_origenes: pagadoRows,
      historico_recaudado_origenes: recaudadoRows,
      historico_en_cuenta: hasRowsBank || histBankEnabled,
      historico_cuenta_bancaria_id: histBankCuentaMatch?.[1] || '',
      historico_fondo_id: histBankFondoMatch?.[1] || '',
      tasa_historica: tasaHistoricaMatch?.[1] ? formatMoney(Number(tasaHistoricaMatch[1]), 3) : '',
      es_historico: esHistorico,
    };
  }
  return {
    numero_documento: String(match[1] || '').trim(),
    nota: String(match[2] || '').trim(),
    cuotas_historicas: cuotasMatch?.[1] || '0',
    monto_historico_proveedor_usd: proveedorUsdMatch?.[1] ? formatMoney(Number(proveedorUsdMatch[1])) : '',
    monto_historico_proveedor_bs: proveedorBsMatch?.[1] ? formatMoney(Number(proveedorBsMatch[1])) : '',
    monto_historico_recaudado_usd: recaudadoUsdMatch?.[1] ? formatMoney(Number(recaudadoUsdMatch[1])) : '',
    monto_historico_recaudado_bs: recaudadoBsMatch?.[1] ? formatMoney(Number(recaudadoBsMatch[1])) : '',
    monto_historico_recaudado_no_cuenta_usd: recaudadoNoCuentaUsdMatch?.[1] ? formatMoney(Number(recaudadoNoCuentaUsdMatch[1])) : '',
    monto_historico_recaudado_no_cuenta_bs: recaudadoNoCuentaBsMatch?.[1] ? formatMoney(Number(recaudadoNoCuentaBsMatch[1])) : '',
    historico_pagado_origenes: pagadoRows,
    historico_recaudado_origenes: recaudadoRows,
    historico_en_cuenta: hasRowsBank || histBankEnabled,
    historico_cuenta_bancaria_id: histBankCuentaMatch?.[1] || '',
    historico_fondo_id: histBankFondoMatch?.[1] || '',
    tasa_historica: tasaHistoricaMatch?.[1] ? formatMoney(Number(tasaHistoricaMatch[1]), 3) : '',
    es_historico: esHistorico,
  };
};

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

const Gastos: FC<GastosProps> = () => {
  const { userRole, condominioTipo } = useOutletContext<OutletContextType>();
  const isJuntaGeneral = String(condominioTipo || '').trim().toLowerCase() === 'junta general';
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'fecha_factura', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 13;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [gastoEnEdicion, setGastoEnEdicion] = useState<GastoAgrupado | null>(null);
  const [selectedGasto, setSelectedGasto] = useState<GastoAgrupado | null>(null);
  const [expandedRows, setExpandedRows] = useState<ExpandedRows>({});
  const [isModalPagarOpen, setIsModalPagarOpen] = useState<boolean>(false);
  const [gastoPagar, setGastoPagar] = useState<IGasto | null>(null);
  const [isModalVerPagosOpen, setIsModalVerPagosOpen] = useState<boolean>(false);
  const [gastoVerPagos, setGastoVerPagos] = useState<IGasto | null>(null);

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resGastos, resProv, resBancos, resFondos] = await Promise.all([
        fetch(`${API_BASE_URL}/gastos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/proveedores`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      let resZonas: Response | null = null;
      let resProps: Response | null = null;
      if (!isJuntaGeneral) {
        const results = await Promise.all([
          fetch(`${API_BASE_URL}/zonas`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        [resZonas, resProps] = results;
      }

      const dataGastos: GastosApiResponse = await resGastos.json();
      const dataProv: ProveedoresApiResponse = await resProv.json();
      const dataBancos: BancosApiResponse = await resBancos.json();
      const dataFondos: FondosApiResponse = await resFondos.json();
      const dataZonas: ZonasApiResponse | null = resZonas ? await resZonas.json() : null;
      const dataProps: PropiedadesApiResponse | null = resProps ? await resProps.json() : null;

      if (dataGastos.status === 'success') {
        const agrupados = dataGastos.gastos.reduce<Record<string, GastoAgrupado>>((acc, curr) => {
          const key = String(curr.gasto_id);
          const imagenesActuales = parseSoportes(curr.imagenes);
          if (!acc[key]) {
            const nuevo: GastoAgrupado = {
              gasto_id: curr.gasto_id,
              proveedor: curr.proveedor,
              concepto: curr.concepto,
              fecha_factura: curr.fecha_factura || 'N/A',
              fecha_registro: curr.fecha_registro || 'N/A',
              imagenes: imagenesActuales,
              monto_bs: curr.monto_bs ?? 0,
              tasa_cambio: curr.tasa_cambio ?? 0,
              monto_total_usd: curr.monto_total_usd ?? 0,
              monto_pagado_usd: curr.monto_pagado_usd || 0,
              monto_pagado_proveedor_usd: curr.monto_pagado_proveedor_usd || 0,
              monto_recaudado_usd: curr.monto_recaudado_usd || 0,
              has_real_pago_proveedor: Boolean(curr.has_real_pago_proveedor),
              cuotas_historicas: curr.cuotas_historicas ?? 0,
              monto_historico_proveedor_usd: curr.monto_historico_proveedor_usd ?? 0,
              monto_historico_recaudado_usd: curr.monto_historico_recaudado_usd ?? 0,
              total_cuotas: curr.total_cuotas,
              tipo: curr.tipo || 'Comun',
              clasificacion: curr.clasificacion || 'Variable',
              cuotas: [],
              canDelete: true,
              canEdit: true,
            };
            if (curr.factura_img) nuevo.factura_img = curr.factura_img;
            if (curr.nota) nuevo.nota = curr.nota;
            if (curr.zona_nombre) nuevo.zona_nombre = curr.zona_nombre;
            if (curr.propiedad_identificador) nuevo.propiedad_identificador = curr.propiedad_identificador;
            acc[key] = nuevo;
          }
          const gastoActual = acc[key];
          if (!gastoActual) return acc;
          if (imagenesActuales.length > 0) {
            const merged = new Set<string>([...gastoActual.imagenes, ...imagenesActuales]);
            gastoActual.imagenes = Array.from(merged);
          }
          if (curr.proveedor_id !== undefined && curr.proveedor_id !== null && String(curr.proveedor_id) !== '') {
            gastoActual.proveedor_id = curr.proveedor_id;
          }
          gastoActual.monto_pagado_usd = Math.max(
            toNumber(gastoActual.monto_pagado_usd),
            toNumber(curr.monto_pagado_usd)
          );
          gastoActual.monto_pagado_proveedor_usd = Math.max(
            toNumber(gastoActual.monto_pagado_proveedor_usd),
            toNumber(curr.monto_pagado_proveedor_usd)
          );
          gastoActual.monto_recaudado_usd = Math.max(
            toNumber(gastoActual.monto_recaudado_usd),
            toNumber(curr.monto_recaudado_usd)
          );
          if (curr.has_real_pago_proveedor) {
            gastoActual.canDelete = false;
          }
          gastoActual.has_real_pago_proveedor = Boolean(gastoActual.has_real_pago_proveedor || curr.has_real_pago_proveedor);
          gastoActual.cuotas.push(curr);
          if (curr.estado !== 'Pendiente') {
            gastoActual.canDelete = false;
            gastoActual.canEdit = false;
          }
          return acc;
        }, {});
        setGastosAgrupados(Object.values(agrupados));
      }

      if (dataProv.status === 'success') setProveedores(dataProv.proveedores);
      if (dataZonas?.status === 'success') setZonas((dataZonas.zonas || []).filter((z: Zona) => z.activa));
      if (dataProps?.status === 'success') setPropiedades(dataProps.propiedades || []);
      if (isJuntaGeneral) {
        setZonas([]);
        setPropiedades([]);
      }
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
  }, [userRole, condominioTipo]);

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

  const getEstadoPago = (gasto: GastoAgrupado): 'Pendiente' | 'Abonado' | 'Pagado' => {
    const totalCents = toCents(gasto.monto_total_usd);
    const pagadoCents = toCents(gasto.monto_pagado_proveedor_usd);
    if (pagadoCents <= 0) return 'Pendiente';
    if (pagadoCents < totalCents) return 'Abonado';
    return 'Pagado';
  };

  const sortedGastos = useMemo<GastoAgrupado[]>(() => {
    const list = [...filteredGastos];
    list.sort((a: GastoAgrupado, b: GastoAgrupado) => {
      let cmp = 0;
      switch (sortConfig.column) {
        case 'fecha_factura': {
          const da = parseDisplayDate(a.fecha_factura)?.getTime() || 0;
          const db = parseDisplayDate(b.fecha_factura)?.getTime() || 0;
          cmp = da - db;
          break;
        }
        case 'proveedor':
          cmp = a.proveedor.localeCompare(b.proveedor, 'es', { sensitivity: 'base' });
          break;
        case 'concepto':
          cmp = a.concepto.localeCompare(b.concepto, 'es', { sensitivity: 'base' });
          break;
        case 'clasificacion':
          cmp = String(a.clasificacion || 'Variable').localeCompare(String(b.clasificacion || 'Variable'), 'es', { sensitivity: 'base' });
          break;
        case 'monto_total_usd':
          cmp = toNumber(a.monto_total_usd) - toNumber(b.monto_total_usd);
          break;
        case 'total_cuotas':
          cmp = a.total_cuotas - b.total_cuotas;
          break;
        case 'estado_pago': {
          const order: Record<'Pendiente' | 'Abonado' | 'Pagado', number> = { Pendiente: 0, Abonado: 1, Pagado: 2 };
          cmp = order[getEstadoPago(a)] - order[getEstadoPago(b)];
          break;
        }
        default:
          cmp = 0;
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredGastos, sortConfig]);

  const paginatedGastos = sortedGastos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPagesSorted = Math.ceil(sortedGastos.length / ITEMS_PER_PAGE);

  const toggleRow = (id: number | string, e: ReactMouseEvent<HTMLElement>): void => {
    e.stopPropagation();
    const key = String(id);
    setExpandedRows((prev: ExpandedRows) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSort = (column: SortColumn): void => {
    setSortConfig((prev: SortConfig) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
  };

  const sortIndicator = (column: SortColumn): string => {
    if (sortConfig.column !== column) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getExtraProgress = (gasto: GastoAgrupado): ExtraProgress => {
    const total = toNumber(gasto?.monto_total_usd);
    const pagado = toNumber(gasto?.monto_recaudado_usd);
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const safePagado = Number.isFinite(pagado) ? Math.max(0, pagado) : 0;
    if (safeTotal <= 0) return { pagado: safePagado, total: safeTotal, pct: 0, isComplete: false };
    const pct = Math.min(100, Math.max(0, (safePagado / safeTotal) * 100));
    return { pagado: safePagado, total: safeTotal, pct, isComplete: safePagado >= safeTotal };
  };

  const handleDelete = async (gastoId: number | string): Promise<void> => {
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

  const handleEditGasto = (gasto: GastoAgrupado): void => {
    if (!gasto.canEdit) {
      alert('Este gasto ya fue incluido en aviso(s) de cobro y no puede editarse.');
      return;
    }
    setGastoEnEdicion(gasto);
    setIsModalOpen(true);
  };

  const handleRegistrarPago = async (gasto: GastoAgrupado): Promise<void> => {
    const yaEnAviso = gasto.cuotas.some((c: GastoCuota) => String(c.estado || '').toLowerCase() !== 'pendiente');
    if (!yaEnAviso) {
      const ok = await showConfirm({
        title: 'Pago previo al aviso de cobro',
        message: 'Este gasto aún no ha sido agregado en un aviso de cobro. ¿Seguro que deseas registrar un pago ahora? Esto afectará el estado de cuenta bancario que selecciones para pagar.',
        confirmText: 'Sí, registrar pago',
        cancelText: 'Cancelar',
        variant: 'warning',
      });
      if (!ok) return;
    }

    setGastoPagar(gasto);
    setIsModalPagarOpen(true);
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Gestión de Gastos"
        actions={
          <button
            onClick={() => { setGastoEnEdicion(null); setIsModalOpen(true); }}
            className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap shadow-md"
          >
            + Nuevo Gasto
          </button>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Buscar concepto, proveedor..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"
            />
          </div>
          <div className="min-w-[290px]">
            <DateRangePicker
              from={ymdToDate(fechaDesde)}
              to={ymdToDate(fechaHasta)}
              onChange={({ from, to }) => { setFechaDesde(dateToYmd(from)); setFechaHasta(dateToYmd(to)); }}
              locale={es}
              placeholderText="Rango (dd/mm/yyyy - dd/mm/yyyy)"
              wrapperClassName="w-full min-w-0"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 p-2 pr-10 text-xs outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          >
            Limpiar
          </button>
        </div>
      </PageHeader>

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
                  ? 'text-donezo-primary dark:text-white'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {tab === 'Comun' ? 'Comunes' : tab === 'Zona' ? 'Por Áreas / Sectores' : tab === 'Individual' ? 'Individuales' : tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-1 bg-donezo-primary dark:bg-white rounded-t-full"></span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <HabiooLoader size="sm" message="" className="min-h-[180px] py-0" />
          ) : filteredGastos.length === 0 ? (
            <p className="text-gray-500 text-center py-8 dark:text-gray-400">No se encontraron gastos.</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Tip: haz doble click sobre un gasto para ver sus detalles.
              </p>
              <DataTable
                columns={[
                  {
                    key: 'expand',
                    header: '',
                    size: 44,
                    minSize: 44,
                    maxSize: 44,
                    headerClassName: 'w-[44px]',
                    className: 'w-[44px]',
                    render: (g) => (
                      <button
                        type="button"
                        className="text-gray-400 hover:text-donezo-primary transition-colors text-lg"
                        onClick={(e: ReactMouseEvent<HTMLButtonElement>) => toggleRow(g.gasto_id, e)}
                      >
                        {expandedRows[String(g.gasto_id)] ? '▼' : '▶'}
                      </button>
                    ),
                  },
                  {
                    key: 'fechas',
                    size: 124,
                    minSize: 124,
                    maxSize: 124,
                    headerClassName: 'whitespace-nowrap',
                    className: 'whitespace-nowrap',
                    header: (
                      <button type="button" onClick={() => toggleSort('fecha_factura')} className="font-bold hover:text-donezo-primary">
                        Fechas {sortIndicator('fecha_factura')}
                      </button>
                    ),
                    render: (g) => (
                      <>
                        <span className="block text-xs font-bold text-gray-800 dark:text-gray-300">📄 {g.fecha_factura}</span>
                        <span className="block text-[10px] text-gray-400">💻 {g.fecha_registro}</span>
                      </>
                    ),
                  },
                  {
                    key: 'proveedor',
                    header: (
                      <button type="button" onClick={() => toggleSort('proveedor')} className="font-bold hover:text-donezo-primary">
                        Proveedor {sortIndicator('proveedor')}
                      </button>
                    ),
                    className: 'font-bold text-gray-800 dark:text-gray-300',
                    render: (g) => g.proveedor,
                  },
                  {
                    key: 'concepto',
                    header: (
                      <button type="button" onClick={() => toggleSort('concepto')} className="font-bold hover:text-donezo-primary">
                        Concepto {sortIndicator('concepto')}
                      </button>
                    ),
                    render: (g) => (
                      <>
                        <div className="text-gray-600 dark:text-gray-400 truncate max-w-[200px] text-sm" title={g.concepto}>
                          {g.concepto}
                        </div>
                        <StatusBadge color={String(g.clasificacion || 'Variable') === 'Fijo' ? 'blue' : 'slate'} className="mt-1 mr-1">
                          {String(g.clasificacion || 'Variable') === 'Fijo' ? 'Gasto fijo' : 'Gasto variable'}
                        </StatusBadge>
                        {(g.tipo === 'Zona' || g.tipo === 'No Comun') && (
                          <StatusBadge color="purple" className="mt-1">Zona: {g.zona_nombre || 'Especifica'}</StatusBadge>
                        )}
                        {g.tipo === 'Individual' && (
                          <StatusBadge color="orange" className="mt-1">Apto/Casa: {g.propiedad_identificador}</StatusBadge>
                        )}
                        {g.tipo === 'Extra' && (
                          <StatusBadge color="red" className="mt-1">Extra</StatusBadge>
                        )}
                      </>
                    ),
                  },
                  {
                    key: 'monto',
                    header: (
                      <button type="button" onClick={() => toggleSort('monto_total_usd')} className="font-bold hover:text-donezo-primary">
                        Monto Total {sortIndicator('monto_total_usd')}
                      </button>
                    ),
                    headerClassName: 'text-right',
                    className: 'text-right font-bold text-gray-800 dark:text-white',
                    render: (g) => {
                      const extraProgress = g.tipo === 'Extra' ? getExtraProgress(g) : null;
                      return g.tipo === 'Extra' && extraProgress ? (
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
                      );
                    },
                  },
                  {
                    key: 'cuotas',
                    header: (
                      <button type="button" onClick={() => toggleSort('total_cuotas')} className="font-bold hover:text-donezo-primary">
                        Cuotas {sortIndicator('total_cuotas')}
                      </button>
                    ),
                    headerClassName: 'text-center',
                    className: 'text-center',
                    render: (g) => (
                      <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1 px-3 rounded-full text-xs font-bold">
                        {g.total_cuotas} Mes{g.total_cuotas > 1 ? 'es' : ''}
                      </span>
                    ),
                  },
                  {
                    key: 'estado_pago',
                    header: (
                      <button type="button" onClick={() => toggleSort('estado_pago')} className="font-bold hover:text-donezo-primary">
                        Estado de deuda {sortIndicator('estado_pago')}
                      </button>
                    ),
                    headerClassName: 'text-center',
                    className: 'text-center',
                    render: (g) => {
                      const montoTotal = toNumber(g.monto_total_usd);
                      const montoPagado = toNumber(g.monto_pagado_proveedor_usd);
                      const montoTotalCents = toCents(g.monto_total_usd);
                      const montoPagadoCents = toCents(g.monto_pagado_proveedor_usd);
                      const progresoPago = montoTotalCents > 0 ? Math.min(100, (montoPagadoCents / montoTotalCents) * 100) : 0;
                      const estadoPago: 'Pendiente' | 'Abonado' | 'Pagado' =
                        montoPagadoCents <= 0 ? 'Pendiente' : montoPagadoCents < montoTotalCents ? 'Abonado' : 'Pagado';
                      const estadoPagoColor = estadoPago === 'Pagado' ? 'emerald' : estadoPago === 'Abonado' ? 'amber' : 'red';
                      return (
                        <>
                          <StatusBadge color={estadoPagoColor} size="md" className="font-black">{estadoPago}</StatusBadge>
                          <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-300">
                            ${formatMoney(montoPagado)} / ${formatMoney(montoTotal)}
                          </p>
                          <div className="mx-auto mt-1 h-1.5 w-28 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${estadoPago === 'Pagado' ? 'bg-emerald-500' : estadoPago === 'Abonado' ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${progresoPago}%` }}
                            />
                          </div>
                        </>
                      );
                    },
                  },
                  {
                    key: 'acciones',
                    header: 'Acciones',
                    headerClassName: 'text-center',
                    className: 'text-center',
                    render: (g) => (
                      <DropdownMenu width={208} items={[
                        { label: 'Ver pagos', onClick: () => { setGastoVerPagos(g); setIsModalVerPagosOpen(true); } },
                        { label: 'Registrar pago', onClick: () => { void handleRegistrarPago(g); }, disabled: toCents(g.monto_pagado_proveedor_usd) >= toCents(g.monto_total_usd) },
                        { label: 'Editar gasto', onClick: () => handleEditGasto(g), disabled: !g.canEdit },
                        { label: 'Eliminar', onClick: () => { void handleDelete(g.gasto_id); }, variant: 'danger', disabled: !g.canDelete },
                      ]} />
                    ),
                  },
                ]}
                data={paginatedGastos}
                keyExtractor={(g) => g.gasto_id}
                rowClassName="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors select-none"
                onRowDoubleClick={(g) => setSelectedGasto(g)}
                renderExpandedRow={(g) =>
                  expandedRows[String(g.gasto_id)]
                    ? g.cuotas.map((c: GastoCuota, cuotaIndex: number) => (
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
                      ))
                    : null
                }
              />

              {totalPagesSorted > 1 && (
                <div className="flex justify-between items-center mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPagesSorted}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 disabled:opacity-50 text-sm font-bold"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p: number) => Math.min(totalPagesSorted, p + 1))}
                      disabled={currentPage === totalPagesSorted}
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
          onClose={() => {
            setIsModalOpen(false);
            setGastoEnEdicion(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setGastoEnEdicion(null);
            fetchData();
          }}
          proveedores={proveedores}
          zonas={zonas}
          propiedades={propiedades}
          bancos={bancos}
          fondos={fondos}
          mode={gastoEnEdicion ? 'edit' : 'create'}
          gastoId={gastoEnEdicion?.gasto_id ?? null}
          existingFacturaUrl={gastoEnEdicion?.factura_img || null}
          existingSoportesUrls={Array.isArray(gastoEnEdicion?.imagenes) ? gastoEnEdicion.imagenes : []}
              {...(gastoEnEdicion
            ? {
                initialValues: (() => {
                  const notaFields = parseNotaToFields(gastoEnEdicion.nota);
                  const tasaHistoricaNum = toNumber(notaFields.tasa_historica) > 0
                    ? toNumber(notaFields.tasa_historica)
                    : toNumber(gastoEnEdicion.tasa_cambio);
                  const montoHistProveedorUsdNum = toNumber(notaFields.monto_historico_proveedor_usd);
                  const montoHistProveedorBsNum = toNumber(notaFields.monto_historico_proveedor_bs);
                  const montoHistRecaudadoUsdNum = toNumber(notaFields.monto_historico_recaudado_usd);
                  const montoHistRecaudadoBsNum = toNumber(notaFields.monto_historico_recaudado_bs);
                  return {
                    proveedor_id: String(gastoEnEdicion.proveedor_id || gastoEnEdicion.cuotas[0]?.proveedor_id || ''),
                    concepto: String(gastoEnEdicion.concepto || ''),
                    numero_documento: notaFields.numero_documento,
                    monto_bs: formatMoney(toNumber(gastoEnEdicion.monto_bs)),
                    monto_total_usd: toNumber(gastoEnEdicion.monto_total_usd),
                    tasa_cambio: formatMoney(toNumber(gastoEnEdicion.tasa_cambio), 3),
                    total_cuotas: String(gastoEnEdicion.total_cuotas || 1),
                    nota: notaFields.nota,
                    cuotas_historicas: notaFields.cuotas_historicas,
                    monto_historico_proveedor_usd: montoHistProveedorUsdNum > 0 ? formatMoney(montoHistProveedorUsdNum) : '',
                    monto_historico_proveedor_bs: montoHistProveedorBsNum > 0 ? formatMoney(montoHistProveedorBsNum) : formatMoney(tasaHistoricaNum > 0 ? (montoHistProveedorUsdNum * tasaHistoricaNum) : 0),
                    monto_historico_recaudado_usd: montoHistRecaudadoUsdNum > 0 ? formatMoney(montoHistRecaudadoUsdNum) : '',
                    monto_historico_recaudado_bs: montoHistRecaudadoBsNum > 0 ? formatMoney(montoHistRecaudadoBsNum) : formatMoney(tasaHistoricaNum > 0 ? (montoHistRecaudadoUsdNum * tasaHistoricaNum) : 0),
                    monto_historico_recaudado_no_cuenta_usd: notaFields.monto_historico_recaudado_no_cuenta_usd || '',
                    monto_historico_recaudado_no_cuenta_bs: notaFields.monto_historico_recaudado_no_cuenta_bs || '',
                    historico_pagado_origenes: notaFields.historico_pagado_origenes || [],
                    historico_recaudado_origenes: notaFields.historico_recaudado_origenes || [],
                    historico_en_cuenta: notaFields.historico_en_cuenta,
                    historico_cuenta_bancaria_id: notaFields.historico_cuenta_bancaria_id,
                    historico_fondo_id: notaFields.historico_fondo_id,
                    tasa_historica: tasaHistoricaNum > 0 ? formatMoney(tasaHistoricaNum, 3) : '',
                    es_historico: notaFields.es_historico,
                    clasificacion: String(gastoEnEdicion.clasificacion || 'Variable') === 'Fijo' ? 'Fijo' : 'Variable',
                    asignacion_tipo: (gastoEnEdicion.tipo === 'No Comun' ? 'Zona' : (gastoEnEdicion.tipo || 'Comun')) as 'Comun' | 'Zona' | 'Individual' | 'Extra',
                    zona_id: String(gastoEnEdicion.cuotas[0]?.zona_id || ''),
                    propiedad_id: String(gastoEnEdicion.cuotas[0]?.propiedad_id || ''),
                    fecha_gasto: parseDisplayDate(gastoEnEdicion.fecha_factura) ? dateToYmd(parseDisplayDate(gastoEnEdicion.fecha_factura)) : '',
                  };
                })(),
              }
            : {})}
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
            monto_pagado_usd: gastoPagar.monto_pagado_proveedor_usd,
            proveedor: gastoPagar.proveedor,
            concepto: gastoPagar.concepto,
          }}
          bancos={bancos}
          fondos={fondos}
        />
      )}

      {isModalVerPagosOpen && gastoVerPagos && (
        <ModalVerPagosGasto
          isOpen={isModalVerPagosOpen}
          onClose={() => {
            setIsModalVerPagosOpen(false);
            setGastoVerPagos(null);
          }}
          gasto={{
            gasto_id: gastoVerPagos.gasto_id,
            proveedor: gastoVerPagos.proveedor,
            concepto: gastoVerPagos.concepto,
            tipo: gastoVerPagos.tipo,
          }}
        />
      )}
    </div>
  );
};

export default Gastos;


