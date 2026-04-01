import { useEffect, useMemo, useState, type FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import DataTable from '../components/ui/DataTable';

interface UserLite {
  nombre?: string;
}

interface OutletContextType {
  userRole?: 'Administrador' | 'Propietario' | 'SuperUsuario';
  user?: UserLite | null;
}

interface CondominioSoporte {
  condominio_id: number;
  nombre_junta: string;
  tipo_junta?: 'Junta General' | 'Junta Individual' | string | null;
  junta_general_id?: number | null;
  nombre_junta_general?: string | null;
  rif_junta?: string | null;
  admin_user_id?: number | null;
  admin_nombre?: string | null;
  admin_cedula?: string | null;
  total_inmuebles?: string | number;
}

interface JuntaGeneralOption {
  id: number;
  nombre_junta: string;
  rif_junta?: string | null;
}

interface CondominiosResponse {
  status: 'success' | 'error';
  data?: CondominioSoporte[];
  message?: string;
}

interface JuntaGeneralOptionsResponse {
  status: 'success' | 'error';
  data?: JuntaGeneralOption[];
  message?: string;
}

interface EntrarSoporteResponse {
  status: 'success' | 'error';
  token?: string;
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
  message?: string;
}

interface CrearCondominioResponse {
  status: 'success' | 'error';
  data?: {
    condominio_id: number;
    admin_user_id: number;
    tipo: 'Junta General' | 'Junta Individual';
  };
  message?: string;
}

const toNumber = (value: unknown): number => Number.parseInt(String(value ?? 0), 10) || 0;
const toDecimal = (value: string): number | null => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const SoporteSuperUsuario: FC = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<CondominioSoporte[]>([]);
  const [juntasGenerales, setJuntasGenerales] = useState<JuntaGeneralOption[]>([]);
  const [search, setSearch] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Soporte tecnico');
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');

  const [createMessage, setCreateMessage] = useState<string>('');
  const [createError, setCreateError] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [tipo, setTipo] = useState<'Junta General' | 'Junta Individual'>('Junta General');
  const [nombreJunta, setNombreJunta] = useState<string>('');
  const [rifJunta, setRifJunta] = useState<string>('');
  const [adminNombre, setAdminNombre] = useState<string>('');
  const [adminCedula, setAdminCedula] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminTelefono, setAdminTelefono] = useState<string>('');
  const [estadoVenezuela, setEstadoVenezuela] = useState<string>('Distrito Capital');
  const [juntaGeneralId, setJuntaGeneralId] = useState<string>('');
  const [cuotaParticipacion, setCuotaParticipacion] = useState<string>('');

  const fetchCondominios = async (): Promise<void> => {
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/support/condominios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: CondominiosResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setRows([]);
        setMessage(data.message || 'No se pudo cargar la lista de juntas.');
        return;
      }
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch {
      setRows([]);
      setMessage('Error de conexion al cargar juntas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchJuntasGenerales = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/support/juntas-generales`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: JuntaGeneralOptionsResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setJuntasGenerales([]);
        return;
      }
      setJuntasGenerales(Array.isArray(data.data) ? data.data : []);
    } catch {
      setJuntasGenerales([]);
    }
  };

  useEffect(() => {
    if (userRole === 'SuperUsuario') {
      void fetchCondominios();
      void fetchJuntasGenerales();
    }
  }, [userRole]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (
      String(r.nombre_junta || '').toLowerCase().includes(q)
      || String(r.rif_junta || '').toLowerCase().includes(q)
      || String(r.admin_nombre || '').toLowerCase().includes(q)
      || String(r.admin_cedula || '').toLowerCase().includes(q)
      || String(r.tipo_junta || '').toLowerCase().includes(q)
      || String(r.nombre_junta_general || '').toLowerCase().includes(q)
    ));
  }, [rows, search]);

  const handleEntrar = async (row: CondominioSoporte): Promise<void> => {
    const condominioId = toNumber(row.condominio_id);
    if (!condominioId) return;
    setWorkingId(condominioId);
    setMessage('');
    try {
      const token = localStorage.getItem('habioo_token') || '';
      const currentUser = localStorage.getItem('habioo_user') || '{}';
      const currentSession = localStorage.getItem('habioo_session') || '{}';
      if (!token) {
        setMessage('Sesion invalida. Inicia sesion nuevamente.');
        return;
      }

      localStorage.setItem('habioo_super_token_backup', token);
      localStorage.setItem('habioo_super_user_backup', currentUser);
      localStorage.setItem('habioo_super_session_backup', currentSession);
      sessionStorage.setItem('habioo_super_token_backup', token);
      sessionStorage.setItem('habioo_super_user_backup', currentUser);
      sessionStorage.setItem('habioo_super_session_backup', currentSession);

      const res = await fetch(`${API_BASE_URL}/support/entrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          condominio_id: condominioId,
          motivo: String(motivo || '').trim(),
        }),
      });
      const data: EntrarSoporteResponse = await res.json();
      if (!res.ok || data.status !== 'success' || !data.token) {
        setMessage(data.message || 'No se pudo iniciar la sesion de soporte.');
        return;
      }

      localStorage.setItem('habioo_token', data.token);
      localStorage.setItem('habioo_user', JSON.stringify(data.user || {}));
      localStorage.setItem('habioo_session', JSON.stringify(data.session || {}));
      window.location.assign('/dashboard');
    } catch {
      setMessage('Error de conexion al entrar en modo soporte.');
    } finally {
      setWorkingId(null);
    }
  };

  const resetCreateForm = (): void => {
    setTipo('Junta General');
    setNombreJunta('');
    setRifJunta('');
    setAdminNombre('');
    setAdminCedula('');
    setAdminPassword('');
    setAdminEmail('');
    setAdminTelefono('');
    setEstadoVenezuela('Distrito Capital');
    setJuntaGeneralId('');
    setCuotaParticipacion('');
  };

  const handleCreate = async (): Promise<void> => {
    setCreateMessage('');
    setCreateError(false);

    if (!nombreJunta.trim()) {
      setCreateError(true);
      setCreateMessage('Debes indicar el nombre de la junta.');
      return;
    }
    if (!rifJunta.trim()) {
      setCreateError(true);
      setCreateMessage('Debes indicar el RIF de la junta.');
      return;
    }
    if (!adminNombre.trim()) {
      setCreateError(true);
      setCreateMessage('Debes indicar el nombre de la administradora.');
      return;
    }
    if (!adminCedula.trim()) {
      setCreateError(true);
      setCreateMessage('Debes indicar la cedula de la administradora.');
      return;
    }

    if (tipo === 'Junta Individual' && juntaGeneralId) {
      const cuotaValue = cuotaParticipacion.trim() ? toDecimal(cuotaParticipacion) : null;
      if (cuotaValue === null || cuotaValue < 0) {
        setCreateError(true);
        setCreateMessage('La cuota de participacion debe ser un numero mayor o igual a cero.');
        return;
      }
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const cuotaValue = cuotaParticipacion.trim() ? toDecimal(cuotaParticipacion) : null;
      const payload = {
        tipo,
        nombre_junta: nombreJunta.trim(),
        rif_junta: rifJunta.trim(),
        admin_nombre: adminNombre.trim(),
        admin_cedula: adminCedula.trim(),
        admin_password: adminPassword.trim() || undefined,
        admin_email: adminEmail.trim() || undefined,
        admin_telefono: adminTelefono.trim() || undefined,
        estado_venezuela: estadoVenezuela.trim() || undefined,
        junta_general_id: tipo === 'Junta Individual' && juntaGeneralId ? Number.parseInt(juntaGeneralId, 10) : null,
        cuota_participacion: tipo === 'Junta Individual' && juntaGeneralId ? cuotaValue : null,
      };

      const res = await fetch(`${API_BASE_URL}/support/condominios/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data: CrearCondominioResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setCreateError(true);
        setCreateMessage(data.message || 'No se pudo registrar la junta.');
        return;
      }

      setCreateError(false);
      setCreateMessage(data.message || 'Junta registrada correctamente.');
      resetCreateForm();
      await Promise.all([fetchCondominios(), fetchJuntasGenerales()]);
    } catch {
      setCreateError(true);
      setCreateMessage('Error de conexion al registrar la junta.');
    } finally {
      setCreating(false);
    }
  };

  if (userRole !== 'SuperUsuario') {
    return <p className="p-6">No tienes permisos para esta seccion.</p>;
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h3 className="text-xl font-black text-gray-900 dark:text-white">Panel de Soporte Habioo</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Registra juntas de condominio y entra en sesion delegada para brindar soporte.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <select
            value={tipo}
            onChange={(e) => {
              const next = (e.target.value === 'Junta Individual' ? 'Junta Individual' : 'Junta General');
              setTipo(next);
              if (next === 'Junta General') {
                setJuntaGeneralId('');
                setCuotaParticipacion('');
              }
            }}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="Junta General">Junta General</option>
            <option value="Junta Individual">Junta Individual</option>
          </select>
          <input
            type="text"
            value={nombreJunta}
            onChange={(e) => setNombreJunta(e.target.value)}
            placeholder="Nombre de la junta"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={rifJunta}
            onChange={(e) => setRifJunta(e.target.value)}
            placeholder="RIF de la junta"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={estadoVenezuela}
            onChange={(e) => setEstadoVenezuela(e.target.value)}
            placeholder="Estado (ej: Distrito Capital)"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <input
            type="text"
            value={adminNombre}
            onChange={(e) => setAdminNombre(e.target.value)}
            placeholder="Nombre administradora"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={adminCedula}
            onChange={(e) => setAdminCedula(e.target.value)}
            placeholder="Cedula administradora"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Password admin (opcional)"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="Email admin (opcional)"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <input
            type="text"
            value={adminTelefono}
            onChange={(e) => setAdminTelefono(e.target.value)}
            placeholder="Telefono admin (opcional)"
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <select
            value={juntaGeneralId}
            onChange={(e) => setJuntaGeneralId(e.target.value)}
            disabled={tipo !== 'Junta Individual'}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Sin vinculacion a junta general</option>
            {juntasGenerales.map((jg) => (
              <option key={jg.id} value={jg.id}>
                {jg.nombre_junta} ({jg.rif_junta || 'sin rif'})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={cuotaParticipacion}
            onChange={(e) => setCuotaParticipacion(e.target.value)}
            placeholder="Cuota participacion (si vincula)"
            disabled={tipo !== 'Junta Individual' || !juntaGeneralId}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={() => { void handleCreate(); }}
              disabled={creating}
              className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Registrando junta...' : 'Registrar junta de condominio'}
            </button>
          </div>
          <div className="lg:col-span-4">
            {createMessage ? (
              <p className={`text-sm font-semibold ${createError ? 'text-red-600' : 'text-emerald-600'}`}>
                {createMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar junta, RIF o administradora..."
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de soporte"
            maxLength={240}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white lg:col-span-2"
          />
        </div>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        {loading ? (
          <p className="py-8 text-center text-gray-500">Cargando juntas...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No hay juntas para mostrar.</p>
        ) : (
          <DataTable
            tableStyle={{ minWidth: '1100px' }}
            columns={[
              { key: 'junta', header: 'Junta', className: 'font-semibold text-gray-900 dark:text-gray-100', render: (row) => row.nombre_junta },
              { key: 'tipo', header: 'Tipo', className: 'text-gray-700 dark:text-gray-300', render: (row) => row.tipo_junta || 'Junta Individual' },
              {
                key: 'general',
                header: 'Junta General',
                className: 'text-gray-700 dark:text-gray-300',
                render: (row) => (row.nombre_junta_general || '-'),
              },
              { key: 'rif', header: 'RIF', className: 'font-mono text-gray-700 dark:text-gray-300', render: (row) => row.rif_junta || '-' },
              {
                key: 'admin',
                header: 'Administradora',
                className: 'text-gray-800 dark:text-gray-200',
                render: (row) => (
                  <>
                    <p className="font-semibold">{row.admin_nombre || 'Sin administradora'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{row.admin_cedula || ''}</p>
                  </>
                ),
              },
              { key: 'inmuebles', header: 'Inmuebles', headerClassName: 'text-right', className: 'text-right font-mono text-gray-700 dark:text-gray-300', render: (row) => toNumber(row.total_inmuebles) },
              {
                key: 'accion',
                header: 'Accion',
                headerClassName: 'text-right',
                className: 'text-right',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => { void handleEntrar(row); }}
                    disabled={workingId === row.condominio_id}
                    className="rounded-xl bg-donezo-primary px-3 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {workingId === row.condominio_id ? 'Entrando...' : 'Entrar como soporte'}
                  </button>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(row) => row.condominio_id}
            rowClassName="border-b border-gray-100 dark:border-gray-800/70"
          />
        )}
        {message ? <p className="mt-3 text-sm font-semibold text-red-600">{message}</p> : null}
      </article>
    </section>
  );
};

export default SoporteSuperUsuario;
