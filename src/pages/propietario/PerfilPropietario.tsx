import { useEffect, useState, type FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

interface User {
  id?: number;
  nombre: string;
  cedula?: string;
  email?: string;
  email_secundario?: string;
  telefono?: string;
  telefono_secundario?: string;
}

interface PropiedadActiva {
  id_propiedad?: number;
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

interface ProfileForm {
  cedula: string;
  email: string;
  email_secundario: string;
  telefono: string;
  telefono_secundario: string;
}

interface PerfilRelacionUser {
  id: number;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  email_secundario: string | null;
  telefono_secundario: string | null;
}

interface PerfilRelacionesData {
  propiedad_id: number;
  rol_actual: string | null;
  propietario: PerfilRelacionUser | null;
  residente: PerfilRelacionUser | null;
  copropietarios: PerfilRelacionUser[];
}

interface PerfilApiData {
  id: number;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  email_secundario: string | null;
  telefono: string | null;
  telefono_secundario: string | null;
}

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const labelClass = 'text-xs font-black uppercase tracking-wider text-gray-400';

const PerfilPropietario: FC = () => {
  const { userRole, user, propiedadActiva } = useOutletContext<OutletContextType>();

  const [form, setForm] = useState<ProfileForm>({
    cedula: user?.cedula || '',
    email: user?.email || '',
    email_secundario: user?.email_secundario || '',
    telefono: user?.telefono || '',
    telefono_secundario: user?.telefono_secundario || '',
  });

  const [passwordForm, setPasswordForm] = useState<{ nueva_password: string; confirmar_password: string }>({
    nueva_password: '',
    confirmar_password: '',
  });

  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
  const [relaciones, setRelaciones] = useState<PerfilRelacionesData | null>(null);
  const [loadingRelaciones, setLoadingRelaciones] = useState<boolean>(false);
  const [nombrePerfil, setNombrePerfil] = useState<string>(user?.nombre || '');

  useEffect(() => {
    setForm({
      cedula: user?.cedula || '',
      email: user?.email || '',
      email_secundario: user?.email_secundario || '',
      telefono: user?.telefono || '',
      telefono_secundario: user?.telefono_secundario || '',
    });
    setNombrePerfil(user?.nombre || '');
  }, [user?.cedula, user?.email, user?.email_secundario, user?.telefono, user?.telefono_secundario]);

  useEffect(() => {
    if (userRole !== 'Propietario') return;
    const fetchPerfil = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/perfil`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: ApiResponse<PerfilApiData> = (await res.json()) as ApiResponse<PerfilApiData>;
        if (!res.ok || data.status !== 'success' || !data.data) return;
        const perfil = data.data;
        setForm({
          cedula: perfil.cedula || '',
          email: perfil.email || '',
          email_secundario: perfil.email_secundario || '',
          telefono: perfil.telefono || '',
          telefono_secundario: perfil.telefono_secundario || '',
        });
        setNombrePerfil(perfil.nombre || user?.nombre || '');
      } catch {
        // no-op
      }
    };
    void fetchPerfil();
  }, [userRole, user?.nombre]);

  useEffect(() => {
    if (userRole !== 'Propietario') return;
    const fetchRelaciones = async (): Promise<void> => {
      setLoadingRelaciones(true);
      try {
        const token = localStorage.getItem('habioo_token');
        const query = propiedadActiva?.id_propiedad ? `?propiedad_id=${propiedadActiva.id_propiedad}` : '';
        const res = await fetch(`${API_BASE_URL}/api/propietario/perfil-relaciones${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: ApiResponse<PerfilRelacionesData> = (await res.json()) as ApiResponse<PerfilRelacionesData>;
        if (res.ok && data.status === 'success' && data.data) {
          setRelaciones(data.data);
        } else {
          setRelaciones(null);
        }
      } catch {
        setRelaciones(null);
      } finally {
        setLoadingRelaciones(false);
      }
    };
    void fetchRelaciones();
  }, [userRole, propiedadActiva?.id_propiedad]);


  const persistLocalUser = (next: ProfileForm): void => {
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
          email_secundario: next.email_secundario || null,
          telefono: next.telefono || null,
          telefono_secundario: next.telefono_secundario || null,
        }),
      );
    } catch {
      // no-op
    }
  };

  const handleSaveProfile = async (): Promise<void> => {
    const cedula = form.cedula.trim().toUpperCase();
    const email = form.email.trim().toLowerCase();
    const email_secundario = form.email_secundario.trim().toLowerCase();
    const telefono = form.telefono.trim();
    const telefono_secundario = form.telefono_secundario.trim();

    if (!cedula) { alert('La cedula es obligatoria.'); return; }
    if (!/^[VEJG][0-9]{5,9}$/i.test(cedula)) { alert('Formato de cedula invalido. Use V, E, J o G seguido de numeros.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Formato de correo invalido.'); return; }
    if (email_secundario && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_secundario)) { alert('Formato de correo secundario invalido.'); return; }
    if (telefono && !/^[0-9]{7,15}$/.test(telefono)) { alert('El telefono debe contener solo numeros (7 a 15 digitos).'); return; }
    if (telefono_secundario && !/^[0-9]{7,15}$/.test(telefono_secundario)) { alert('El telefono alternativo debe contener solo numeros (7 a 15 digitos).'); return; }

    setIsSavingProfile(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/api/propietario/perfil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cedula,
          email: email || null,
          email_secundario: email_secundario || null,
          telefono: telefono || null,
          telefono_secundario: telefono_secundario || null,
        }),
      });

      const data: ApiResponse<PerfilApiData> = (await res.json()) as ApiResponse<PerfilApiData>;
      if (!res.ok || data.status !== 'success') { alert(data.message || 'No se pudo actualizar el perfil.'); return; }
      const persisted = data.data;
      const next: ProfileForm = {
        cedula: persisted?.cedula || cedula,
        email: persisted?.email || '',
        email_secundario: persisted?.email_secundario || '',
        telefono: persisted?.telefono || '',
        telefono_secundario: persisted?.telefono_secundario || '',
      };
      setForm(next);
      setNombrePerfil(persisted?.nombre || nombrePerfil);
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

    if (!nueva || !confirmar) { alert('Debe escribir la nueva clave en ambos campos.'); return; }
    if (nueva.length < 6) { alert('La clave debe tener al menos 6 caracteres.'); return; }
    if (nueva !== confirmar) { alert('Las claves no coinciden.'); return; }

    setIsSavingPassword(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/api/propietario/perfil/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nueva_password: nueva }),
      });

      const data: ApiResponse = (await res.json()) as ApiResponse;
      if (!res.ok || data.status !== 'success') { alert(data.message || 'No se pudo cambiar la clave.'); return; }

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
          <p className="mb-4 text-sm font-black uppercase tracking-wider text-donezo-primary">Informacion Personal</p>

          <p className={labelClass}>Nombre</p>
          <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{nombrePerfil || '-'}</p>

          <p className={`mt-4 ${labelClass}`}>Cedula</p>
          <input
            type="text"
            value={form.cedula}
            onChange={(e) => setForm((prev) => ({ ...prev, cedula: e.target.value.toUpperCase() }))}
            placeholder="Ej: V12345678"
            className={inputClass}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Correo Principal</p>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Ej: propietario@email.com"
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>Correo Secundario <span className="normal-case font-normal text-gray-400">(Opcional)</span></p>
              <input
                type="email"
                value={form.email_secundario}
                onChange={(e) => setForm((prev) => ({ ...prev, email_secundario: e.target.value }))}
                placeholder="Ej: otro@email.com"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Telefono (WhatsApp)</p>
              <p className="mb-1 mt-0.5 text-[10px] text-gray-400">Solo numeros, sin espacios ni guiones.</p>
              <input
                type="text"
                inputMode="numeric"
                value={form.telefono}
                onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="Ej: 04141234567"
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>Telefono Alternativo / Fijo</p>
              <p className="mb-1 mt-0.5 text-[10px] text-gray-400">Solo numeros, sin espacios ni guiones.</p>
              <input
                type="text"
                inputMode="numeric"
                value={form.telefono_secundario}
                onChange={(e) => setForm((prev) => ({ ...prev, telefono_secundario: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="Ej: 02121234567"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile}
              className="rounded-xl bg-donezo-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {isSavingProfile ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
            <p className="text-sm font-black uppercase tracking-wider text-donezo-primary">Residente / Inquilino y Copropietarios</p>
            {loadingRelaciones ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Cargando informacion del inmueble...</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <p className={labelClass}>Residente / Inquilino (solo lectura)</p>
                  {relaciones?.residente ? (
                    <div className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                      <p><span className="font-bold">Nombre:</span> {relaciones.residente.nombre || '-'}</p>
                      <p><span className="font-bold">Cedula:</span> {relaciones.residente.cedula || '-'}</p>
                      <p><span className="font-bold">Correo:</span> {relaciones.residente.email || '-'}</p>
                      <p><span className="font-bold">Telefono:</span> {relaciones.residente.telefono || '-'}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-gray-500 dark:text-gray-400">No registrado.</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <p className={labelClass}>Copropietarios (solo lectura)</p>
                  {!relaciones?.copropietarios || relaciones.copropietarios.length === 0 ? (
                    <p className="mt-2 text-gray-500 dark:text-gray-400">No hay copropietarios registrados.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {relaciones.copropietarios.map((item) => (
                        <div key={item.id} className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                          <p className="font-bold text-gray-800 dark:text-gray-200">{item.nombre || '-'}</p>
                          <p className="text-gray-600 dark:text-gray-400">Cedula: {item.cedula || '-'}</p>
                          <p className="text-gray-600 dark:text-gray-400">Correo: {item.email || '-'}</p>
                          <p className="text-gray-600 dark:text-gray-400">Telefono: {item.telefono || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
            <p className={labelClass}>Inmueble Activo</p>
            <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{propiedadActiva?.identificador || '-'}</p>

            <p className={`mt-4 ${labelClass}`}>Condominio</p>
            <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{propiedadActiva?.nombre_condominio || '-'}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
            <p className={labelClass}>Cambiar Clave</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Escribe la nueva clave dos veces para confirmarla.</p>

            <p className={`mt-4 ${labelClass}`}>Nueva clave</p>
            <input
              type="password"
              value={passwordForm.nueva_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, nueva_password: e.target.value }))}
              placeholder="Nueva clave"
              className={inputClass}
            />

            <p className={`mt-4 ${labelClass}`}>Confirmar clave</p>
            <input
              type="password"
              value={passwordForm.confirmar_password}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmar_password: e.target.value }))}
              placeholder="Confirmar clave"
              className={inputClass}
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
  );};

export default PerfilPropietario;
