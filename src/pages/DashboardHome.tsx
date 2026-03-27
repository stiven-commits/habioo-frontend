import { useEffect, useState, type FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp,
  AlertCircle,
  DollarSign,
  Wallet,
  FileText,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { API_BASE_URL } from '../config/api';
import { formatMoney } from '../utils/currency';

interface DashboardHomeProps {}

type UserRole = 'Propietario' | 'Administrador' | string;

interface DashboardUser {
  nombre?: string;
}

interface OutletContextType {
  user?: DashboardUser;
  userRole?: UserRole;
}

interface BalanceRow {
  mes: string;
  ingresos: number;
  egresos: number;
}

interface GastoRow {
  name: string;
  value: number;
}

interface UltimoMovimiento {
  inmueble: string;
  metodo: string;
  monto: number;
  hora: string;
  estado: string;
}

interface AdminResumenApiResponse {
  status: string;
  data?: {
    liquidez?: number;
    por_cobrar?: number;
    cuentas_por_pagar?: number;
    egresos_mes?: number;
  };
}

interface AdminGraficosApiResponse {
  status: string;
  dataBalance?: BalanceRow[];
  dataGastos?: GastoRow[];
}

interface AlertasDashboard {
  pagosPendientesAprobacion?: number;
  solicitudesAlquilerPendientes?: number;
  pagosAlquilerReportados?: number;
}

interface AdminMovimientosApiResponse {
  status: string;
  data?: {
    ultimosPagos?: Array<{
      monto_usd?: number | string;
      metodo?: string | null;
      fecha_pago?: string;
      estado?: string | null;
      identificador?: string;
    }>;
    alertas?: AlertasDashboard;
  };
}

interface KpisState {
  liquidez: number;
  porCobrar: number;
  cuentasPorPagar: number;
  egresosMes: number;
}

interface GraficosState {
  dataBalance: BalanceRow[];
  dataGastos: GastoRow[];
}

const COLORS: string[] = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const toSafeNumber = (...values: unknown[]): number => {
  for (const value of values) {
    const parsed = Number(value ?? 0);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const DashboardHome: FC<DashboardHomeProps> = () => {
  const { user, userRole } = useOutletContext<OutletContextType>();
  const [kpis, setKpis] = useState<KpisState>({
    liquidez: 0,
    porCobrar: 0,
    cuentasPorPagar: 0,
    egresosMes: 0,
  });
  const [loadingKpis, setLoadingKpis] = useState<boolean>(false);
  const [graficos, setGraficos] = useState<GraficosState>({
    dataBalance: [],
    dataGastos: [],
  });
  const [ultimosMovimientos, setUltimosMovimientos] = useState<UltimoMovimiento[]>([]);
  const [alertas, setAlertas] = useState<Required<AlertasDashboard>>({
    pagosPendientesAprobacion: 0,
    solicitudesAlquilerPendientes: 0,
    pagosAlquilerReportados: 0,
  });

  useEffect(() => {
    if (userRole !== 'Administrador') return;
    const token = localStorage.getItem('habioo_token');
    if (!token) return;

    const fetchDashboardData = async (): Promise<void> => {
      setLoadingKpis(true);
      try {
        const [resResumen, resGraficos, resMovimientos] = await Promise.all([
          fetch(`${API_BASE_URL}/admin-resumen`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/admin-graficos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/admin-movimientos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const resumenPayload: AdminResumenApiResponse = await resResumen.json();
        const graficosPayload: AdminGraficosApiResponse = await resGraficos.json();
        const movimientosPayload: AdminMovimientosApiResponse = await resMovimientos.json();

        if (resResumen.ok && resumenPayload.status === 'success' && resumenPayload.data) {
          const rawResumen = resumenPayload.data as Record<string, unknown>;
          let porCobrar = toSafeNumber(
            rawResumen.por_cobrar,
            rawResumen.porCobrar,
            rawResumen.total_deuda,
            rawResumen.totalDeuda
          );

          // Fallback defensivo: si el backend responde por_cobrar=0 pero existen deudas
          // en propiedades-admin, usamos esa suma para mantener consistencia en UI.
          if (porCobrar <= 0) {
            try {
              const resProps = await fetch(`${API_BASE_URL}/propiedades-admin`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const propsPayload = await resProps.json();
              if (resProps.ok && propsPayload?.status === 'success' && Array.isArray(propsPayload?.propiedades)) {
                porCobrar = propsPayload.propiedades.reduce((acc: number, prop: { saldo_actual?: number | string }) => {
                  const saldo = toSafeNumber(prop?.saldo_actual);
                  return saldo > 0 ? acc + saldo : acc;
                }, 0);
              }
            } catch (_fallbackError) {
              // Silencioso: mantenemos el valor base si falla el fallback.
            }
          }

          setKpis({
            liquidez: toSafeNumber(rawResumen.liquidez),
            porCobrar,
            cuentasPorPagar: toSafeNumber(rawResumen.cuentas_por_pagar, rawResumen.cuentasPorPagar),
            egresosMes: toSafeNumber(rawResumen.egresos_mes, rawResumen.egresosMes),
          });
        }

        if (resGraficos.ok && graficosPayload.status === 'success') {
          setGraficos({
            dataBalance: Array.isArray(graficosPayload.dataBalance) ? graficosPayload.dataBalance : [],
            dataGastos: Array.isArray(graficosPayload.dataGastos) ? graficosPayload.dataGastos : [],
          });
        }

        if (resMovimientos.ok && movimientosPayload.status === 'success') {
          const ultimos = Array.isArray(movimientosPayload.data?.ultimosPagos)
            ? movimientosPayload.data?.ultimosPagos
            : [];

          setUltimosMovimientos(
            ultimos.map((mov) => ({
              inmueble: String(mov.identificador || '-'),
              metodo: String(mov.metodo || 'Metodo no definido'),
              monto: Number(mov.monto_usd || 0),
              hora: mov.fecha_pago
                ? new Date(mov.fecha_pago).toLocaleString('es-VE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : '-',
              estado: String(mov.estado || ''),
            }))
          );

          setAlertas({
            pagosPendientesAprobacion: Number(movimientosPayload.data?.alertas?.pagosPendientesAprobacion || 0),
            solicitudesAlquilerPendientes: Number(movimientosPayload.data?.alertas?.solicitudesAlquilerPendientes || 0),
            pagosAlquilerReportados: Number(movimientosPayload.data?.alertas?.pagosAlquilerReportados || 0),
          });
        }
      } catch (error) {
        console.error('Error cargando dashboard admin:', error);
      } finally {
        setLoadingKpis(false);
      }
    };

    void fetchDashboardData();
  }, [userRole]);

  if (userRole !== 'Administrador') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <p className="text-gray-700 dark:text-gray-200">
          Esta vista de panel principal esta disponible para la Junta de Condominio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Panel Principal</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bienvenido, {user?.nombre || 'Usuario'}. Resumen financiero y operativo del condominio.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Liquidez Total</p>
            <span className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.liquidez)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Saldo agregado de fondos y cuentas</p>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Por Cobrar (Real)</p>
            <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.porCobrar)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">Suma de deuda actual de inmuebles</p>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Egresos del Mes (Real)</p>
            <span className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.egresosMes)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400">Egresos de todas las cuentas/fondos</p>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Cuentas por Pagar</p>
            <span className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.cuentasPorPagar)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">Cuotas de gastos pendientes</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <article className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ingresos vs Egresos (Ultimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={graficos.dataBalance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="mes" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                formatter={(value) => `$${formatMoney(Number(value) || 0)}`}
              />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#16A34A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#F97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Distribucion de Gastos (Mes)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={graficos.dataGastos}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {graficos.dataGastos.map((_, index) => (
                  <Cell key={`gasto-${index}`} fill={COLORS[index % COLORS.length] ?? '#8884d8'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${formatMoney(Number(value) || 0)}`} />
            </PieChart>
          </ResponsiveContainer>

          {graficos.dataGastos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin gastos pendientes en el mes actual.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {graficos.dataGastos.map((item: GastoRow, index: number) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-gray-700 dark:text-gray-200">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">${formatMoney(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Alertas y Pendientes</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">
                {alertas.pagosPendientesAprobacion} pagos de propietarios pendientes de aprobacion.
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">
                {alertas.solicitudesAlquilerPendientes} solicitudes de alquiler pendientes por revisar.
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <FileText className="w-4 h-4 text-rose-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">
                {alertas.pagosAlquilerReportados} pagos de alquiler reportados pendientes de validacion.
              </span>
            </li>
          </ul>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ultimos Movimientos</h3>
          {ultimosMovimientos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay pagos recientes.</p>
          ) : (
            <div className="space-y-3">
              {ultimosMovimientos.map((mov: UltimoMovimiento, idx: number) => (
                <div key={`${mov.inmueble}-${idx}`} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{mov.inmueble}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{mov.metodo} • {mov.hora}</p>
                  </div>
                  <p className={`text-sm font-bold ${mov.estado === 'Validado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    <CheckCircle className="inline w-4 h-4 mr-1" />
                    ${formatMoney(mov.monto)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default DashboardHome;
