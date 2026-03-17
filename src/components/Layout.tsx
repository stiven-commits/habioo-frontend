import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

interface LayoutProps {}

interface User {
  nombre: string;
  cedula?: string;
  [key: string]: unknown;
}

interface MeResponse {
  user?: User;
}

interface MisPropiedad {
  id_propiedad: number;
  identificador: string;
  nombre_condominio: string;
  id_condominio: number;
  saldo_actual: string | number;
}

interface MisPropiedadesResponse {
  status: 'success' | 'error';
  data?: MisPropiedad[];
  message?: string;
}

interface NotificacionPropietario {
  id: number;
  estado: string;
  nota?: string | null;
  referencia?: string | null;
  identificador?: string;
}

interface NotificacionesPropietarioResponse {
  status: 'success' | 'error';
  data?: NotificacionPropietario[];
  message?: string;
}

interface PagoPendienteAdmin {
  id: number;
  propiedad_id: number;
  identificador?: string;
}

interface PagosPendientesAdminResponse {
  status: 'success' | 'error';
  pagos?: PagoPendienteAdmin[];
  message?: string;
}

interface FloatingNotification {
  key: string;
  title: string;
  message: string;
  tone: 'success' | 'danger' | 'info';
}

type UserRole = 'Administrador' | 'Propietario';
type Theme = 'light' | 'dark';

