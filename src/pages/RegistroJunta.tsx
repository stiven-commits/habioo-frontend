import { useEffect, useMemo, useState, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import habiooLogoColor from '../assets/brand/habioo_logo_color.svg';

interface JuntaGeneralOption {
  id: number;
  nombre_junta: string;
  rif_junta?: string | null;
}

interface JuntaGeneralOptionsResponse {
  status: 'success' | 'error';
  data?: JuntaGeneralOption[];
  message?: string;
}

interface CrearCondominioResponse {
  status: 'success' | 'error';
  data?: {
    condominio_id: number;
    admin_user_id: number | null;
    tipo: 'Junta General' | 'Junta Individual';
  };
  message?: string;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '');
const toDecimal = (value: string): number | null => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizeJuntaRif = (value: string): string => {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return '';
  return normalized.startsWith('J') ? normalized : `J${normalized}`;
};
const maskJuntaRif = (value: string): string => {
  const normalized = normalizeJuntaRif(value);
  const digits = normalized.slice(1).replace(/\D/g, '').slice(0, 9);
  return `J${digits}`;
};
const maskAdminDoc = (value: string): string => {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  const first = raw.charAt(0);
  if (/[VEJPG]/.test(first)) {
    return `${first}-${raw.slice(1).replace(/\D/g, '').slice(0, 9)}`;
  }
  return raw.replace(/\D/g, '').slice(0, 12);
};
const maskPhoneVe = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 12);
  if (!digits) return '';
  if (digits.startsWith('58')) {
    const rest = digits.slice(2);
    if (rest.length <= 3) return `+58 ${rest}`;
    if (rest.length <= 6) return `+58 ${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `+58 ${rest.slice(0, 3)}-${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
  }
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
};
const maskCuota = (value: string): string => {
  const cleaned = String(value || '').replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const integerPart = parts[0] ?? '';
  if (parts.length === 1) return integerPart;
  return `${integerPart}.${parts.slice(1).join('').slice(0, 6)}`;
};

const ESTADOS_VENEZUELA: string[] = [
  'Amazonas', 'Anzoategui', 'Apure', 'Aragua', 'Barinas', 'Bolivar', 'Carabobo', 'Cojedes', 'Delta Amacuro',
  'Distrito Capital', 'Falcon', 'Guarico', 'Lara', 'Merida', 'Miranda', 'Monagas', 'Nueva Esparta',
  'Portuguesa', 'Sucre', 'Tachira', 'Trujillo', 'La Guaira', 'Yaracuy', 'Zulia',
];

