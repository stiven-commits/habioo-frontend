import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useMatch } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import AIChatWidget from './AIChatWidget';
import ModalBase from './ui/ModalBase';
import habiooIsoHabioBlanco from '../assets/brand/habioo_iso_habio_blanco.svg';
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  UserCircle2,
  WalletCards,
} from 'lucide-react';

interface LayoutProps {}

interface User {
  nombre: string;
  cedula?: string;
  [key: string]: unknown;
}

interface MeResponse {
  user?: User;
  session?: SessionData;
}

interface SessionData {
  role?: 'Administrador' | 'Propietario' | 'SuperUsuario';
  is_support_session?: boolean;
  support_superuser_id?: number | null;
  support_superuser_nombre?: string | null;
  support_condominio_id?: number | null;
  expires_at?: string | null;
  [key: string]: unknown;
}

interface PerfilCondominioHeaderData {
  admin_nombre?: string | null;
  admin_representante?: string | null;
  nombre_legal?: string | null;
  nombre?: string | null;
  tipo?: string | null;
}

interface PerfilCondominioHeaderResponse {
  status?: 'success' | 'error';
  data?: PerfilCondominioHeaderData;
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

interface ReservacionAdmin {
  id: number;
  estado: string;
  propiedad_identificador?: string;
  amenidad_nombre?: string;
}

interface ReservacionesAdminResponse {
  status: 'success' | 'error';
  data?: ReservacionAdmin[];
  message?: string;
}

interface JuntaGeneralNotificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at?: string;
}

interface JuntaGeneralNotificacionesResponse {
  status: 'success' | 'error';
  data?: JuntaGeneralNotificacion[];
  message?: string;
}

interface FloatingNotification {
  key: string;
  title: string;
  message: string;
  tone: 'success' | 'danger' | 'info';
}

interface SessionEndedEventDetail {
  reason?: string;
  status?: number;
  url?: string;
}

type UserRole = 'Administrador' | 'Propietario' | 'SuperUsuario';
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