const parseStoredUser = (rawUser: string): User | null => {
  try {
    const parsed: unknown = JSON.parse(rawUser);
    if (typeof parsed === 'object' && parsed !== null && 'nombre' in parsed) {
      const candidate = parsed as Partial<User>;
      if (typeof candidate.nombre === 'string') return candidate as User;
    }
    return null;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number => Number.parseInt(String(value ?? 0), 10) || 0;

const Layout: React.FC<LayoutProps> = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.theme === 'dark' ? 'dark' : 'light'));
  const [misPropiedades, setMisPropiedades] = useState<MisPropiedad[]>([]);
  const [propiedadActiva, setPropiedadActiva] = useState<MisPropiedad | null>(null);
  const [floatingNotifications, setFloatingNotifications] = useState<FloatingNotification[]>([]);
  const seenNotificacionesRef = useRef<Record<number, string>>({});
  const notificacionesBootstrappedRef = useRef<boolean>(false);
  const seenPagosPendientesAdminRef = useRef<Set<number>>(new Set<number>());
  const pagosPendientesAdminBootstrappedRef = useRef<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pushFloating = (item: FloatingNotification): void => {
    setFloatingNotifications((prev: FloatingNotification[]) => [item, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setFloatingNotifications((prev: FloatingNotification[]) => prev.filter((n: FloatingNotification) => n.key !== item.key));
    }, 9000);
  };

  useEffect(() => {
    const validateSession = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      const userData = localStorage.getItem('habioo_user');
      if (!token || !userData) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          localStorage.removeItem('habioo_token');
          localStorage.removeItem('habioo_user');
          navigate('/');
          return;
        }

        const data: MeResponse = (await res.json()) as MeResponse;
        const currentUser = data.user ?? parseStoredUser(userData);
        if (!currentUser) {
          localStorage.removeItem('habioo_token');
          localStorage.removeItem('habioo_user');
          navigate('/');
          return;
        }

        setUser(currentUser);
        const isAdmin = ['J', 'G'].includes(String(currentUser.cedula || '').charAt(0).toUpperCase());
        setUserRole(isAdmin ? 'Administrador' : 'Propietario');
      } catch {
        localStorage.removeItem('habioo_token');
        localStorage.removeItem('habioo_user');
        navigate('/');
      }
    };

    void validateSession();
  }, [navigate]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.theme = theme;
  }, [theme]);

  useEffect(() => {
    const fetchMisPropiedades = async (): Promise<void> => {
      if (userRole !== 'Propietario') return;

      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/propietario/mis-propiedades`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: MisPropiedadesResponse = (await res.json()) as MisPropiedadesResponse;
        if (!res.ok || data.status !== 'success') return;

        const props = Array.isArray(data.data) ? data.data : [];
        setMisPropiedades(props);
        if (props.length === 0) {
          setPropiedadActiva(null);
          return;
        }

        const storedPropiedadId = toNumber(localStorage.getItem('habioo_propiedad_activa_id'));
        const preselected = props.find((p) => p.id_propiedad === storedPropiedadId) ?? props[0];
        if (!preselected) {
          setPropiedadActiva(null);
          return;
        }
        setPropiedadActiva(preselected);
        localStorage.setItem('habioo_propiedad_activa_id', String(preselected.id_propiedad));
        localStorage.setItem('habioo_condominio_activo_id', String(preselected.id_condominio));
      } catch {
        setMisPropiedades([]);
        setPropiedadActiva(null);
      }
    };

    void fetchMisPropiedades();
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'Propietario') return;

    let isActive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollNotificaciones = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      const queryPropiedad = propiedadActiva?.id_propiedad ? `?propiedad_id=${propiedadActiva.id_propiedad}` : '';
      try {
        const res = await fetch(`${API_BASE_URL}/api/propietario/notificaciones${queryPropiedad}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: NotificacionesPropietarioResponse = (await res.json()) as NotificacionesPropietarioResponse;
        if (!isActive || !res.ok || data.status !== 'success') return;

        const rows = Array.isArray(data.data) ? data.data : [];
        const currentMap: Record<number, string> = {};

        rows.forEach((n: NotificacionPropietario) => {
          currentMap[n.id] = `${n.estado}|${String(n.nota || '')}`;
        });

        if (!notificacionesBootstrappedRef.current) {
          seenNotificacionesRef.current = currentMap;
          notificacionesBootstrappedRef.current = true;
          return;
        }

        rows.forEach((n: NotificacionPropietario) => {
          const prevSignature = seenNotificacionesRef.current[n.id];
          const currentSignature = currentMap[n.id];
          if (prevSignature === currentSignature) return;

          const baseTitle = n.identificador ? `Inmueble ${n.identificador}` : 'Notificación de pago';
          if (n.estado === 'Validado') {
            pushFloating({
              key: `ok-${n.id}-${Date.now()}`,
              title: baseTitle,
              message: `Pago #${n.id} aprobado.`,
              tone: 'success',
            });
            return;
          }
          if (n.estado === 'Rechazado') {
            pushFloating({
              key: `reject-${n.id}-${Date.now()}`,
              title: baseTitle,
              message: n.nota ? `Pago #${n.id} rechazado: ${n.nota}` : `Pago #${n.id} rechazado.`,
              tone: 'danger',
            });
            return;
          }
          if (n.estado === 'PendienteAprobacion' && !prevSignature) {
            pushFloating({
              key: `pending-${n.id}-${Date.now()}`,
              title: baseTitle,
              message: `Pago #${n.id} en aprobación.`,
              tone: 'info',
            });
          }
        });

        seenNotificacionesRef.current = currentMap;
      } catch {
        // Sin bloqueo en UI por errores transitorios.
      }
    };

    void pollNotificaciones();
    timer = setInterval(() => {
      void pollNotificaciones();
    }, 15000);

    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
    };
  }, [userRole, propiedadActiva?.id_propiedad]);

  useEffect(() => {
    if (userRole !== 'Administrador') return;

    let isActive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollPagosPendientes = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/pagos/pendientes-aprobacion`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: PagosPendientesAdminResponse = (await res.json()) as PagosPendientesAdminResponse;
        if (!isActive || !res.ok || data.status !== 'success') return;

        const rows = Array.isArray(data.pagos) ? data.pagos : [];
        const currentIds = new Set<number>(rows.map((p) => p.id));

        if (!pagosPendientesAdminBootstrappedRef.current) {
          seenPagosPendientesAdminRef.current = currentIds;
          pagosPendientesAdminBootstrappedRef.current = true;
          return;
        }

        rows.forEach((p: PagoPendienteAdmin) => {
          if (seenPagosPendientesAdminRef.current.has(p.id)) return;
          pushFloating({
            key: `admin-pending-${p.id}-${Date.now()}`,
            title: p.identificador ? `Inmueble ${p.identificador}` : 'Nuevo pago reportado',
            message: `Pago #${p.id} enviado por propietario. Pendiente de aprobación.`,
            tone: 'info',
          });
        });

        seenPagosPendientesAdminRef.current = currentIds;
      } catch {
        // Sin bloqueo en UI por errores transitorios.
      }
    };

    void pollPagosPendientes();
    timer = setInterval(() => {
      void pollPagosPendientes();
    }, 15000);

    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
    };
  }, [userRole]);

  const toggleTheme: React.MouseEventHandler<HTMLButtonElement> = () => {
    setTheme((previousTheme: Theme) => (previousTheme === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout: React.MouseEventHandler<HTMLButtonElement> = () => {
    localStorage.clear();
    navigate('/');
  };

  const handlePropiedadChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const nextId = toNumber(e.target.value);
    const nextPropiedad = misPropiedades.find((p) => p.id_propiedad === nextId);
    if (!nextPropiedad) return;
    setPropiedadActiva(nextPropiedad);
    localStorage.setItem('habioo_propiedad_activa_id', String(nextPropiedad.id_propiedad));
    localStorage.setItem('habioo_condominio_activo_id', String(nextPropiedad.id_condominio));
    navigate(0);
  };

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Panel Principal',
    '/proveedores': 'Directorio de Proveedores',
    '/gastos': 'Gastos Comunes',
    '/cierres': 'Cierres y Recibos',
    '/inmuebles': 'Directorio de Inmuebles',
    '/cuentas-cobrar': 'Cuentas por Cobrar',
    '/bancos': 'Cuentas Bancarias',
    '/zonas': 'Areas / Sectores',
    '/avisos-cobro': 'Avisos de cobro',
    '/estado-cuentas': 'Estado de Cuenta',
    '/perfil': 'Mi Perfil',
    '/propietario/gastos': 'Cartelera de Gastos',
    '/propietario/recibos': 'Mis Recibos / Pagar',
    '/propietario/estado-cuenta': 'Tesorería',
    '/propietario/notificaciones': 'Notificaciones',
    '/propietario/perfil': 'Mi Perfil',
  };

  const navClass = (path: string): string =>
    `block py-3 px-4 rounded-xl transition-all duration-200 font-medium ${
      location.pathname === path
        ? 'bg-donezo-primary text-white shadow-lg shadow-green-500/30'
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`;

  const propiedadResumen = useMemo(() => {
    if (!propiedadActiva) return 'Sin inmueble activo';
    return `${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}`;
  }, [propiedadActiva]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f111a] transition-colors duration-300 flex">
      <aside className="w-64 bg-white dark:bg-[#161b22] border-r border-gray-100 dark:border-gray-800 hidden md:flex flex-col fixed h-full z-20">
        <div className="p-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-donezo-primary to-green-400 bg-clip-text text-transparent">Habioo</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <Link to="/dashboard" className={navClass('/dashboard')}>
            📊 Dashboard
          </Link>

          {userRole === 'Administrador' && (
            <>
              <Link to="/perfil" className={navClass('/perfil')}>
                ⚙️ Perfil Condominio
              </Link>
              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Configuración</p>
              <Link to="/bancos" className={navClass('/bancos')}>
                💳 Cuentas Bancarias
              </Link>
              <Link to="/zonas" className={navClass('/zonas')}>
                🏢 Areas / Sectores
              </Link>
              <Link to="/inmuebles" className={navClass('/inmuebles')}>
                🏠 Inmuebles
              </Link>
              <Link to="/proveedores" className={navClass('/proveedores')}>
                🤝 Proveedores
              </Link>
              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Contabilidad</p>
              <Link to="/gastos" className={navClass('/gastos')}>
                🧾 Gastos
              </Link>
              <Link to="/cierres" className={navClass('/cierres')}>
                🔒 Cierres Preliminares
              </Link>
              <Link to="/avisos-cobro" className={navClass('/avisos-cobro')}>
                🗂️ Avisos de cobro
              </Link>
              <Link to="/cuentas-cobrar" className={navClass('/cuentas-cobrar')}>
                💰 Cobranza
              </Link>
              <Link to="/estado-cuentas" className={navClass('/estado-cuentas')}>
                📊 Libro Mayor
              </Link>
            </>
          )}

          {userRole === 'Propietario' && (
            <>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Cambiando a:</p>
                <select
                  value={propiedadActiva?.id_propiedad ?? ''}
                  onChange={handlePropiedadChange}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {misPropiedades.map((item) => (
                    <option key={item.id_propiedad} value={item.id_propiedad}>
                      {item.identificador} | {item.nombre_condominio}
                    </option>
                  ))}
                </select>
              </div>

              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Contabilidad</p>
              <Link to="/propietario/gastos" className={navClass('/propietario/gastos')}>
                🏢 Cartelera de Gastos
              </Link>
              <Link to="/propietario/recibos" className={navClass('/propietario/recibos')}>
                💳 Mis Recibos / Pagar
              </Link>
              <Link to="/propietario/estado-cuenta" className={navClass('/propietario/estado-cuenta')}>
                📊 Tesorería
              </Link>
              <Link to="/propietario/notificaciones" className={navClass('/propietario/notificaciones')}>
                🔔 Notificaciones
              </Link>

              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Configuración</p>
              <Link to="/propietario/perfil" className={navClass('/propietario/perfil')}>
                ⚙️ Mi Perfil
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 w-full p-2 rounded-lg dark:text-gray-400">
            <span>🚪</span> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{pageTitles[location.pathname] || 'Bienvenido'}</h2>
            <p className="text-gray-500 text-sm dark:text-gray-400">
              Hola, {user.nombre}
              {userRole === 'Propietario' && propiedadActiva ? ` · ${propiedadResumen}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl bg-white dark:bg-[#161b22] border border-gray-100 dark:border-gray-800 shadow-sm text-xl transition-transform active:scale-90"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="w-10 h-10 rounded-full bg-donezo-primary flex items-center justify-center text-white font-bold">{user.nombre.charAt(0)}</div>
          </div>
        </header>

        <Outlet context={{ user, userRole, misPropiedades, propiedadActiva }} />
      </main>

      {floatingNotifications.length > 0 && (
        <div className="fixed right-4 top-24 z-[80] w-[340px] max-w-[92vw] space-y-2">
          {floatingNotifications.map((n: FloatingNotification) => (
            <article
              key={n.key}
              className={`rounded-xl border p-3 shadow-lg backdrop-blur-sm ${
                n.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50/95 dark:border-emerald-800/50 dark:bg-emerald-900/30'
                  : n.tone === 'danger'
                    ? 'border-red-200 bg-red-50/95 dark:border-red-800/50 dark:bg-red-900/30'
                    : 'border-sky-200 bg-sky-50/95 dark:border-sky-800/50 dark:bg-sky-900/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-gray-800 dark:text-gray-100">{n.title}</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{n.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFloatingNotifications((prev: FloatingNotification[]) => prev.filter((x: FloatingNotification) => x.key !== n.key))}
                  className="text-xs font-black text-gray-500 hover:text-red-500"
                  title="Cerrar"
                >
                  X
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Layout;
