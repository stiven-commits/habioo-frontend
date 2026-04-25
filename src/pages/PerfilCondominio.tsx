import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { ListNode, ListItemNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { QuoteNode } from '@lexical/rich-text';
import { FORMAT_TEXT_COMMAND, $createParagraphNode, $getRoot } from 'lexical';
import type { LexicalCommand } from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import PanelElecciones from '../components/junta-general/PanelElecciones';
import PageHeader from '../components/ui/PageHeader';

type UploadTipo = 'logo' | 'logo-condominio' | 'firma';

interface PerfilCondominioFormData {
  nombre_legal: string;
  rif: string;
  direccion: string;
  tipo: 'Junta General' | 'Junta Individual' | '';
  junta_general_id: string;
  cuota_participacion: string;
  porcentaje_morosidad: string;
  admin_nombre: string;
  admin_rif: string;
  admin_representante: string;
  admin_telefono: string;
  admin_correo: string;
  logo_url: string;
  logo_condominio_url: string;
  firma_url: string;
  aviso_msg_1: string;
  aviso_msg_2: string;
  aviso_msg_3: string;
  aviso_msg_4: string;
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
  logo_condominio_url?: string | null;
  firma_url?: string | null;
  aviso_msg_1?: string | null;
  aviso_msg_2?: string | null;
  aviso_msg_3?: string | null;
  aviso_msg_4?: string | null;
  tipo?: string | null;
  junta_general_id?: number | null;
  cuota_participacion?: string | number | null;
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
  tipo: '',
  junta_general_id: '',
  cuota_participacion: '',
  porcentaje_morosidad: '',
  admin_nombre: '',
  admin_rif: '',
  admin_representante: '',
  admin_telefono: '',
  admin_correo: '',
  logo_url: '',
  logo_condominio_url: '',
  firma_url: '',
  aviso_msg_1: '',
  aviso_msg_2: '',
  aviso_msg_3: '',
  aviso_msg_4: '',
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

const cardClass = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark';
const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white';
const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
type AvisoMessageField = 'aviso_msg_1' | 'aviso_msg_2' | 'aviso_msg_3' | 'aviso_msg_4';
const editorBtnClass =
  'rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

interface MarkdownEditorFieldProps {
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
}

const MarkdownSyncPlugin: FC<{ value: string }> = ({ value }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let currentMarkdown = '';
    editor.getEditorState().read(() => {
      currentMarkdown = $convertToMarkdownString(TRANSFORMERS);
    });

    if (currentMarkdown === value) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (value.trim()) {
        $convertFromMarkdownString(value, TRANSFORMERS);
      } else {
        root.append($createParagraphNode());
      }
    });
  }, [editor, value]);

  return null;
};