const parseStoredSession = (rawSession: string): SessionData | null => {
  try {
    const parsed: unknown = JSON.parse(rawSession);
    if (typeof parsed === 'object' && parsed !== null) return parsed as SessionData;
    return null;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number => Number.parseInt(String(value ?? 0), 10) || 0;

const Layout: React.FC<LayoutProps> = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [headerDisplayName, setHeaderDisplayName] = useState<string>('');
  const [condominioTipo, setCondominioTipo] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.theme === 'dark' ? 'dark' : 'light'));
  const [systemNow, setSystemNow] = useState<Date>(() => new Date());
  const [misPropiedades, setMisPropiedades] = useState<MisPropiedad[]>([]);
  const [propiedadActiva, setPropiedadActiva] = useState<MisPropiedad | null>(null);
  const [floatingNotifications, setFloatingNotifications] = useState<FloatingNotification[]>([]);
  const [sessionEndedModalOpen, setSessionEndedModalOpen] = useState<boolean>(false);
  const [sessionEndedMessage, setSessionEndedMessage] = useState<string>('Tu sesion se cerro. Inicia sesion nuevamente para continuar.');
  const seenNotificacionesRef = useRef<Record<number, string>>({});
  const notificacionesBootstrappedRef = useRef<boolean>(false);
  const seenPagosPendientesAdminRef = useRef<Set<number>>(new Set<number>());
  const pagosPendientesAdminBootstrappedRef = useRef<boolean>(false);
  const seenReservacionesAdminRef = useRef<Record<number, string>>({});
  const reservacionesAdminBootstrappedRef = useRef<boolean>(false);
  const seenJuntaGeneralNotifsRef = useRef<Record<number, string>>({});
  const juntaGeneralNotifsBootstrappedRef = useRef<boolean>(false);
  const buttonClickLockRef = useRef<WeakMap<HTMLButtonElement, number>>(new WeakMap<HTMLButtonElement, number>());
  const formSubmitLockRef = useRef<WeakMap<HTMLFormElement, number>>(new WeakMap<HTMLFormElement, number>());
  const location = useLocation();
  const navigate = useNavigate();
  // Detecta si estamos dentro de una sesión de soporte con condominioId en la URL
  const soporteMatch = useMatch('/soporte/:condominioId/*');
  const soporteCondominioId = soporteMatch?.params?.condominioId ?? null;
  // Helper: genera la URL correcta según si estamos en modo soporte con ID en URL o no
  const navTo = (path: string): string =>
    soporteCondominioId ? `/soporte/${soporteCondominioId}${path}` : path;

  const pushFloating = (item: FloatingNotification): void => {
    setFloatingNotifications((prev: FloatingNotification[]) => [item, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setFloatingNotifications((prev: FloatingNotification[]) => prev.filter((n: FloatingNotification) => n.key !== item.key));
    }, 9000);
  };

  const clearAuthStorage = (): void => {
    localStorage.removeItem('habioo_token');
    localStorage.removeItem('habioo_user');
    localStorage.removeItem('habioo_session');
    localStorage.removeItem('habioo_propiedad_activa_id');
    localStorage.removeItem('habioo_condominio_activo_id');
  };

  const openSessionEndedModal = (message?: string): void => {
    setSessionEndedMessage(message || 'Tu sesion se cerro. Inicia sesion nuevamente para continuar.');
    setSessionEndedModalOpen(true);
  };

  useEffect(() => {
    const validateSession = async (): Promise<void> => {
      const readBackup = (): { token: string | null; user: string | null; session: string | null } => {
        const token = localStorage.getItem('habioo_super_token_backup') || sessionStorage.getItem('habioo_super_token_backup');
        const user = localStorage.getItem('habioo_super_user_backup') || sessionStorage.getItem('habioo_super_user_backup');
        const session = localStorage.getItem('habioo_super_session_backup') || sessionStorage.getItem('habioo_super_session_backup');
        return { token, user, session };
      };

      const tryRestoreSuperBackup = (): boolean => {
        const { token: backupToken, user: backupUser, session: backupSession } = readBackup();
        if (!backupToken || !backupUser) return false;
        localStorage.setItem('habioo_token', backupToken);
        localStorage.setItem('habioo_user', backupUser);
        localStorage.setItem('habioo_session', backupSession || '{}');
        localStorage.removeItem('habioo_super_token_backup');
        localStorage.removeItem('habioo_super_user_backup');
        localStorage.removeItem('habioo_super_session_backup');
        sessionStorage.removeItem('habioo_super_token_backup');
        sessionStorage.removeItem('habioo_super_user_backup');
        sessionStorage.removeItem('habioo_super_session_backup');
        navigate('/soporte/condominios');
        return true;
      };

      const token = localStorage.getItem('habioo_token');
      const userData = localStorage.getItem('habioo_user');
      const storedSessionRaw = localStorage.getItem('habioo_session');
      if (!token || !userData) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 401) {
            if (tryRestoreSuperBackup()) return;
            openSessionEndedModal('Tu sesion expiro o fue cerrada. Debes iniciar sesion de nuevo para seguir operando.');
          }
          return;
        }

        const data: MeResponse = (await res.json()) as MeResponse;
        const currentUser = data.user ?? parseStoredUser(userData);
        const currentSession = (data.session || (storedSessionRaw ? parseStoredSession(storedSessionRaw) : null)) as SessionData | null;
        if (!currentUser) {
          openSessionEndedModal('Tu sesion expiro o fue cerrada. Debes iniciar sesion de nuevo para seguir operando.');
          return;
        }

        setUser(currentUser);
        const role = String(currentSession?.role || '').trim();
        const normalizedRole: UserRole = role === 'SuperUsuario'
          ? 'SuperUsuario'
          : role === 'Administrador'
            ? 'Administrador'
            : 'Propietario';
        setSessionData(currentSession);
        setUserRole(normalizedRole);
        localStorage.setItem('habioo_session', JSON.stringify(currentSession || {}));
      } catch {
        // Error de red o servidor no disponible — no cerrar sesión
        return;
      }
    };

    void validateSession();
  }, [navigate]);

  useEffect(() => {
    const onSessionEnded = (event: Event): void => {
      const custom = event as CustomEvent<SessionEndedEventDetail>;
      const reason = String(custom.detail?.reason || '');
      if (reason === 'unauthorized') {
        openSessionEndedModal('Tu sesion expiro o fue cerrada por seguridad. Debes iniciar sesion nuevamente para continuar.');
        return;
      }
      openSessionEndedModal();
    };

    window.addEventListener('habioo:session-ended', onSessionEnded as EventListener);
    return () => {
      window.removeEventListener('habioo:session-ended', onSessionEnded as EventListener);
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.theme = theme;
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSystemNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
    const loadHeaderDisplayName = async (): Promise<void> => {
      if (!user) return;
      if (userRole !== 'Administrador') {
        setHeaderDisplayName(String(user.nombre || '').trim());
        setCondominioTipo('');
        return;
      }

      const token = localStorage.getItem('habioo_token');
      if (!token) {
        setHeaderDisplayName(String(user.nombre || '').trim());
        setCondominioTipo('');
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/perfil`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: PerfilCondominioHeaderResponse = await res.json();
        const profile = data?.data || {};
        setCondominioTipo(String(profile.tipo || '').trim());
        const adminNombre = String(profile.admin_nombre || '').trim();
        const adminRepresentante = String(profile.admin_representante || '').trim();
        const nombreJunta = String(profile.nombre_legal || profile.nombre || '').trim();
        const fallbackUser = String(user.nombre || '').trim();
        const nombreAdmin = adminNombre || adminRepresentante || fallbackUser;
        const nombreCompuesto = nombreAdmin && nombreJunta ? `${nombreAdmin} / ${nombreJunta}` : (nombreAdmin || nombreJunta);
        setHeaderDisplayName(nombreCompuesto || 'Usuario');
      } catch {
        setHeaderDisplayName(String(user.nombre || '').trim() || 'Usuario');
        setCondominioTipo('');
      }
    };

    void loadHeaderDisplayName();
  }, [userRole, user]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

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
    const tipoCondominio = String(condominioTipo || '').trim().toLowerCase();
    if (!tipoCondominio) return;
    if (tipoCondominio === 'junta general') return;

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
  }, [userRole, condominioTipo]);

  useEffect(() => {
    if (userRole !== 'Administrador') return;
    const tipoCondominio = String(condominioTipo || '').trim().toLowerCase();
    if (!tipoCondominio) return;

    let isActive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollJuntaGeneralNotificaciones = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/juntas-generales/notificaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: JuntaGeneralNotificacionesResponse = (await res.json()) as JuntaGeneralNotificacionesResponse;
        if (!isActive || !res.ok || data.status !== 'success') return;

        const rows = Array.isArray(data.data) ? data.data : [];
        const currentMap: Record<number, string> = {};
        rows.forEach((n) => {
          currentMap[n.id] = `${n.leida ? '1' : '0'}|${n.tipo}|${n.titulo}|${n.mensaje}`;
        });

        if (!juntaGeneralNotifsBootstrappedRef.current) {
          seenJuntaGeneralNotifsRef.current = currentMap;
          juntaGeneralNotifsBootstrappedRef.current = true;
          return;
        }

        rows.forEach((n) => {
          const prevSignature = seenJuntaGeneralNotifsRef.current[n.id];
          const currentSignature = currentMap[n.id];
          if (prevSignature === currentSignature) return;
          if (n.leida) return;

          pushFloating({
            key: `jg-notif-${n.id}-${Date.now()}`,
            title: n.titulo || (tipoCondominio === 'junta general' ? 'Notificación Junta General' : 'Notificación interna'),
            message: n.mensaje || (tipoCondominio === 'junta general'
              ? 'Tienes una nueva notificación de junta general.'
              : 'Tienes una nueva notificación interna de tu vinculación con Junta General.'),
            tone: 'info',
          });
        });

        seenJuntaGeneralNotifsRef.current = currentMap;
      } catch {
        // Sin bloqueo en UI por errores transitorios.
      }
    };

    void pollJuntaGeneralNotificaciones();
    timer = setInterval(() => {
      void pollJuntaGeneralNotificaciones();
    }, 15000);

    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
    };
  }, [userRole, condominioTipo]);

  useEffect(() => {
    if (userRole !== 'Administrador') return;
    if (String(condominioTipo || '').trim().toLowerCase() !== 'junta general') return;
    const blockedForGeneral = new Set<string>(['/dashboard', '/inmuebles']);
    if (blockedForGeneral.has(location.pathname)) {
      navigate('/junta-general', { replace: true });
    }
  }, [userRole, condominioTipo, location.pathname, navigate]);

  useEffect(() => {
    if (userRole !== 'Administrador') return;
    const tipoCondominio = String(condominioTipo || '').trim().toLowerCase();
    if (!tipoCondominio) return;
    if (tipoCondominio === 'junta general') return;

    let isActive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollReservacionesPendientes = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/alquileres/reservaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: ReservacionesAdminResponse = (await res.json()) as ReservacionesAdminResponse;
        if (!isActive || !res.ok || data.status !== 'success') return;

        const rows = (Array.isArray(data.data) ? data.data : []).filter((r) =>
          r.estado === 'Pendiente' || r.estado === 'Pago_Reportado'
        );
        const currentMap: Record<number, string> = {};
        rows.forEach((r) => {
          currentMap[r.id] = `${r.estado}`;
        });

        if (!reservacionesAdminBootstrappedRef.current) {
          seenReservacionesAdminRef.current = currentMap;
          reservacionesAdminBootstrappedRef.current = true;
          return;
        }

        rows.forEach((r) => {
          const prevSignature = seenReservacionesAdminRef.current[r.id];
          const currentSignature = currentMap[r.id];
          if (prevSignature === currentSignature) return;

          const title = r.propiedad_identificador
            ? `Inmueble ${r.propiedad_identificador}`
            : 'Nueva solicitud de alquiler';
          if (r.estado === 'Pendiente' && !prevSignature) {
            pushFloating({
              key: `res-pend-${r.id}-${Date.now()}`,
              title,
              message: r.amenidad_nombre
                ? `Nueva solicitud para ${r.amenidad_nombre}.`
                : `Nueva solicitud de reservación #${r.id}.`,
              tone: 'info',
            });
            return;
          }
          if (r.estado === 'Pago_Reportado') {
            pushFloating({
              key: `res-pay-${r.id}-${Date.now()}`,
              title,
              message: r.amenidad_nombre
                ? `Pago reportado para ${r.amenidad_nombre}.`
                : `Pago reportado para reservación #${r.id}.`,
              tone: 'info',
            });
          }
        });

        seenReservacionesAdminRef.current = currentMap;
      } catch {
        // Sin bloqueo en UI por errores transitorios.
      }
    };

    void pollReservacionesPendientes();
    timer = setInterval(() => {
      void pollReservacionesPendientes();
    }, 15000);

    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
    };
  }, [userRole, condominioTipo]);

  const toggleTheme: React.MouseEventHandler<HTMLButtonElement> = () => {
    setTheme((previousTheme: Theme) => (previousTheme === 'dark' ? 'light' : 'dark'));
  };

  const handleSidebarToggle: React.MouseEventHandler<HTMLButtonElement> = () => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile) {
      setSidebarCollapsed(false);
      setMobileSidebarOpen((prev) => !prev);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  const handleLogout = (): void => {
    openSessionEndedModal('Sesion cerrada correctamente.');
  };

  const handleSessionEndedAcknowledge = (): void => {
    clearAuthStorage();
    setSessionEndedModalOpen(false);
    navigate('/');
  };

  const isSupportSession = Boolean(sessionData?.is_support_session);

  const handleExitSupport = async (): Promise<void> => {
    const readBackup = (): { token: string | null; user: string | null; session: string | null } => {
      const token = localStorage.getItem('habioo_super_token_backup') || sessionStorage.getItem('habioo_super_token_backup');
      const user = localStorage.getItem('habioo_super_user_backup') || sessionStorage.getItem('habioo_super_user_backup');
      const session = localStorage.getItem('habioo_super_session_backup') || sessionStorage.getItem('habioo_super_session_backup');
      return { token, user, session };
    };

    try {
      const supportToken = localStorage.getItem('habioo_token');
      if (supportToken && isSupportSession) {
        await fetch(`${API_BASE_URL}/support/salir`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${supportToken}` },
        });
      }
    } catch {
      // cierre best-effort
    }

    const { token: backupToken, user: backupUser, session: backupSession } = readBackup();
    if (!backupToken || !backupUser) {
      navigate('/soporte/condominios');
      return;
    }

    localStorage.setItem('habioo_token', backupToken);
    localStorage.setItem('habioo_user', backupUser);
    localStorage.setItem('habioo_session', backupSession || '{}');
    localStorage.removeItem('habioo_super_token_backup');
    localStorage.removeItem('habioo_super_user_backup');
    localStorage.removeItem('habioo_super_session_backup');
    sessionStorage.removeItem('habioo_super_token_backup');
    sessionStorage.removeItem('habioo_super_user_backup');
    sessionStorage.removeItem('habioo_super_session_backup');
    window.location.assign('/soporte/condominios');
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
    '/alquileres': 'Gestión de Alquileres',
    '/perfil': 'Mi Perfil',
    '/propietario/gastos': 'Cartelera de Gastos',
    '/propietario/recibos': 'Mis Recibos / Pagar',
    '/propietario/estado-cuenta': 'Tesorería',
    '/propietario/estado-cuenta-inmueble': 'Estado de Cuenta Inmueble',
    '/propietario/alquileres': 'Alquiler de Espacios',
    '/propietario/notificaciones': 'Notificaciones',
    '/propietario/perfil': 'Mi Perfil',
    '/carta-consulta': 'Cartas Consulta',
    '/mis-cartas-consulta': 'Cartas Consulta',
    '/soporte/condominios': 'Soporte Habioo',
    '/junta-general': 'Junta General',
  };

  // En rutas de soporte /soporte/:id/seccion, resolvemos el título por la sección final
  const resolvedPageTitle = (() => {
    if (soporteCondominioId) {
      const sectionPath = location.pathname.replace(`/soporte/${soporteCondominioId}`, '');
      return pageTitles[sectionPath] ?? pageTitles[location.pathname] ?? 'Bienvenido';
    }
    return pageTitles[location.pathname] ?? 'Bienvenido';
  })();

  const hideOuterPageHeader = (() => {
    const effectivePath = soporteCondominioId
      ? location.pathname.replace(`/soporte/${soporteCondominioId}`, '')
      : location.pathname;
    return effectivePath === '/estado-cuentas'
      || effectivePath === '/cuentas-cobrar'
      || effectivePath === '/gastos'
      || effectivePath === '/proveedores';
  })();

  const navClass = (path: string): string => {
    const fullPath = navTo(path);
    const isActive = location.pathname === fullPath
      || (path === '/soporte/condominios' && location.pathname === '/soporte/condominios');
    return `group flex items-center rounded-xl transition-all duration-200 font-semibold ${
      sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
    } ${
      isActive
        ? 'bg-[#0b472a] text-white shadow-[inset_0_0_0_1px_rgba(110,231,183,0.15)]'
        : 'text-emerald-50/90 hover:bg-[#0c5331] hover:text-white'
    }`;
  };

  const sectionTitleClass = `px-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200/55 ${
    sidebarCollapsed ? 'hidden' : ''
  }`;

  const propiedadResumen = useMemo(() => {
    if (!propiedadActiva) return 'Sin inmueble activo';
    return `${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}`;
  }, [propiedadActiva]);

  const systemDateTimeLabel = useMemo(() => {
    return systemNow.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [systemNow]);

  const isSensitiveActionLabel = (label: string): boolean =>
    /\b(guardar|agregar|registrar|aplicar|procesar|confirmar)\b/i.test(label);

  const resolveButtonLabel = (button: HTMLButtonElement): string =>
    String(button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '').trim();

  const handleGlobalButtonClickCapture: React.MouseEventHandler<HTMLDivElement> = (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button') as HTMLButtonElement | null;
    if (!button || button.disabled) return;
    if (button.dataset.noDoubleClick === 'true') return;

    const label = resolveButtonLabel(button);
    if (!isSensitiveActionLabel(label)) return;

    const now = Date.now();
    const lastAt = buttonClickLockRef.current.get(button) || 0;
    if (now - lastAt < 1500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    buttonClickLockRef.current.set(button, now);
  };

  const handleGlobalFormSubmitCapture: React.FormEventHandler<HTMLDivElement> = (event) => {
    const form = event.target as HTMLFormElement;
    if (!form || form.tagName !== 'FORM') return;

    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | HTMLInputElement | null;
    const submitterLabel = String(
      submitter?.textContent || submitter?.getAttribute?.('value') || submitter?.getAttribute?.('aria-label') || '',
    ).trim();
    if (!isSensitiveActionLabel(submitterLabel)) return;

    const now = Date.now();
    const lastAt = formSubmitLockRef.current.get(form) || 0;
    if (now - lastAt < 1500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    formSubmitLockRef.current.set(form, now);
  };

  if (!user) return null;

  const displayName = String(headerDisplayName || user.nombre || 'Usuario').trim() || 'Usuario';
  const esJuntaGeneral = String(condominioTipo || '').trim().toLowerCase() === 'junta general';

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-[#0f111a] transition-colors duration-300 flex"
      onClickCapture={handleGlobalButtonClickCapture}
      onSubmitCapture={handleGlobalFormSubmitCapture}
    >
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/45 md:hidden"
        />
      )}

      <aside
        className={`fixed z-30 h-full flex flex-col border-r border-emerald-900/70 bg-[#0f5e37] transition-all duration-300 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-72 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`px-3 py-4 border-b border-emerald-900/60 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-100">
              <img src={habiooIsoHabioBlanco} alt="Habioo" className="h-5 w-auto object-contain" />
            </div>
            {!sidebarCollapsed && <span className="font-cal-sans text-2xl font-normal tracking-tight text-emerald-50">Habioo</span>}
          </div>
        </div>

        <nav className={`flex-1 px-3 py-4 space-y-1.5 overflow-y-auto ${sidebarCollapsed ? 'items-center' : ''}`}>
          <p className={sectionTitleClass}>Principal</p>
          <Link
            to={userRole === 'SuperUsuario' ? '/soporte/condominios' : navTo(esJuntaGeneral ? '/junta-general' : '/dashboard')}
            className={navClass(userRole === 'SuperUsuario' ? '/soporte/condominios' : (esJuntaGeneral ? '/junta-general' : '/dashboard'))}
            title={userRole === 'SuperUsuario' ? 'Soporte' : (esJuntaGeneral ? 'Junta General' : 'Dashboard')}
          >
            <LayoutDashboard size={18} />
            {!sidebarCollapsed && <span>{userRole === 'SuperUsuario' ? 'Soporte' : (esJuntaGeneral ? 'Junta General' : 'Dashboard')}</span>}
          </Link>

          {userRole === 'SuperUsuario' && (
            <>
              <p className={`mt-6 ${sectionTitleClass}`}>Accesos</p>
              <Link to="/soporte/condominios" className={navClass('/soporte/condominios')} title="Juntas">
                <Building2 size={18} />
                {!sidebarCollapsed && <span>Juntas Habioo</span>}
              </Link>
            </>
          )}

          {userRole === 'Administrador' && (
            <>
              {!esJuntaGeneral && (
                <Link to={navTo('/inmuebles')} className={navClass('/inmuebles')} title="Inmuebles">
                  <Building2 size={18} />
                  {!sidebarCollapsed && <span>Inmuebles</span>}
                </Link>
              )}
              <Link to={navTo('/proveedores')} className={navClass('/proveedores')} title="Proveedores">
                <Handshake size={18} />
                {!sidebarCollapsed && <span>Proveedores</span>}
              </Link>
              <Link to={navTo('/gastos')} className={navClass('/gastos')} title="Gastos">
                <Receipt size={18} />
                {!sidebarCollapsed && <span>Gastos</span>}
              </Link>
              <Link to={navTo('/cierres')} className={navClass('/cierres')} title="Cierres">
                <FileCheck2 size={18} />
                {!sidebarCollapsed && <span>Cierres</span>}
              </Link>

              <p className={`mt-6 ${sectionTitleClass}`}>Finanzas</p>
              <Link to={navTo('/cuentas-cobrar')} className={navClass('/cuentas-cobrar')} title="Cuentas por Cobrar">
                <WalletCards size={18} />
                {!sidebarCollapsed && <span>Cuentas por Cobrar</span>}
              </Link>
              <Link to={navTo('/bancos')} className={navClass('/bancos')} title="Bancos">
                <Landmark size={18} />
                {!sidebarCollapsed && <span>Bancos</span>}
              </Link>
              <Link to={navTo('/estado-cuentas')} className={navClass('/estado-cuentas')} title="Estado de Cuentas">
                <BookOpen size={18} />
                {!sidebarCollapsed && <span>Estado de Cuentas</span>}
              </Link>
              <Link to={navTo('/avisos-cobro')} className={navClass('/avisos-cobro')} title="Avisos de Cobro">
                <Bell size={18} />
                {!sidebarCollapsed && <span>Avisos de Cobro</span>}
              </Link>

              <p className={`mt-6 ${sectionTitleClass}`}>Configuracion</p>
              <Link to={navTo('/zonas')} className={navClass('/zonas')} title="Áreas / Sectores">
                <MapPin size={18} />
                {!sidebarCollapsed && <span>Áreas / Sectores</span>}
              </Link>
              <Link to={navTo('/perfil')} className={navClass('/perfil')} title="Perfil Condominio">
                <Settings size={18} />
                {!sidebarCollapsed && <span>Perfil</span>}
              </Link>
              <Link to={navTo('/alquileres')} className={navClass('/alquileres')} title="Alquileres">
                <CalendarDays size={18} />
                {!sidebarCollapsed && <span>Alquileres</span>}
              </Link>
              <Link to={navTo('/carta-consulta')} className={navClass('/carta-consulta')} title="Cartas Consulta">
                <ClipboardList size={18} />
                {!sidebarCollapsed && <span>Cartas Consulta</span>}
              </Link>
            </>
          )}

          {userRole === 'Propietario' && (
            <>
              {!sidebarCollapsed && (
                <div className="mt-3 rounded-xl border border-emerald-900/70 bg-[#0d4f2f] p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-100/70">Cambiando a:</p>
                  <select
                    value={propiedadActiva?.id_propiedad ?? ''}
                    onChange={handlePropiedadChange}
                    className="mt-2 w-full rounded-lg border border-emerald-900/80 bg-[#0f5e37] px-2 py-2 text-xs font-semibold text-emerald-50 outline-none focus:ring-2 focus:ring-emerald-300/40"
                  >
                    {misPropiedades.map((item) => (
                      <option key={item.id_propiedad} value={item.id_propiedad}>
                        {item.identificador} | {item.nombre_condominio}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className={`mt-6 ${sectionTitleClass}`}>Finanzas</p>
              <Link to="/propietario/gastos" className={navClass('/propietario/gastos')} title="Cartelera de Gastos">
                <Building2 size={18} />
                {!sidebarCollapsed && <span>Cartelera de Gastos</span>}
              </Link>
              <Link to="/propietario/recibos" className={navClass('/propietario/recibos')} title="Mis Recibos">
                <CreditCard size={18} />
                {!sidebarCollapsed && <span>Mis Recibos / Pagar</span>}
              </Link>
              <Link to="/propietario/estado-cuenta" className={navClass('/propietario/estado-cuenta')} title="Tesoreria">
                <BookOpen size={18} />
                {!sidebarCollapsed && <span>Tesoreria</span>}
              </Link>
              <Link to="/propietario/estado-cuenta-inmueble" className={navClass('/propietario/estado-cuenta-inmueble')} title="Estado de Cuenta Inmueble">
                <FileText size={18} />
                {!sidebarCollapsed && <span>Estado Cuenta Inmueble</span>}
              </Link>
              <Link to="/propietario/alquileres" className={navClass('/propietario/alquileres')} title="Alquileres">
                <CalendarDays size={18} />
                {!sidebarCollapsed && <span>Alquileres</span>}
              </Link>
              <Link to="/propietario/notificaciones" className={navClass('/propietario/notificaciones')} title="Notificaciones">
                <Bell size={18} />
                {!sidebarCollapsed && <span>Notificaciones</span>}
              </Link>
              <Link to="/mis-cartas-consulta" className={navClass('/mis-cartas-consulta')} title="Cartas Consulta">
                <ClipboardList size={18} />
                {!sidebarCollapsed && <span>Cartas Consulta</span>}
              </Link>

              <p className={`mt-6 ${sectionTitleClass}`}>Configuracion</p>
              <Link to="/propietario/perfil" className={navClass('/propietario/perfil')} title="Mi Perfil">
                <UserCircle2 size={18} />
                {!sidebarCollapsed && <span>Mi Perfil</span>}
              </Link>
            </>
          )}

          {!sidebarCollapsed && (
            <div className="mx-1 mt-6 rounded-xl border border-emerald-900/70 bg-[#0d4f2f] p-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-100/70">Hora del sistema</p>
              <p className="mt-1 text-xs font-semibold text-emerald-50">{systemDateTimeLabel}</p>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-emerald-900/60">
          <button
            onClick={handleLogout}
            className={`w-full rounded-xl text-emerald-100/85 hover:text-white hover:bg-[#0d4f2f] transition-colors ${sidebarCollapsed ? 'p-2.5 flex items-center justify-center' : 'p-2.5 flex items-center gap-3'}`}
            title="Cerrar sesion"
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="font-medium">Cerrar Sesion</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="h-14 md:h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161b22] px-4 md:px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSidebarToggle}
            className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            title={mobileSidebarOpen ? 'Cerrar menú lateral' : (sidebarCollapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral')}
          >
            {mobileSidebarOpen ? <PanelLeftClose size={17} /> : sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <div className="flex items-center gap-3">
            {isSupportSession && (
              <button
                type="button"
                onClick={() => { void handleExitSupport(); }}
                className="h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
                title="Salir del modo soporte"
              >
                Modo Soporte
              </button>
            )}
            <p className="max-w-[52vw] truncate text-xs sm:text-sm text-gray-500 dark:text-gray-300">
              Hola, <span className="font-semibold text-gray-900 dark:text-white">{displayName}</span>
            </p>
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-[#0f111a] border border-gray-200 dark:border-gray-700 text-lg transition-transform active:scale-90"
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100 flex items-center justify-center text-xs font-black">
              {String(displayName || 'U').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {navTo('/dashboard') !== location.pathname && !hideOuterPageHeader && (
            <header className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{resolvedPageTitle}</h2>
              <p className="text-gray-500 text-sm dark:text-gray-400">
                {userRole === 'Propietario' && propiedadActiva ? propiedadResumen : 'Gestion central del condominio'}
              </p>
            </header>
          )}

          <Outlet context={{ user, userRole, misPropiedades, propiedadActiva, condominioTipo }} />
        </div>
      </main>

            {sessionEndedModalOpen && (
        <ModalBase
          onClose={handleSessionEndedAcknowledge}
          title="Sesion cerrada"
          subtitle="Para evitar operaciones incompletas, debes iniciar sesion nuevamente."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">{sessionEndedMessage}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSessionEndedAcknowledge}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Ir al inicio de sesion
              </button>
            </div>
          </div>
        </ModalBase>
      )}
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
      <AIChatWidget {...(userRole ? { userRole } : {})} />
    </div>
  );
};

export default Layout;
