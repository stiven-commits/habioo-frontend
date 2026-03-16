import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { API_BASE_URL } from '../config/api';

type UploadTipo = 'logo' | 'firma';

interface PerfilCondominioFormData {
  nombre_legal: string;
  rif: string;
  direccion: string;
  porcentaje_morosidad: string;
  admin_nombre: string;
  admin_rif: string;
  admin_representante: string;
  admin_telefono: string;
  admin_correo: string;
  logo_url: string;
  firma_url: string;
}

interface PerfilCondominioApiData {
  nombre_legal?: string | null;
  nombre?: string | null;
  rif?: string | null;
  direccion?: string | null;
  porcentaje_morosidad?: string | number | null;
  tasa_interes?: string | number | null;
  admin_nombre?: string | null;
  admin_rif?: string | null;
  admin_representante?: string | null;
  admin_telefono?: string | null;
  admin_correo?: string | null;
  logo_url?: string | null;
  firma_url?: string | null;
}

interface PasswordFormData {
  nueva_password: string;
  confirmar_password: string;
}

interface ApiSuccess<T> {
  status: 'success';
  data?: T;
  message?: string;
}

interface ApiError {
  status: 'error';
  message: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

const initialPerfil: PerfilCondominioFormData = {
  nombre_legal: '',
  rif: '',
  direccion: '',
  porcentaje_morosidad: '',
  admin_nombre: '',
  admin_rif: '',
  admin_representante: '',
  admin_telefono: '',
  admin_correo: '',
  logo_url: '',
  firma_url: '',
};

const initialPasswordForm: PasswordFormData = {
  nueva_password: '',
  confirmar_password: '',
};

const buildAssetUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const cardClass =
  'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark';

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';

const PerfilCondominio: FC = () => {
  const [form, setForm] = useState<PerfilCondominioFormData>(initialPerfil);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(initialPasswordForm);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [uploading, setUploading] = useState<{ logo: boolean; firma: boolean }>({ logo: false, firma: false });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const token = useMemo<string>(() => localStorage.getItem('habioo_token') || '', []);

  const loadPerfil = async (): Promise<void> => {
    try {
      setLoading(true);
      setErrorMessage('');

      const res = await fetch(`${API_BASE_URL}/api/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: ApiResponse<PerfilCondominioApiData> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.status === 'error' ? data.message : 'No se pudo cargar el perfil.');
        return;
      }

      const profile: PerfilCondominioApiData = data.data ?? {};
      setForm({
        // Soportamos ambos nombres para evitar vacíos por diferencias backend/frontend.
        nombre_legal: String(profile.nombre_legal ?? profile.nombre ?? ''),
        rif: String(profile.rif ?? ''),
        direccion: String(profile.direccion ?? ''),
        porcentaje_morosidad: String(profile.porcentaje_morosidad ?? profile.tasa_interes ?? ''),
        admin_nombre: String(profile.admin_nombre ?? ''),
        admin_rif: String(profile.admin_rif ?? ''),
        admin_representante: String(profile.admin_representante ?? ''),
        admin_telefono: String(profile.admin_telefono ?? ''),
        admin_correo: String(profile.admin_correo ?? ''),
        logo_url: String(profile.logo_url ?? ''),
        firma_url: String(profile.firma_url ?? ''),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al cargar el perfil.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPerfil();
  }, []);

  const handleInputChange =
    (field: keyof PerfilCondominioFormData) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handlePasswordInputChange =
    (field: keyof PasswordFormData) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleGuardarCambios = async (): Promise<void> => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        // nombre para backend actual, nombre_legal por compatibilidad.
        nombre: form.nombre_legal.trim(),
        nombre_legal: form.nombre_legal.trim(),
        rif: form.rif.trim(),
        direccion: form.direccion.trim(),
        porcentaje_morosidad: form.porcentaje_morosidad === '' ? null : Number(form.porcentaje_morosidad),
        admin_nombre: form.admin_nombre.trim(),
        admin_rif: form.admin_rif.trim(),
        admin_representante: form.admin_representante.trim(),
        admin_telefono: form.admin_telefono.trim(),
        admin_correo: form.admin_correo.trim(),
      };

      const res = await fetch(`${API_BASE_URL}/api/perfil`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.status === 'error' ? data.message : 'No se pudo guardar.');
        return;
      }

      setSuccessMessage(data.message || 'Cambios guardados correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al guardar.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (tipo: UploadTipo, file: File): Promise<void> => {
    try {
      setUploading((prev) => ({ ...prev, [tipo]: true }));
      setErrorMessage('');
      setSuccessMessage('');

      const formData = new FormData();
      formData.append('archivo', file);

      const res = await fetch(`${API_BASE_URL}/api/perfil/upload/${tipo}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data: ApiResponse<{ tipo: UploadTipo; url: string }> = await res.json();
      if (!res.ok || data.status !== 'success' || !data.data?.url) {
        setErrorMessage(data.status === 'error' ? data.message : `No se pudo subir ${tipo}.`);
        return;
      }

      const newUrl = data.data.url;
      setForm((prev) => ({
        ...prev,
        logo_url: tipo === 'logo' ? newUrl : prev.logo_url,
        firma_url: tipo === 'firma' ? newUrl : prev.firma_url,
      }));

      setSuccessMessage(data.message || 'Imagen actualizada correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir la imagen.';
      setErrorMessage(msg);
    } finally {
      setUploading((prev) => ({ ...prev, [tipo]: false }));
    }
  };

  const onUploadChange = (tipo: UploadTipo) => (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleUpload(tipo, file);
    e.target.value = '';
  };

  const handleCambiarPassword = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!passwordForm.nueva_password || !passwordForm.confirmar_password) {
      setErrorMessage('Completa todos los campos de seguridad.');
      return;
    }

    if (passwordForm.nueva_password.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (passwordForm.nueva_password !== passwordForm.confirmar_password) {
      setErrorMessage('La confirmación de contraseña no coincide.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch(`${API_BASE_URL}/api/perfil/password`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nueva_password: passwordForm.nueva_password,
        }),
      });

      const data: ApiResponse<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.status === 'error' ? data.message : 'No se pudo cambiar la contraseña.');
        return;
      }

      setPasswordForm(initialPasswordForm);
      setSuccessMessage(data.message || 'Contraseña actualizada correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al cambiar la contraseña.';
      setErrorMessage(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Perfil y Configuración</h1>
        <button
          type="button"
          onClick={() => void handleGuardarCambios()}
          disabled={loading || saving}
          className="rounded-xl bg-donezo-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark dark:text-gray-300">
          Cargando perfil...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className={cardClass}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">🏢 Datos del Condominio</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>Nombre Legal</label>
                <input className={inputClass} value={form.nombre_legal} onChange={handleInputChange('nombre_legal')} />
              </div>
              <div>
                <label className={labelClass}>RIF</label>
                <input className={inputClass} value={form.rif} onChange={handleInputChange('rif')} />
              </div>
              <div>
                <label className={labelClass}>Dirección</label>
                <textarea rows={4} className={inputClass} value={form.direccion} onChange={handleInputChange('direccion')} />
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">🏬 Empresa Administradora</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Razón Social</label>
                <input className={inputClass} value={form.admin_nombre} onChange={handleInputChange('admin_nombre')} />
              </div>
              <div>
                <label className={labelClass}>RIF Administradora</label>
                <input className={inputClass} value={form.admin_rif} onChange={handleInputChange('admin_rif')} />
              </div>
              <div>
                <label className={labelClass}>Representante Legal</label>
                <input className={inputClass} value={form.admin_representante} onChange={handleInputChange('admin_representante')} />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input className={inputClass} value={form.admin_telefono} onChange={handleInputChange('admin_telefono')} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Correo</label>
                <input type="email" className={inputClass} value={form.admin_correo} onChange={handleInputChange('admin_correo')} />
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">📊 Reglas de Cobranza</h2>
            <div>
              <label className={labelClass}>Porcentaje de Morosidad (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={form.porcentaje_morosidad}
                onChange={handleInputChange('porcentaje_morosidad')}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Se aplica a propietarios con más de 2 avisos vencidos.</p>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">🎨 Identidad Visual</h2>
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Logo de la Administradora/Condominio</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    {uploading.logo ? 'Subiendo...' : 'Subir Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadChange('logo')} />
                  </label>
                  {form.logo_url ? (
                    <img src={buildAssetUrl(form.logo_url)} alt="Logo" className="h-20 w-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700" />
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Sin imagen cargada.</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Sello/Firma digital</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    {uploading.firma ? 'Subiendo...' : 'Subir Firma'}
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadChange('firma')} />
                  </label>
                  {form.firma_url ? (
                    <img
                      src={buildAssetUrl(form.firma_url)}
                      alt="Firma"
                      className="h-20 w-auto rounded-lg border border-gray-200 bg-white p-1 mix-blend-multiply dark:border-gray-700"
                    />
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Sin imagen cargada.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={`${cardClass} xl:col-span-2`}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">🔒 Seguridad</h2>
            <form onSubmit={(e) => void handleCambiarPassword(e)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Nueva Contraseña</label>
                <input type="password" className={inputClass} value={passwordForm.nueva_password} onChange={handlePasswordInputChange('nueva_password')} />
              </div>
              <div>
                <label className={labelClass}>Confirmar Contraseña</label>
                <input type="password" className={inputClass} value={passwordForm.confirmar_password} onChange={handlePasswordInputChange('confirmar_password')} />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  {changingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default PerfilCondominio;

