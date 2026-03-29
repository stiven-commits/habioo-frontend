import { useEffect, useMemo, useState, type FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

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
  rif_junta?: string | null;
  admin_user_id?: number | null;
  admin_nombre?: string | null;
  admin_cedula?: string | null;
  total_inmuebles?: string | number;
}

interface CondominiosResponse {
  status: 'success' | 'error';
  data?: CondominioSoporte[];
  message?: string;
}

interface EntrarSoporteResponse {
  status: 'success' | 'error';
  token?: string;
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
  message?: string;
}

const toNumber = (value: unknown): number => Number.parseInt(String(value ?? 0), 10) || 0;

const SoporteSuperUsuario: FC = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<CondominioSoporte[]>([]);
  const [search, setSearch] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Soporte técnico');
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');

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
      setMessage('Error de conexión al cargar juntas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'SuperUsuario') {
      void fetchCondominios();
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

      // Refrescamos el respaldo en cada intento para evitar datos stale.
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
        setMessage(data.message || 'No se pudo iniciar la sesión de soporte.');
        return;
      }

      localStorage.setItem('habioo_token', data.token);
      localStorage.setItem('habioo_user', JSON.stringify(data.user || {}));
      localStorage.setItem('habioo_session', JSON.stringify(data.session || {}));
      window.location.assign('/dashboard');
    } catch {
      setMessage('Error de conexión al entrar en modo soporte.');
    } finally {
      setWorkingId(null);
    }
  };

  if (userRole !== 'SuperUsuario') {
    return <p className="p-6">No tienes permisos para esta sección.</p>;
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h3 className="text-xl font-black text-gray-900 dark:text-white">Panel de Soporte Habioo</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Selecciona una junta de condominio para entrar en sesión delegada y brindar soporte.
        </p>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="p-3 font-bold uppercase text-[11px]">Junta</th>
                  <th className="p-3 font-bold uppercase text-[11px]">RIF</th>
                  <th className="p-3 font-bold uppercase text-[11px]">Administradora</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Inmuebles</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.condominio_id} className="border-b border-gray-100 dark:border-gray-800/70">
                    <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{row.nombre_junta}</td>
                    <td className="p-3 font-mono text-gray-700 dark:text-gray-300">{row.rif_junta || '-'}</td>
                    <td className="p-3 text-gray-800 dark:text-gray-200">
                      <p className="font-semibold">{row.admin_nombre || 'Sin administradora'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{row.admin_cedula || ''}</p>
                    </td>
                    <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {toNumber(row.total_inmuebles)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => { void handleEntrar(row); }}
                        disabled={workingId === row.condominio_id}
                        className="rounded-xl bg-donezo-primary px-3 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {workingId === row.condominio_id ? 'Entrando...' : 'Entrar como soporte'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {message ? <p className="mt-3 text-sm font-semibold text-red-600">{message}</p> : null}
      </article>
    </section>
  );
};

export default SoporteSuperUsuario;
