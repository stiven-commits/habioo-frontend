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

const ultimosMovimientos: UltimoMovimiento[] = [
  { inmueble: 'Apto 4B', metodo: 'Pago Móvil', monto: 50, hora: '09:14 a. m.' },
  { inmueble: 'Casa 12', metodo: 'Transferencia', monto: 85, hora: '10:02 a. m.' },
  { inmueble: 'Apto 2A', metodo: 'Zelle', monto: 120, hora: '11:37 a. m.' },
];

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

  useEffect(() => {
    if (userRole !== 'Administrador') return;
    const token = localStorage.getItem('habioo_token');
    if (!token) return;

    const fetchDashboardData = async (): Promise<void> => {
      setLoadingKpis(true);
      try {
        const [resResumen, resGraficos] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/admin-resumen`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/admin-graficos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const resumenPayload: AdminResumenApiResponse = await resResumen.json();
        const graficosPayload: AdminGraficosApiResponse = await resGraficos.json();

        if (resResumen.ok && resumenPayload.status === 'success' && resumenPayload.data) {
          setKpis({
            liquidez: Number(resumenPayload.data.liquidez || 0),
            porCobrar: Number(resumenPayload.data.por_cobrar || 0),
            cuentasPorPagar: Number(resumenPayload.data.cuentas_por_pagar || 0),
            egresosMes: Number(resumenPayload.data.egresos_mes || 0),
          });
        }

        if (resGraficos.ok && graficosPayload.status === 'success') {
          setGraficos({
            dataBalance: Array.isArray(graficosPayload.dataBalance) ? graficosPayload.dataBalance : [],
            dataGastos: Array.isArray(graficosPayload.dataGastos) ? graficosPayload.dataGastos : [],
          });
        }
      } catch (error) {
        console.error('Error cargando KPIs/graficos admin:', error);
      } finally {
        setLoadingKpis(false);
      }
    };

    fetchDashboardData();
  }, [userRole]);

  if (userRole !== 'Administrador') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <p className="text-gray-700 dark:text-gray-200">
          Esta vista de centro de mando está disponible para la Junta de Condominio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Centro de Mando</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bienvenido, {user?.nombre || 'Administrador'}. Resumen financiero y operativo del condominio.
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
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">+5,2% este mes</p>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Por Cobrar (Morosidad)</p>
            <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.porCobrar)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">-2,1% vs mes anterior</p>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Egresos (Mes)</p>
            <span className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {loadingKpis ? '...' : `$${formatMoney(kpis.egresosMes)}`}
          </p>
          <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400">+3,8% este mes</p>
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
          <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">5 facturas pendientes</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <article className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ingresos vs Egresos (Últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={graficos.dataBalance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="mes" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                formatter={(value: number) => `$${formatMoney(value)}`}
              />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#16A34A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#F97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Distribución de Gastos</h3>
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
                  <Cell key={`gasto-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${formatMoney(value)}`} />
            </PieChart>
          </ResponsiveContainer>

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
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Alertas y Pendientes</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">3 facturas por aprobar antes de las 5:00 p. m.</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">Avisos de cobro de marzo emitidos al 80%.</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <FileText className="w-4 h-4 text-rose-500 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-200">Encuesta de pintura de fachada finaliza mañana.</span>
            </li>
          </ul>
        </article>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Últimos Movimientos</h3>
          <div className="space-y-3">
            {ultimosMovimientos.map((mov: UltimoMovimiento, idx: number) => (
              <div key={`${mov.inmueble}-${idx}`} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{mov.inmueble}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{mov.metodo} • {mov.hora}</p>
                </div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="inline w-4 h-4 mr-1" />
                  ${formatMoney(mov.monto)}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default DashboardHome;

