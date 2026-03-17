import { useEffect, useState, type FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

interface User {
  id?: number;
  nombre: string;
  cedula?: string;
  email?: string;
  telefono?: string;
}

interface PropiedadActiva {
  identificador: string;
  nombre_condominio: string;
}

interface OutletContextType {
  userRole?: string;
  user?: User;
  propiedadActiva?: PropiedadActiva | null;
}

interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

const PerfilPropietario: FC = () => {
  const { userRole, user, propiedadActiva } = useOutletContext<OutletContextType>();
  const [form, setForm] = useState<{ cedula: string; email: string; telefono: string }>({
    cedula: user?.cedula || '',
    email: user?.email || '',
    telefono: user?.telefono || '',
  });
  const [passwordForm, setPasswordForm] = useState<{ nueva_password: string; confirmar_password: string }>({
    nueva_password: '',
    confirmar_password: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);

  useEffect(() => {
    setForm({
      cedula: user?.cedula || '',
      email: user?.email || '',
      telefono: user?.telefono || '',
    });
  }, [user?.cedula, user?.email, user?.telefono]);

  const persistLocalUser = (next: { cedula: string; email: string; telefono: string }): void => {
    const raw = localStorage.getItem('habioo_user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      localStorage.setItem(
        'habioo_user',
        JSON.stringify({
          ...parsed,
          cedula: next.cedula || null,
          email: next.email || null,
          telefono: next.telefono || null,
        }),
      );
    } catch {
      // no-op
    }
  };

  const handleSaveProfile = async (): Promise<void> => {
    const cedula = form.cedula.trim().toUpperCase();
    const email = form.email.trim().toLowerCase();
    const telefono = form.telefono.trim();

    if (!cedula) {
      alert('La cedula es obligatoria.');
      return;
    }
    if (!/^[VEJG][0-9]{5,9}$/i.test(cedula)) {
      alert('Formato de cedula invalido. Use V, E, J o G seguido de numeros.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Formato de correo invalido.');
      return;
    }
    if (telefono && !/^[0-9]{7,15}$/.test(telefono)) {
      alert('El telefono debe contener solo numeros (7 a 15 digitos).');
      return;
    }

    setIsSavingProfile(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/api/propietario/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cedula,
          email: email || null,
          telefono: telefono || null,
        }),
      });

      const data: ApiResponse = (await res.json()) as ApiResponse;
      if (!res.ok || data.status !== 'success') {
        alert(data.message || 'No se pudo actualizar el perfil.');
        return;
      }

      const next = { cedula, email, telefono };
      setForm(next);
      persistLocalUser(next);
      alert(data.message || 'Perfil actualizado correctamente.');
    } catch {
      alert('Error de conexion al actualizar el perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (): Promise<void> => {
    const nueva = passwordForm.nueva_password.trim();
    const confirmar = passwordForm.confirmar_password.trim();

    if (!nueva || !confirmar) {
      alert('Debe escribir la nueva clave en ambos campos.');
      return;
    }
    if (nueva.length < 6) {
      alert('La clave debe tener al menos 6 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      alert('Las claves no coinciden.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/api/propietario/perfil/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nueva_password: nueva }),
      });

      const data: ApiResponse = (await res.json()) as ApiResponse;
      if (!res.ok || data.status !== 'success') {
        alert(data.message || 'No se pudo cambiar la clave.');
        return;
      }

      setPasswordForm({ nueva_password: '', confirmar_password: '' });
      alert(data.message || 'Clave actualizada correctamente.');
    } catch {
      alert('Error de conexion al actualizar la clave.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Nombre</p>
          <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{user?.nombre || '-'}</p>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Cedula</p>
          <input
            type="text"
            value={form.cedula}
            onChange={(e) => setForm((prev) => ({ ...prev, cedula: e.target.value.toUpperCase() }))}
            placeholder="Ej: V12345678"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Email</p>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Ej: propietario@email.com"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Telefono</p>
          <input
            type="text"
            inputMode="numeric"
            value={form.telefono}
            onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value.replace(/[^0-9]/g, '') }))}
            placeholder="Ej: 04141234567"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile}
              className="rounded-xl bg-donezo-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {isSavingProfile ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Inmueble Activo</p>
            <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{propiedadActiva?.identificador || '-'}</p>

            <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Condominio</p>
            <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{propiedadActiva?.nombre_condominio || '-'}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Cambiar Clave</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Escribe la nueva clave dos veces para confirmarla.
            </p>

            <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Nueva clave</p>
            <input
              type="password"
              value={passwordForm.nueva_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, nueva_password: e.target.value }))}
              placeholder="Nueva clave"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />

            <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Confirmar clave</p>
            <input
              type="password"
              value={passwordForm.confirmar_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmar_password: e.target.value }))}
              placeholder="Confirmar clave"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />

            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleSavePassword()}
                disabled={isSavingPassword}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-60 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
              >
                {isSavingPassword ? 'Actualizando...' : 'Actualizar Clave'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PerfilPropietario;
