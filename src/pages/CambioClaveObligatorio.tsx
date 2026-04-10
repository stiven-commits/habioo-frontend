import { useMemo, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ShieldAlert, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

interface ApiResponse {
  status?: 'success' | 'error';
  message?: string;
}

const CambioClaveObligatorio: FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const sessionRole = useMemo<string>(() => {
    try {
      const sessionRaw = localStorage.getItem('habioo_session') || '{}';
      const session = JSON.parse(sessionRaw) as { role?: string };
      return String(session.role || '').trim();
    } catch {
      return '';
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const token = localStorage.getItem('habioo_token');
    if (!token) {
      setError('Tu sesión no es válida. Inicia sesión nuevamente.');
      return;
    }

    const endpoint = sessionRole === 'Propietario'
      ? `${API_BASE_URL}/api/propietario/perfil/password`
      : `${API_BASE_URL}/api/perfil/password`;

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nueva_password: newPassword }),
      });

      const data: ApiResponse = await res.json();
      if (!res.ok || data.status === 'error') {
        setError(data.message || 'No se pudo actualizar la contraseña. Intenta nuevamente.');
        setLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldAlert size={26} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Cambio de clave obligatorio</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Por tu seguridad, detectamos que estas usando la contraseña por defecto.
            Debes crear una nueva contraseña para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Nueva Contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none ring-emerald-500 transition focus:ring-2"
            placeholder="Minimo 6 caracteres"
            required
          />

          <label className="mb-2 block text-sm font-semibold text-slate-700">Confirmar Contraseña</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none ring-emerald-500 transition focus:ring-2"
            placeholder="Repite la nueva contraseña"
            required
          />

          {error ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <LockKeyhole size={18} />
            {loading ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CambioClaveObligatorio;