const RegistroJunta: FC = () => {
  const navigate = useNavigate();
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
  const [juntasGenerales, setJuntasGenerales] = useState<JuntaGeneralOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const juntaGeneralOptions = useMemo(() => juntasGenerales, [juntasGenerales]);

  useEffect(() => {
    const fetchJuntasGenerales = async (): Promise<void> => {
      setIsLoadingOptions(true);
      try {
        const res = await fetch(`${API_BASE_URL}/condominios/juntas-generales-disponibles`);
        const data: JuntaGeneralOptionsResponse = await res.json();
        if (!res.ok || data.status !== 'success') {
          setJuntasGenerales([]);
          return;
        }
        setJuntasGenerales(Array.isArray(data.data) ? data.data : []);
      } catch {
        setJuntasGenerales([]);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    void fetchJuntasGenerales();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!nombreJunta.trim()) {
      setErrorMessage('Debes indicar el nombre de la junta.');
      return;
    }
    if (!rifJunta.trim()) {
      setErrorMessage('Debes indicar el RIF de la junta.');
      return;
    }
    if (!adminNombre.trim() || !adminCedula.trim()) {
      setErrorMessage('Debes indicar el nombre y cédula/RIF de la administradora.');
      return;
    }
    if (tipo === 'Junta Individual' && juntaGeneralId) {
      const cuotaValue = cuotaParticipacion.trim() ? toDecimal(cuotaParticipacion) : null;
      if (cuotaValue === null || cuotaValue < 0) {
        setErrorMessage('La alícuota debe ser un número mayor o igual a cero.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const cuotaValue = cuotaParticipacion.trim() ? toDecimal(cuotaParticipacion) : null;
      const payload = {
        tipo,
        nombre_junta: nombreJunta.trim(),
        rif_junta: normalizeJuntaRif(rifJunta),
        admin_nombre: adminNombre.trim(),
        admin_cedula: adminCedula.trim().toUpperCase(),
        admin_password: adminPassword.trim() || undefined,
        admin_email: adminEmail.trim() || undefined,
        admin_telefono: adminTelefono.trim() || undefined,
        estado_venezuela: estadoVenezuela.trim() || undefined,
        junta_general_id: tipo === 'Junta Individual' && juntaGeneralId ? Number.parseInt(juntaGeneralId, 10) : null,
        cuota_participacion: tipo === 'Junta Individual' && juntaGeneralId ? cuotaValue : null,
      };

      const res = await fetch(`${API_BASE_URL}/condominios/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: CrearCondominioResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        setErrorMessage(data.message || 'No se pudo registrar la junta.');
        return;
      }

      setSuccessMessage('Registro completado. Ya puedes iniciar sesión con la cédula/RIF de administradora.');
      setTimeout(() => navigate('/login'), 1400);
    } catch {
      setErrorMessage('Error de conexión al registrar la junta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-10 px-4">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-emerald-100 bg-white/95 p-6 md:p-8 shadow-[0_20px_80px_-40px_rgba(16,185,129,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <img src={habiooLogoColor} alt="Habioo" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black text-gray-900">Registro de Junta de Condominio</h1>
              <p className="text-sm text-gray-600">Flujo operativo para alta de Junta General o Junta Individual.</p>
            </div>
          </div>
          <Link to="/login" className="text-sm font-semibold text-donezo-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Tipo de junta</label>
                <select
                  value={tipo}
                  onChange={(e) => {
                    const next = e.target.value === 'Junta Individual' ? 'Junta Individual' : 'Junta General';
                    setTipo(next);
                    if (next === 'Junta General') {
                      setJuntaGeneralId('');
                      setCuotaParticipacion('');
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                >
                  <option value="Junta General">Junta General</option>
                  <option value="Junta Individual">Junta Individual</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Estado</label>
                <select
                  value={estadoVenezuela}
                  onChange={(e) => setEstadoVenezuela(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                >
                  {ESTADOS_VENEZUELA.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nombre de la junta</label>
                <input
                  type="text"
                  value={nombreJunta}
                  onChange={(e) => setNombreJunta(e.target.value)}
                  placeholder="Ej: Condominio Torre Norte"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">RIF de la junta</label>
                <input
                  type="text"
                  value={rifJunta}
                  onChange={(e) => setRifJunta(maskJuntaRif(e.target.value))}
                  placeholder="J123456789"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
            </div>

            {tipo === 'Junta Individual' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Junta general vinculada</label>
                  <select
                    value={juntaGeneralId}
                    onChange={(e) => setJuntaGeneralId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                  >
                    <option value="">Sin vinculación a junta general</option>
                    {juntaGeneralOptions.map((jg) => (
                      <option key={jg.id} value={jg.id}>
                        {jg.nombre_junta}{jg.rif_junta ? ` (${jg.rif_junta})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Alícuota (%)</label>
                  <input
                    type="text"
                    value={cuotaParticipacion}
                    onChange={(e) => setCuotaParticipacion(maskCuota(e.target.value))}
                    placeholder="0,0000"
                    disabled={!juntaGeneralId}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-60"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Administradora</h2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nombre</label>
              <input
                type="text"
                value={adminNombre}
                onChange={(e) => setAdminNombre(e.target.value)}
                placeholder="Nombre y apellido"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Cédula / RIF</label>
              <input
                type="text"
                value={adminCedula}
                onChange={(e) => setAdminCedula(maskAdminDoc(e.target.value))}
                placeholder="V-12345678"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Clave de acceso</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Si la dejas vacía, se usa la cédula/RIF"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="correo@dominio.com"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Teléfono</label>
                <input
                  type="text"
                  value={adminTelefono}
                  onChange={(e) => setAdminTelefono(maskPhoneVe(e.target.value))}
                  placeholder="+58 412-000-0000"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
            </div>
          </section>
        </div>

        {isLoadingOptions && tipo === 'Junta Individual' && (
          <p className="mt-4 text-sm text-gray-600">Cargando juntas generales disponibles...</p>
        )}
        {errorMessage && <p className="mt-4 text-sm font-semibold text-red-600">{errorMessage}</p>}
        {successMessage && <p className="mt-4 text-sm font-semibold text-green-700">{successMessage}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-donezo-primary px-6 text-white font-bold hover:bg-green-700 disabled:opacity-70"
          >
            {isSubmitting ? 'Registrando...' : 'Registrar junta'}
          </button>
          <p className="text-xs text-gray-500">
            Al finalizar, inicia sesión con la cédula/RIF y clave de la administradora.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistroJunta;
