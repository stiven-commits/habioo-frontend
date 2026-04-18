import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { CheckCircle2, Vote } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ModalBase from '../ui/ModalBase';
import HabiooLoader from '../ui/HabiooLoader';
import { useDialog } from '../ui/DialogProvider';

interface ModalVotacionPropietarioProps {
  condominioId?: number | null;
  propiedadId?: number | null;
  enabled?: boolean;
}

interface DialogOptions {
  title?: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
}

interface DialogContextValue {
  showAlert: (opts?: DialogOptions) => Promise<void>;
}

interface VotacionPostulado {
  postulacion_id: number;
  usuario_id: number;
  usuario_nombre: string | null;
  seleccionado_por_propiedad?: boolean;
}

interface VotacionCargo {
  cargo_id: number;
  nombre: string;
  postulados: VotacionPostulado[];
}

interface EleccionActivaData {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  cargos: VotacionCargo[];
}

interface EleccionActivaResponse {
  status?: string;
  message?: string;
  error?: string;
  data?: {
    eleccion?: EleccionActivaData | null;
    ya_voto_completo?: boolean;
  };
  eleccion?: EleccionActivaData | null;
  ya_voto_completo?: boolean;
}

interface EmitirVotoPayload {
  cargo_id: number;
  postulacion_id: number;
  propiedad_id: number;
}

interface ApiErrorLike {
  message?: string;
  error?: string;
}

interface JwtPayload {
  condominio_id?: number;
  [key: string]: unknown;
}

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part)) as JwtPayload;
  } catch {
    return null;
  }
};

const toPositiveInt = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const formatDateLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const normalizeEleccion = (raw: unknown): EleccionActivaData | null => {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Partial<EleccionActivaData>;
  if (!Number.isFinite(Number(src.id))) return null;

  return {
    id: Number(src.id),
    fecha_inicio: String(src.fecha_inicio || ''),
    fecha_fin: String(src.fecha_fin || ''),
    estado: String(src.estado || ''),
    cargos: Array.isArray(src.cargos)
      ? src.cargos
          .map((cargo) => ({
            cargo_id: Number(cargo?.cargo_id),
            nombre: String(cargo?.nombre || ''),
            postulados: Array.isArray(cargo?.postulados)
              ? cargo.postulados
                  .filter((p) => Number.isFinite(Number(p?.postulacion_id)) && Number.isFinite(Number(p?.usuario_id)))
                  .map((p) => ({
                    postulacion_id: Number(p.postulacion_id),
                    usuario_id: Number(p.usuario_id),
                    usuario_nombre: p.usuario_nombre || null,
                    seleccionado_por_propiedad: Boolean(p.seleccionado_por_propiedad),
                  }))
              : [],
          }))
          .filter((cargo) => Number.isFinite(cargo.cargo_id) && cargo.cargo_id > 0)
      : [],
  };
};