const MarkdownToolbar: FC = () => {
  const [editor] = useLexicalComposerContext();
  const runCommand = <T,>(command: LexicalCommand<T>, payload: T): void => {
    editor.focus();
    editor.dispatchCommand(command, payload);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
      <button type="button" className={editorBtnClass} onClick={() => runCommand(FORMAT_TEXT_COMMAND, 'bold')}>
        B
      </button>
      <button type="button" className={editorBtnClass} onClick={() => runCommand(FORMAT_TEXT_COMMAND, 'italic')}>
        I
      </button>
      <button type="button" className={editorBtnClass} onClick={() => runCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
        S
      </button>
      <button type="button" className={editorBtnClass} onClick={() => runCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
        Viñetas
      </button>
      <button type="button" className={editorBtnClass} onClick={() => runCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
        Lista
      </button>
    </div>
  );
};

const MarkdownEditorField: FC<MarkdownEditorFieldProps> = ({ value, placeholder, onChange }) => {
  const initialConfig = useMemo(
    () => ({
      namespace: 'PerfilCondominioMarkdownEditor',
      theme: {
        text: {
          strikethrough: 'line-through',
        },
      },
      onError: (error: Error) => {
        console.error(error);
      },
      nodes: [ListNode, ListItemNode, QuoteNode],
    }),
    []
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/70">
      <LexicalComposer initialConfig={initialConfig}>
        <MarkdownSyncPlugin value={value} />
        <MarkdownToolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[120px] p-3 text-sm text-gray-900 outline-none dark:text-white [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-0.5" />
            }
            placeholder={<p className="pointer-events-none absolute left-0 top-0 p-3 text-sm text-gray-400">{placeholder}</p>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <ListPlugin />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState) => {
            editorState.read(() => {
              onChange($convertToMarkdownString(TRANSFORMERS));
            });
          }}
        />
      </LexicalComposer>
    </div>
  );
};

const PerfilCondominio: FC = () => {
  const { condominioId: condominioIdParam } = useParams<{ condominioId?: string }>();
  const [form, setForm] = useState<PerfilCondominioFormData>(initialPerfil);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(initialPasswordForm);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [uploading, setUploading] = useState<{ logo: boolean; logoCondominio: boolean; firma: boolean }>({
    logo: false,
    logoCondominio: false,
    firma: false,
  });
  const [deleting, setDeleting] = useState<{ logo: boolean; logoCondominio: boolean }>({
    logo: false,
    logoCondominio: false,
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [codigoInvitacion, setCodigoInvitacion] = useState<string>('');
  const [linkingInvitacion, setLinkingInvitacion] = useState<boolean>(false);

  const token = useMemo<string>(() => localStorage.getItem('habioo_token') || '', []);
  const supportCondominioId = Number.parseInt(String(condominioIdParam || ''), 10);
  const panelCondominioId = Number.isFinite(supportCondominioId) && supportCondominioId > 0
    ? supportCondominioId
    : null;

  useEffect(() => {
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

        const profile = data.data ?? {};
        setForm({
          nombre_legal: String(profile.nombre_legal ?? profile.nombre ?? ''),
          rif: String(profile.rif ?? ''),
          direccion: String(profile.direccion ?? ''),
          tipo: (String(profile.tipo ?? '').trim() === 'Junta General' ? 'Junta General' : 'Junta Individual'),
          junta_general_id: profile.junta_general_id ? String(profile.junta_general_id) : '',
          cuota_participacion: profile.cuota_participacion !== null && profile.cuota_participacion !== undefined
            ? String(profile.cuota_participacion)
            : '',
          porcentaje_morosidad: String(profile.porcentaje_morosidad ?? profile.tasa_interes ?? ''),
          admin_nombre: String(profile.admin_nombre ?? ''),
          admin_rif: String(profile.admin_rif ?? ''),
          admin_representante: String(profile.admin_representante ?? ''),
          admin_telefono: String(profile.admin_telefono ?? ''),
          admin_correo: String(profile.admin_correo ?? ''),
          logo_url: String(profile.logo_url ?? ''),
          logo_condominio_url: String(profile.logo_condominio_url ?? ''),
          firma_url: String(profile.firma_url ?? ''),
          aviso_msg_1: String(profile.aviso_msg_1 ?? ''),
          aviso_msg_2: String(profile.aviso_msg_2 ?? ''),
          aviso_msg_3: String(profile.aviso_msg_3 ?? ''),
          aviso_msg_4: String(profile.aviso_msg_4 ?? ''),
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error al cargar el perfil.';
        setErrorMessage(msg);
      } finally {
        setLoading(false);
      }
    };

    void loadPerfil();
  }, [token]);

  const handleInputChange = (field: keyof PerfilCondominioFormData) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handlePasswordInputChange = (field: keyof PasswordFormData) => (e: ChangeEvent<HTMLInputElement>): void => {
    setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const handleGuardarCambios = async (): Promise<void> => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        nombre: form.nombre_legal.trim(),
        nombre_legal: form.nombre_legal.trim(),
        rif: form.rif.trim(),
        direccion: form.direccion.trim(),
        porcentaje_morosidad: form.porcentaje_morosidad === '' ? null : Number(form.porcentaje_morosidad),
        tipo: form.tipo || null,
        junta_general_id: form.tipo === 'Junta Individual' && form.junta_general_id ? Number(form.junta_general_id) : null,
        cuota_participacion: form.tipo === 'Junta Individual' && form.cuota_participacion !== '' ? Number(form.cuota_participacion) : null,
        admin_nombre: form.admin_nombre.trim(),
        admin_rif: form.admin_rif.trim(),
        admin_representante: form.admin_representante.trim(),
        admin_telefono: form.admin_telefono.trim(),
        admin_correo: form.admin_correo.trim(),
        aviso_msg_1: form.aviso_msg_1,
        aviso_msg_2: form.aviso_msg_2,
        aviso_msg_3: form.aviso_msg_3,
        aviso_msg_4: form.aviso_msg_4,
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

  const handleAceptarInvitacion = async (): Promise<void> => {
    const codigo = codigoInvitacion.trim();
    if (!codigo) {
      setErrorMessage('Debes indicar un código de invitación.');
      return;
    }
    try {
      setLinkingInvitacion(true);
      setErrorMessage('');
      setSuccessMessage('');
      const res = await fetch(`${API_BASE_URL}/juntas-generales/aceptar-invitacion`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codigo_invitacion: codigo }),
      });
      const data: ApiResponse<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.status === 'error' ? data.message : 'No se pudo aceptar el código.');
        return;
      }
      setCodigoInvitacion('');
      setSuccessMessage(data.message || 'Vinculación completada correctamente.');
      const refresh = await fetch(`${API_BASE_URL}/api/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshData: ApiResponse<PerfilCondominioApiData> = await refresh.json();
      if (refresh.ok && refreshData.status === 'success' && refreshData.data) {
        const profile = refreshData.data;
        setForm((prev) => ({
          ...prev,
          tipo: (String(profile.tipo ?? '').trim() === 'Junta General' ? 'Junta General' : 'Junta Individual'),
          junta_general_id: profile.junta_general_id ? String(profile.junta_general_id) : '',
          cuota_participacion: profile.cuota_participacion !== null && profile.cuota_participacion !== undefined
            ? String(profile.cuota_participacion)
            : '',
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al aceptar invitación.';
      setErrorMessage(msg);
    } finally {
      setLinkingInvitacion(false);
    }
  };

  const handleUpload = async (tipo: UploadTipo, file: File): Promise<void> => {
    try {
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
        logo_condominio_url: tipo === 'logo-condominio' ? newUrl : prev.logo_condominio_url,
        firma_url: tipo === 'firma' ? newUrl : prev.firma_url,
      }));
      setSuccessMessage(data.message || 'Imagen actualizada correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir la imagen.';
      setErrorMessage(msg);
    } finally {
      setUploading((prev) => ({
        ...prev,
        logo: tipo === 'logo' ? false : prev.logo,
        logoCondominio: tipo === 'logo-condominio' ? false : prev.logoCondominio,
        firma: tipo === 'firma' ? false : prev.firma,
      }));
    }
  };

  const onUploadChange = (tipo: UploadTipo) => (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading((prev) => ({
      ...prev,
      logo: tipo === 'logo' ? true : prev.logo,
      logoCondominio: tipo === 'logo-condominio' ? true : prev.logoCondominio,
      firma: tipo === 'firma' ? true : prev.firma,
    }));
    void handleUpload(tipo, file);
    e.target.value = '';
  };

  const handleDeleteUpload = async (tipo: 'logo' | 'logo-condominio'): Promise<void> => {
    try {
      setDeleting((prev) => ({
        ...prev,
        logo: tipo === 'logo' ? true : prev.logo,
        logoCondominio: tipo === 'logo-condominio' ? true : prev.logoCondominio,
      }));
      setErrorMessage('');
      setSuccessMessage('');

      const res = await fetch(`${API_BASE_URL}/api/perfil/upload/${tipo}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: ApiResponse<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.status === 'error' ? data.message : 'No se pudo eliminar la imagen.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        logo_url: tipo === 'logo' ? '' : prev.logo_url,
        logo_condominio_url: tipo === 'logo-condominio' ? '' : prev.logo_condominio_url,
      }));
      setSuccessMessage(data.message || 'Imagen eliminada correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar la imagen.';
      setErrorMessage(msg);
    } finally {
      setDeleting((prev) => ({
        ...prev,
        logo: tipo === 'logo' ? false : prev.logo,
        logoCondominio: tipo === 'logo-condominio' ? false : prev.logoCondominio,
      }));
    }
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
      <PageHeader
        title="Perfil y Configuración"
        subtitle="Gestiona los datos del condominio, reglas de cobranza y seguridad."
        actions={(
          <button
            type="button"
            onClick={() => void handleGuardarCambios()}
            disabled={loading || saving}
            className="px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      />

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
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">Datos del Condominio</h2>
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
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <h3 className="mb-3 text-base font-black text-gray-900 dark:text-white">Jerarquía de Junta</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Tipo de Junta</label>
                  <select
                    className={inputClass}
                    value={form.tipo}
                    onChange={(e) => {
                      const nextTipo = (e.target.value === 'Junta General' ? 'Junta General' : 'Junta Individual');
                      setForm((prev) => ({
                        ...prev,
                        tipo: nextTipo,
                        junta_general_id: nextTipo === 'Junta General' ? '' : prev.junta_general_id,
                        cuota_participacion: nextTipo === 'Junta General' ? '' : prev.cuota_participacion,
                      }));
                    }}
                  >
                    <option value="Junta General">Junta General</option>
                    <option value="Junta Individual">Junta Individual</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Junta General Vinculada (ID)</label>
                  <input
                    className={inputClass}
                    value={form.junta_general_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, junta_general_id: e.target.value.replace(/\D/g, '') }))}
                    placeholder="Ej: 2"
                    disabled={form.tipo !== 'Junta Individual'}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cuota de Participación</label>
                  <input
                    className={inputClass}
                    value={form.cuota_participacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, cuota_participacion: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }))}
                    placeholder="Ej: 12.5000"
                    disabled={form.tipo !== 'Junta Individual'}
                  />
                </div>
              </div>
              {form.tipo === 'Junta Individual' && (
                <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Vinculación por código</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className={`${inputClass} flex-1`}
                      value={codigoInvitacion}
                      onChange={(e) => setCodigoInvitacion(e.target.value.trim().toUpperCase())}
                      placeholder="Pega el código de invitación"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAceptarInvitacion()}
                      disabled={linkingInvitacion}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {linkingInvitacion ? 'Vinculando...' : 'Aceptar código'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-700">
              <h3 className="mb-4 text-base font-black text-gray-900 dark:text-white">Identidad Visual del Condominio</h3>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Logo de la Junta de Condominio</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    {uploading.logoCondominio ? 'Subiendo...' : 'Subir Logo Junta'}
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadChange('logo-condominio')} />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDeleteUpload('logo-condominio')}
                    disabled={!form.logo_condominio_url || deleting.logoCondominio}
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting.logoCondominio ? 'Eliminando...' : 'Eliminar Logo'}
                  </button>
                  {form.logo_condominio_url ? (
                    <img
                      src={buildAssetUrl(form.logo_condominio_url)}
                      alt="Logo Junta"
                      className="h-20 w-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700"
                    />
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Sin imagen cargada.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">Empresa Administradora</h2>
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
            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-700">
              <h3 className="mb-4 text-base font-black text-gray-900 dark:text-white">Identidad Visual</h3>
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Logo de la Administradora/Condominio</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                      {uploading.logo ? 'Subiendo...' : 'Subir Logo'}
                      <input type="file" accept="image/*" className="hidden" onChange={onUploadChange('logo')} />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleDeleteUpload('logo')}
                      disabled={!form.logo_url || deleting.logo}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleting.logo ? 'Eliminando...' : 'Eliminar Logo'}
                    </button>
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
            </div>
          </section>

          <section className={`${cardClass} xl:col-span-2`}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">Reglas de Cobranza</h2>
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
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {([
                { key: 'aviso_msg_1', label: 'Mensaje Aviso #1 (Markdown)', placeholder: 'Ej: **Recuerde** mantener su pago al día.' },
                { key: 'aviso_msg_2', label: 'Mensaje Aviso #2 (Markdown)', placeholder: 'Ej: Puede pagar por transferencia o pago móvil.' },
                { key: 'aviso_msg_3', label: 'Mensaje Aviso #3 (Markdown)', placeholder: 'Ej: En caso de dudas, contacte administración.' },
                { key: 'aviso_msg_4', label: 'Mensaje Aviso #4 (Markdown)', placeholder: 'Ej: Gracias por su colaboración.' },
              ] as Array<{ key: AvisoMessageField; label: string; placeholder: string }>).map((item) => (
                <div key={item.key}>
                  <label className={labelClass}>{item.label}</label>
                  <MarkdownEditorField
                    value={form[item.key]}
                    placeholder={item.placeholder}
                    onChange={(val) => setForm((prev) => ({ ...prev, [item.key]: val || '' }))}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400 lg:col-span-2">
                Estos mensajes son exclusivos de este condominio y se usarán como textos predeterminados en avisos de cobro.
              </p>
            </div>
          </section>

          <section className={`${cardClass} xl:col-span-2`}>
            <h2 className="mb-4 text-lg font-black text-gray-900 dark:text-white">Seguridad</h2>
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

          <section className="xl:col-span-2" data-testid="perfil-elecciones-section">
            <PanelElecciones condominioId={panelCondominioId} />
          </section>
        </div>
      )}
    </div>
  );
};

export default PerfilCondominio;