const ModalVotacionPropietario: FC<ModalVotacionPropietarioProps> = ({
  condominioId: condominioIdProp = null,
  propiedadId: propiedadIdProp = null,
  enabled = true,
}) => {
  const { showAlert } = useDialog() as DialogContextValue;

  const token = useMemo(() => localStorage.getItem('habioo_token') || '', []);

  const [condominioId, setCondominioId] = useState<number | null>(toPositiveInt(condominioIdProp));
  const [propiedadId, setPropiedadId] = useState<number | null>(toPositiveInt(propiedadIdProp));
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [eleccion, setEleccion] = useState<EleccionActivaData | null>(null);
  const [votos, setVotos] = useState<Record<number, number>>({});

  useEffect(() => {
    const nextCondominio = toPositiveInt(condominioIdProp)
      ?? toPositiveInt(localStorage.getItem('habioo_condominio_activo_id'))
      ?? toPositiveInt(decodeJwtPayload(token)?.condominio_id);

    const nextPropiedad = toPositiveInt(propiedadIdProp)
      ?? toPositiveInt(localStorage.getItem('habioo_propiedad_activa_id'));

    setCondominioId(nextCondominio);
    setPropiedadId(nextPropiedad);
  }, [condominioIdProp, propiedadIdProp, token]);

  const withAuthHeaders = useCallback((base?: HeadersInit): HeadersInit => ({
    ...(base || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const loadEleccionActiva = useCallback(async (): Promise<void> => {
    if (!enabled || !condominioId || !propiedadId || !token) {
      setOpen(false);
      setEleccion(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/activas/${condominioId}/propiedad/${propiedadId}`, {
        headers: withAuthHeaders(),
      });

      const payload = (await res.json()) as EleccionActivaResponse;
      if (!res.ok) {
        setOpen(false);
        setEleccion(null);
        return;
      }

      const eleccionRaw = payload?.data?.eleccion ?? payload?.eleccion;
      const eleccionActual = normalizeEleccion(eleccionRaw);
      const yaVotoCompleto = Boolean(payload?.data?.ya_voto_completo ?? payload?.ya_voto_completo);

      if (!eleccionActual || yaVotoCompleto || eleccionActual.estado.toLowerCase() !== 'activa') {
        setOpen(false);
        setEleccion(null);
        return;
      }

      const preselecciones: Record<number, number> = {};
      for (const cargo of eleccionActual.cargos) {
        const marcada = cargo.postulados.find((p) => p.seleccionado_por_propiedad);
        if (marcada) preselecciones[cargo.cargo_id] = marcada.postulacion_id;
      }

      setVotos(preselecciones);
      setEleccion(eleccionActual);
      setOpen(true);
    } catch {
      setOpen(false);
      setEleccion(null);
    } finally {
      setLoading(false);
    }
  }, [condominioId, enabled, propiedadId, token, withAuthHeaders]);

  useEffect(() => {
    void loadEleccionActiva();
  }, [loadEleccionActiva]);

  const totalCargos = eleccion?.cargos?.length || 0;
  const totalSeleccionados = Object.keys(votos).length;
  const canSubmit = totalCargos === 6 && totalSeleccionados === 6;

  const handleSelect = (cargoId: number, postulacionId: number): void => {
    if (submitting) return;
    setVotos((prev) => ({ ...prev, [cargoId]: postulacionId }));
  };

  const handleEmitirVotos = async (): Promise<void> => {
    if (!eleccion || !propiedadId) return;

    if (!canSubmit) {
      await showAlert({
        title: 'Votación incompleta',
        message: 'Debes seleccionar un candidato en cada uno de los 6 cargos antes de emitir tus votos.',
        variant: 'warning',
      });
      return;
    }

    const payload: EmitirVotoPayload[] = eleccion.cargos.map((cargo) => ({
      cargo_id: cargo.cargo_id,
      postulacion_id: Number(votos[cargo.cargo_id]),
      propiedad_id: propiedadId,
    }));

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/votar`, {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const result = (await res.json()) as { status?: string; message?: string } & ApiErrorLike;
      if (!res.ok || result.status !== 'success') {
        const msg = result.message || result.error || 'No se pudieron registrar tus votos.';
        throw new Error(msg);
      }

      setOpen(false);
      setEleccion(null);
      setVotos({});
      await showAlert({
        title: 'Votación registrada',
        message: 'Tus 6 votos fueron emitidos exitosamente. Gracias por participar.',
        variant: 'success',
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Error al emitir votos.';
      await showAlert({ title: 'No se pudo votar', message, variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;
  if (loading) return null;
  if (!open || !eleccion) return null;

  const fechaTitulo = formatDateLabel(eleccion.fecha_inicio);

  return (
    <ModalBase
      onClose={() => undefined}
      title={`Elecciones de la Junta de Condominio ${fechaTitulo}`}
      subtitle="Selecciona un candidato por cargo para emitir tus 6 votos."
      maxWidth="5xl"
      disableClose
      closeOnOverlayClick={false}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
          Progreso de votación: <strong>{totalSeleccionados}/6</strong> cargos seleccionados.
        </div>

        {submitting && <HabiooLoader size="sm" message="Registrando tus votos..." className="py-2" />}

        <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
          {eleccion.cargos.map((cargo) => (
            <section key={cargo.cargo_id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <header className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-gray-900 dark:text-white">{cargo.nombre}</h3>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {votos[cargo.cargo_id] ? 'Seleccionado' : 'Pendiente'}
                </span>
              </header>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {cargo.postulados.map((postulado) => {
                  const selected = votos[cargo.cargo_id] === postulado.postulacion_id;
                  return (
                    <button
                      key={postulado.postulacion_id}
                      type="button"
                      onClick={() => handleSelect(cargo.cargo_id, postulado.postulacion_id)}
                      className={`rounded-xl border p-3 text-left transition-all ${selected
                        ? 'border-donezo-primary bg-donezo-primary/10 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-donezo-primary/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-donezo-primary/50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {postulado.usuario_nombre || `Candidato #${postulado.usuario_id}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Postulación #{postulado.postulacion_id}
                          </p>
                        </div>
                        {selected && <CheckCircle2 className="h-5 w-5 text-donezo-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {cargo.postulados.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  No hay candidatos disponibles para este cargo.
                </p>
              )}
            </section>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => void handleEmitirVotos()}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-donezo-primary px-6 py-3 text-sm font-black text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Vote className="h-4 w-4" />
            Emitir mis 6 votos
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

export default ModalVotacionPropietario;
