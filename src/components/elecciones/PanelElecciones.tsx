import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { CalendarClock, CheckCircle2, Eye, PlusCircle, Trash2, UserPlus, Users, Vote } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ModalBase from '../ui/ModalBase';
import HabiooLoader from '../ui/HabiooLoader';
import FormField, { inputClass } from '../ui/FormField';
import SearchableCombobox, { type SearchableComboboxOption } from '../ui/SearchableCombobox';
import { useDialog } from '../ui/DialogProvider';
import DateRangePicker from '../ui/DateRangePicker';

interface PanelEleccionesProps {
  condominioId?: number | null;
  className?: string;
}

interface JwtPayload {
  condominio_id?: number;
  [key: string]: unknown;
}

interface DialogOptions {
  title?: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
}

interface DialogContextValue {
  showAlert: (opts?: DialogOptions) => Promise<void>;
}

interface PropietarioExistente {
  id: number;
  cedula: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

interface CargoPostulado {
  postulacion_id: number;
  usuario_id: number;
  usuario_nombre: string | null;
  total_votos?: number;
}

interface EleccionCargo {
  cargo_id: number;
  nombre: string;
  postulados: CargoPostulado[];
  voto_postulacion_id?: number | null;
}

interface EleccionData {
  id: number;
  condominio_id?: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  cargos: EleccionCargo[];
  total_votos_emitidos?: number;
  inmuebles_totales?: number;
  inmuebles_con_voto?: number;
}

interface HistorialEleccionItem {
  id: number;
  eleccion_id: number;
  condominio_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  anio: number;
  total_votos_emitidos: number;
  inmuebles_totales: number;
  inmuebles_con_voto: number;
  participacion_pct: number;
  created_at: string;
}

interface HistorialDetalleResponse {
  id: number;
  eleccion_id: number;
  condominio_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  anio: number;
  total_votos_emitidos: number;
  inmuebles_totales: number;
  inmuebles_con_voto: number;
  participacion_pct: number;
  created_at: string;
  snapshot_json?: {
    cargos?: Array<{
      cargo_id?: number;
      nombre?: string;
      postulados?: Array<{
        postulacion_id?: number;
        usuario_id?: number;
        usuario_nombre?: string | null;
        total_votos?: number;
      }>;
    }>;
  };
}

interface ApiErrorLike {
  message?: string;
  error?: string;
}

interface EleccionActualResponse {
  status?: string;
  data?: {
    eleccion?: EleccionData | null;
    ya_voto_completo?: boolean;
    hay_eleccion_activa?: boolean;
  };
  eleccion?: EleccionData | null;
}

interface HistorialResponse {
  status?: string;
  data?: {
    historial?: HistorialEleccionItem[];
  };
}

interface PropiedadesAdminResponse {
  status?: string;
  propiedades?: Array<{ id?: number }>;
}

const CARGOS_POR_DEFECTO = [
  'Presidente',
  'Vicepresidente',
  'Tesorero',
  'Secretario',
  'Vocal 1',
  'Vocal 2',
] as const;

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeEleccion = (raw: Partial<EleccionData> | null | undefined): EleccionData | null => {
  if (!raw || !raw.id) return null;
  return {
    id: raw.id,
    condominio_id: raw.condominio_id,
    fecha_inicio: String(raw.fecha_inicio || ''),
    fecha_fin: String(raw.fecha_fin || ''),
    estado: String(raw.estado || ''),
    cargos: Array.isArray(raw.cargos)
      ? raw.cargos.map((cargo) => ({
          cargo_id: Number(cargo?.cargo_id),
          nombre: String(cargo?.nombre || ''),
          voto_postulacion_id: cargo?.voto_postulacion_id ?? null,
          postulados: Array.isArray(cargo?.postulados)
            ? cargo.postulados
                .filter((p) => Number.isFinite(Number(p?.usuario_id)) && Number.isFinite(Number(p?.postulacion_id)))
                .map((p) => ({
                  postulacion_id: Number(p.postulacion_id),
                  usuario_id: Number(p.usuario_id),
                  usuario_nombre: p.usuario_nombre || null,
                  total_votos: Number.isFinite(Number(p.total_votos)) ? Number(p.total_votos) : 0,
                }))
            : [],
        }))
      : [],
    total_votos_emitidos: raw.total_votos_emitidos,
    inmuebles_totales: raw.inmuebles_totales,
    inmuebles_con_voto: raw.inmuebles_con_voto,
  };
};

const toRangeBoundaryIso = (date: Date, mode: 'start' | 'end'): string => {
  const next = new Date(date);
  const now = new Date();
  const targetHours = now.getHours();
  const targetMinutes = now.getMinutes();

  if (mode === 'start') {
    next.setHours(targetHours, targetMinutes, 0, 0);
  } else {
    // Cierre a la misma hora de inicio (misma hora/minuto del momento de creación).
    next.setHours(targetHours, targetMinutes, 59, 999);
  }
  return next.toISOString();
};

const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const PanelElecciones: FC<PanelEleccionesProps> = ({ condominioId: condominioIdProp = null, className = '' }) => {
  const { showAlert } = useDialog() as DialogContextValue;

  const [condominioId, setCondominioId] = useState<number | null>(toPositiveInt(condominioIdProp));
  const [eleccion, setEleccion] = useState<EleccionData | null>(null);
  const [hayEleccionActiva, setHayEleccionActiva] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [fechaRange, setFechaRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });

  const [postularCargoId, setPostularCargoId] = useState<number | null>(null);
  const [propietarios, setPropietarios] = useState<PropietarioExistente[]>([]);
  const [selectedPropietarioId, setSelectedPropietarioId] = useState<string>('');
  const [loadingPropietarios, setLoadingPropietarios] = useState<boolean>(false);
  const [historial, setHistorial] = useState<HistorialEleccionItem[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState<boolean>(false);
  const [detalleHistorial, setDetalleHistorial] = useState<HistorialDetalleResponse | null>(null);
  const [detalleModalOpen, setDetalleModalOpen] = useState<boolean>(false);
  const [loadingDetalleHistorial, setLoadingDetalleHistorial] = useState<boolean>(false);

  const token = useMemo(() => localStorage.getItem('habioo_token') || '', []);
  const minElectionDate = useMemo(() => startOfToday(), []);
  const draftStorageKey = useMemo(() => `habioo_eleccion_draft_${condominioId || 0}`, [condominioId]);

  useEffect(() => {
    if (condominioIdProp) {
      setCondominioId(toPositiveInt(condominioIdProp));
      return;
    }

    const payload = decodeJwtPayload(token);
    setCondominioId(toPositiveInt(payload?.condominio_id));
  }, [condominioIdProp, token]);

  const withAuthHeaders = useCallback((base?: HeadersInit): HeadersInit => ({
    ...(base || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const loadOwners = useCallback(async (): Promise<void> => {
    setLoadingPropietarios(true);
    try {
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/propietarios-existentes`, {
        headers: withAuthHeaders(),
      });
      const payload = (await res.json()) as {
        status?: string;
        propietarios?: PropietarioExistente[];
      };

      if (!res.ok || payload.status !== 'success') {
        throw new Error('No se pudo cargar la lista de propietarios.');
      }

      const list = Array.isArray(payload.propietarios)
        ? payload.propietarios
            .filter((p) => Number.isFinite(Number(p?.id)))
            .map((p) => ({
              id: Number(p.id),
              cedula: String(p.cedula || ''),
              nombre: String(p.nombre || ''),
              email: p.email || null,
              telefono: p.telefono || null,
            }))
        : [];

      setPropietarios(list);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Error al cargar propietarios.';
      await showAlert({ title: 'Sin propietarios', message, variant: 'warning' });
    } finally {
      setLoadingPropietarios(false);
    }
  }, [showAlert, withAuthHeaders]);

  const parseEleccionFromActualResponse = (raw: unknown): EleccionData | null => {
    const payload = (raw || {}) as EleccionActualResponse;
    const nested = normalizeEleccion(payload?.data?.eleccion);
    if (nested) return nested;
    return normalizeEleccion(payload?.eleccion);
  };

  const parseHayEleccionActiva = (raw: unknown, eleccionActual: EleccionData | null): boolean => {
    const payload = (raw || {}) as EleccionActualResponse;
    if (typeof payload?.data?.hay_eleccion_activa === 'boolean') {
      return payload.data.hay_eleccion_activa;
    }
    return String(eleccionActual?.estado || '').toLowerCase() === 'activa';
  };

  const fetchHistorial = useCallback(async (): Promise<void> => {
    if (!condominioId || !token) return;

    setLoadingHistorial(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/condominio/${condominioId}/historial`, {
        headers: withAuthHeaders(),
      });

      const payload = (await res.json()) as HistorialResponse & ApiErrorLike;
      if (!res.ok || payload.status !== 'success') {
        throw new Error(payload.message || payload.error || 'No se pudo cargar historial de elecciones.');
      }

      const list = Array.isArray(payload.data?.historial)
        ? payload.data?.historial.map((row) => ({
            ...row,
            total_votos_emitidos: Number(row.total_votos_emitidos || 0),
            inmuebles_totales: Number(row.inmuebles_totales || 0),
            inmuebles_con_voto: Number(row.inmuebles_con_voto || 0),
            participacion_pct: Number(row.participacion_pct || 0),
          }))
        : [];

      setHistorial(list);
    } catch {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, [condominioId, token, withAuthHeaders]);

  const fetchEleccionActual = useCallback(async (): Promise<void> => {
    if (!condominioId || !token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let eleccionActual: EleccionData | null = null;

      const resActual = await fetch(`${API_BASE_URL}/elecciones/condominio/${condominioId}/actual`, {
        headers: withAuthHeaders(),
      });

      if (resActual.ok) {
        const payload = await resActual.json();
        eleccionActual = parseEleccionFromActualResponse(payload);
        setHayEleccionActiva(parseHayEleccionActiva(payload, eleccionActual));
      } else {
        const propsRes = await fetch(`${API_BASE_URL}/propiedades-admin`, { headers: withAuthHeaders() });
        if (propsRes.ok) {
          const propsPayload = (await propsRes.json()) as PropiedadesAdminResponse;
          const propiedadId = toPositiveInt(propsPayload?.propiedades?.[0]?.id);
          if (propiedadId) {
            const activeRes = await fetch(`${API_BASE_URL}/elecciones/activas/${condominioId}/propiedad/${propiedadId}`, {
              headers: withAuthHeaders(),
            });
            if (activeRes.ok) {
              const activePayload = await activeRes.json();
              eleccionActual = parseEleccionFromActualResponse(activePayload);
              setHayEleccionActiva(parseHayEleccionActiva(activePayload, eleccionActual));
            }
          }
        }
      }

      if (eleccionActual?.estado === 'Activa') {
        localStorage.removeItem(draftStorageKey);
      }

      setEleccion(eleccionActual);
      if (!eleccionActual) {
        setHayEleccionActiva(false);
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'No se pudo cargar el panel electoral.';
      setError(message);
      setHayEleccionActiva(false);
    } finally {
      setLoading(false);
    }
  }, [condominioId, draftStorageKey, token, withAuthHeaders]);

  useEffect(() => {
    void fetchEleccionActual();
  }, [fetchEleccionActual]);

  useEffect(() => {
    void fetchHistorial();
  }, [fetchHistorial]);

  const selectedCargo = useMemo(
    () => eleccion?.cargos?.find((cargo) => cargo.cargo_id === postularCargoId) || null,
    [eleccion, postularCargoId],
  );

  const propietariosOptions = useMemo<SearchableComboboxOption[]>(() => {
    const usuarioIdsPostuladosEnCargo = new Set(
      (selectedCargo?.postulados || []).map((p) => Number(p.usuario_id)),
    );

    return propietarios
      .filter((p) => !usuarioIdsPostuladosEnCargo.has(Number(p.id)))
      .map((p) => ({
        value: String(p.id),
        label: `${p.nombre || 'Sin nombre'} · ${p.cedula || 'Sin cédula'}`,
        searchText: `${p.email || ''} ${p.telefono || ''}`,
      }));
  }, [propietarios, selectedCargo]);

  const handleOpenPostular = async (cargoId: number): Promise<void> => {
    setPostularCargoId(cargoId);
    setSelectedPropietarioId('');
    if (propietarios.length === 0) {
      await loadOwners();
    }
  };

  const handleCrearEleccion = async (): Promise<void> => {
    if (!condominioId) {
      await showAlert({ title: 'Sin condominio', message: 'No se detectó condominio activo en la sesión.', variant: 'warning' });
      return;
    }

    if (hayEleccionActiva) {
      await showAlert({
        title: 'Elección activa en curso',
        message: 'Ya existe una elección activa. No se puede iniciar otra en paralelo.',
        variant: 'warning',
      });
      return;
    }

    if (!fechaRange.from || !fechaRange.to) {
      await showAlert({ title: 'Fechas requeridas', message: 'Debes indicar la fecha de inicio y de fin.', variant: 'warning' });
      return;
    }

    if (fechaRange.to < fechaRange.from) {
      await showAlert({ title: 'Rango inválido', message: 'La fecha de fin debe ser posterior a la fecha de inicio.', variant: 'warning' });
      return;
    }

    const fechaInicio = toRangeBoundaryIso(fechaRange.from, 'start');
    const fechaFin = toRangeBoundaryIso(fechaRange.to, 'end');

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones`, {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          condominio_id: condominioId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        }),
      });

      const payload = (await res.json()) as {
        status?: string;
        message?: string;
        data?: { eleccion_id?: number };
      } & ApiErrorLike;

      if (!res.ok || payload.status !== 'success') {
        const message = payload.message || payload.error || 'No se pudo crear la elección.';
        throw new Error(message);
      }

      const eleccionId = toPositiveInt(payload?.data?.eleccion_id);
      if (!eleccionId) {
        throw new Error('El backend no devolvió el id de la elección creada.');
      }

      setCreateModalOpen(false);
      setFechaRange({ from: null, to: null });
      await fetchEleccionActual();

      await showAlert({ title: 'Proceso iniciado', message: 'La elección quedó en borrador con sus 6 cargos.', variant: 'success' });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Error al crear elección.';
      await showAlert({ title: 'No se pudo crear', message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handlePostularPropietario = async (): Promise<void> => {
    if (!postularCargoId || !selectedCargo) return;

    const usuarioId = toPositiveInt(selectedPropietarioId);
    if (!usuarioId) {
      await showAlert({ title: 'Selecciona un propietario', message: 'Debes seleccionar a quién deseas postular.', variant: 'warning' });
      return;
    }

    if (selectedCargo.postulados.length >= 3) {
      await showAlert({ title: 'Límite alcanzado', message: 'Máximo 3 postulados permitidos.', variant: 'warning' });
      return;
    }

    if (selectedCargo.postulados.some((p) => Number(p.usuario_id) === usuarioId)) {
      await showAlert({ title: 'Ya postulado', message: 'Ese propietario ya está postulado en este cargo.', variant: 'warning' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/cargos/${postularCargoId}/postular`, {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ usuario_id: usuarioId }),
      });

      const payload = (await res.json()) as {
        status?: string;
        data?: { postulacion_id?: number };
        message?: string;
      } & ApiErrorLike;

      if (!res.ok || payload.status !== 'success') {
        const message = payload.message || payload.error || 'No se pudo registrar la postulación.';
        throw new Error(message);
      }

      const propietario = propietarios.find((p) => p.id === usuarioId);
      const newPostulacionId = toPositiveInt(payload?.data?.postulacion_id) || Date.now();

      setEleccion((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          cargos: prev.cargos.map((cargo) => {
            if (cargo.cargo_id !== postularCargoId) return cargo;
            return {
              ...cargo,
              postulados: [
                ...cargo.postulados,
                {
                  postulacion_id: newPostulacionId,
                  usuario_id: usuarioId,
                  usuario_nombre: propietario?.nombre || null,
                },
              ],
            };
          }),
        };

        if (next.estado === 'Borrador') {
          localStorage.setItem(draftStorageKey, JSON.stringify(next));
        }
        return next;
      });

      setPostularCargoId(null);
      setSelectedPropietarioId('');
      await showAlert({ title: 'Postulación agregada', message: 'El propietario fue postulado exitosamente.', variant: 'success' });
    } catch (postError) {
      const message = postError instanceof Error ? postError.message : 'Error al postular propietario.';
      await showAlert({ title: 'No se pudo postular', message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleActivarEleccion = async (): Promise<void> => {
    if (!eleccion?.id) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/${eleccion.id}/activar`, {
        method: 'PUT',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
      });

      const payload = (await res.json()) as { status?: string; message?: string } & ApiErrorLike;
      if (!res.ok || payload.status !== 'success') {
        const message = payload.message || payload.error || 'No se pudo activar la elección.';
        throw new Error(message);
      }

      localStorage.removeItem(draftStorageKey);
      setEleccion((prev) => (prev ? { ...prev, estado: 'Activa' } : prev));
      await showAlert({ title: 'Elección activa', message: 'Las votaciones están oficialmente abiertas.', variant: 'success' });
      await fetchEleccionActual();
    } catch (activateError) {
      const message = activateError instanceof Error ? activateError.message : 'Error al activar elección.';
      await showAlert({ title: 'No se pudo activar', message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleEliminarElecciones = async (): Promise<void> => {
    if (!condominioId) {
      await showAlert({ title: 'Sin condominio', message: 'No se detectó condominio activo.', variant: 'warning' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/condominio/${condominioId}`, {
        method: 'DELETE',
        headers: withAuthHeaders(),
      });

      const payload = (await res.json()) as { status?: string; message?: string } & ApiErrorLike;
      if (!res.ok || payload.status !== 'success') {
        const message = payload.message || payload.error || 'No se pudo eliminar la información electoral.';
        throw new Error(message);
      }

      localStorage.removeItem(draftStorageKey);
      setEleccion(null);
      setDeleteModalOpen(false);

      await showAlert({
        title: 'Elecciones eliminadas',
        message: 'Se eliminó toda la data de elecciones, postulaciones y votos del condominio.',
        variant: 'success',
      });
      await fetchHistorial();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Error al eliminar elecciones.';
      await showAlert({ title: 'No se pudo eliminar', message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDetalleHistorial = async (snapshotId: number): Promise<void> => {
    setLoadingDetalleHistorial(true);
    try {
      const res = await fetch(`${API_BASE_URL}/elecciones/historial/${snapshotId}`, {
        headers: withAuthHeaders(),
      });

      const payload = (await res.json()) as {
        status?: string;
        data?: { detalle?: HistorialDetalleResponse };
        message?: string;
      } & ApiErrorLike;

      if (!res.ok || payload.status !== 'success' || !payload.data?.detalle) {
        throw new Error(payload.message || payload.error || 'No se pudo cargar el detalle del historial.');
      }

      setDetalleHistorial(payload.data.detalle);
      setDetalleModalOpen(true);
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : 'Error al cargar detalle.';
      await showAlert({ title: 'Sin detalle', message, variant: 'warning' });
    } finally {
      setLoadingDetalleHistorial(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark ${className}`}>
        <HabiooLoader size="md" message="Cargando panel electoral..." />
      </div>
    );
  }

  const isDraft = String(eleccion?.estado || '').toLowerCase() === 'borrador';
  const isActiva = String(eleccion?.estado || '').toLowerCase() === 'activa';
  const inmueblesTotales = Number.isFinite(Number(eleccion?.inmuebles_totales)) ? Number(eleccion?.inmuebles_totales) : 0;
  const inmueblesConVoto = Number.isFinite(Number(eleccion?.inmuebles_con_voto)) ? Number(eleccion?.inmuebles_con_voto) : 0;
  const participacionPct = inmueblesTotales > 0 ? Math.round((inmueblesConVoto / inmueblesTotales) * 100) : 0;

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white">
            <Vote className="h-5 w-5 text-donezo-primary" />
            Panel Electoral
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Administra candidaturas y activa el proceso de votación.
          </p>
        </div>
        {eleccion && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${isActiva ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'}`}>
              {isActiva ? 'Elección Activa' : 'Elección en Borrador'}
            </span>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar elecciones
            </button>
          </div>
        )}
      </div>

      {Boolean(error) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!eleccion && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-donezo-primary/10 text-donezo-primary">
            <Vote className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sin elecciones registradas</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            Aún no hay un proceso electoral activo para este condominio. Crea uno nuevo para comenzar con las postulaciones.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            disabled={busy || hayEleccionActiva}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-donezo-primary px-6 py-3 text-sm font-black text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            {hayEleccionActiva ? 'Ya existe elección activa' : 'Iniciar Nuevo Proceso Electoral'}
          </button>
        </div>
      )}

      {isDraft && eleccion && (
        <>
          <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            Elección en borrador del <strong>{formatDateLabel(eleccion.fecha_inicio)}</strong> al <strong>{formatDateLabel(eleccion.fecha_fin)}</strong>.
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {eleccion.cargos.map((cargo) => {
              const maxPostulados = cargo.postulados.length >= 3;
              return (
                <article key={cargo.cargo_id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{cargo.nombre}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {cargo.postulados.length}/3
                    </span>
                  </div>

                  <ul className="mb-3 space-y-2">
                    {cargo.postulados.length === 0 && (
                      <li className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                        Sin postulados aún.
                      </li>
                    )}
                    {cargo.postulados.map((p) => (
                      <li key={p.postulacion_id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {p.usuario_nombre || `Usuario #${p.usuario_id}`}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => void handleOpenPostular(cargo.cargo_id)}
                    disabled={maxPostulados || busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-donezo-primary/30 px-3 py-2 text-sm font-bold text-donezo-primary transition hover:bg-donezo-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserPlus className="h-4 w-4" />
                    {maxPostulados ? 'Máximo de postulados alcanzado' : '+ Postular Propietario'}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleActivarEleccion()}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-5 w-5" />
              Activar Elección
            </button>
          </div>
        </>
      )}

      {isActiva && eleccion && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-900/20">
          <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="text-lg font-black">Votaciones Abiertas</h3>
          </div>

          <p className="text-sm text-emerald-800/90 dark:text-emerald-100/90">
            La elección está activa. Este panel queda en modo de solo lectura mientras los propietarios emiten sus votos.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/80 p-3 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">Inicio</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatDateLabel(eleccion.fecha_inicio)}</p>
            </div>
            <div className="rounded-xl bg-white/80 p-3 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">Cierre</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatDateLabel(eleccion.fecha_fin)}</p>
            </div>
            <div className="rounded-xl bg-white/80 p-3 dark:bg-black/20">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">
                <Users className="h-3 w-3" />
                Votos Emitidos
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {Number.isFinite(Number(eleccion.total_votos_emitidos)) ? Number(eleccion.total_votos_emitidos) : 'No disponible'}
              </p>
            </div>
            <div className="rounded-xl bg-white/80 p-3 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">Participación</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {inmueblesConVoto} de {inmueblesTotales} inmuebles
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">{participacionPct}%</p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
              KPI por cargo y candidato
            </h4>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {eleccion.cargos.map((cargo) => {
                const postuladosOrdenados = [...cargo.postulados].sort(
                  (a, b) => (Number(b.total_votos || 0) - Number(a.total_votos || 0)),
                );
                const votosCargo = postuladosOrdenados.reduce((acc, p) => acc + Number(p.total_votos || 0), 0);

                return (
                  <article key={cargo.cargo_id} className="rounded-xl border border-emerald-200/70 bg-white/85 p-4 dark:border-emerald-900/40 dark:bg-black/20">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h5 className="text-sm font-black text-gray-900 dark:text-white">{cargo.nombre}</h5>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {votosCargo} votos
                      </span>
                    </div>

                    <div className="space-y-2">
                      {postuladosOrdenados.length === 0 && (
                        <p className="rounded-lg border border-dashed border-emerald-200 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-200">
                          Sin candidatos postulados.
                        </p>
                      )}

                      {postuladosOrdenados.map((postulado) => {
                        const votos = Number(postulado.total_votos || 0);
                        const porcentaje = votosCargo > 0 ? Math.round((votos / votosCargo) * 100) : 0;

                        return (
                          <div key={postulado.postulacion_id} className="rounded-lg border border-gray-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/60">
                            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-200">
                                {postulado.usuario_nombre || `Usuario #${postulado.usuario_id}`}
                              </span>
                              <span className="font-black text-emerald-700 dark:text-emerald-200">
                                {votos} ({porcentaje}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          <h3 className="text-sm font-black uppercase tracking-wide text-gray-700 dark:text-gray-200">Historial de votaciones</h3>
        </div>

        {loadingHistorial ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando historial...</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aún no hay elecciones realizadas en el sistema</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-2 py-2">Rango</th>
                  <th className="px-2 py-2">Año</th>
                  <th className="px-2 py-2">Participación</th>
                  <th className="px-2 py-2">Votos</th>
                  <th className="px-2 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                    <td className="px-2 py-2 text-gray-700 dark:text-gray-200">
                      {formatDateLabel(item.fecha_inicio)} - {item.fecha_fin ? formatDateLabel(item.fecha_fin) : 'Sin fecha fin'}
                    </td>
                    <td className="px-2 py-2 text-gray-700 dark:text-gray-200">{item.anio}</td>
                    <td className="px-2 py-2 text-gray-700 dark:text-gray-200">
                      {item.inmuebles_con_voto} de {item.inmuebles_totales} ({Math.round(Number(item.participacion_pct || 0))}%)
                    </td>
                    <td className="px-2 py-2 text-gray-700 dark:text-gray-200">{item.total_votos_emitidos}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void handleOpenDetalleHistorial(item.id)}
                        disabled={loadingDetalleHistorial || busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createModalOpen && (
        <ModalBase
          onClose={() => !busy && setCreateModalOpen(false)}
          title="Iniciar Nuevo Proceso Electoral"
          subtitle="Elige desde qué día comienzan las votaciones y hasta qué día estarán abiertas. El cierre se hará automáticamente a la misma hora en la que estás creando este proceso."
          maxWidth="md"
          disableClose={busy}
        >
          <div className="space-y-4">
            <FormField label="Rango de fechas" required>
              <DateRangePicker
                from={fechaRange.from}
                to={fechaRange.to}
                onChange={setFechaRange}
                minDate={minElectionDate}
                placeholderText="Selecciona inicio y cierre de votación"
                className={inputClass}
                wrapperClassName="w-full"
              />
            </FormField>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ejemplo: si lo creas hoy a las 3:30 p. m., finalizará el día de cierre elegido a las 3:30 p. m.
            </p>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => setCreateModalOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-donezo-primary px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-60"
                onClick={() => void handleCrearEleccion()}
                disabled={busy}
              >
                {busy ? 'Creando...' : 'Crear Elección'}
              </button>
            </div>
          </div>
        </ModalBase>
      )}

      {postularCargoId && selectedCargo && (
        <ModalBase
          onClose={() => !busy && setPostularCargoId(null)}
          title={`Postular en ${selectedCargo.nombre}`}
          subtitle="Selecciona un propietario para añadirlo como candidato."
          maxWidth="md"
          disableClose={busy}
        >
          <div className="space-y-4">
            <FormField label="Propietario" required>
              <SearchableCombobox
                options={propietariosOptions}
                value={selectedPropietarioId}
                onChange={setSelectedPropietarioId}
                placeholder={loadingPropietarios ? 'Cargando propietarios...' : 'Buscar por nombre o cédula'}
                disabled={loadingPropietarios || busy}
                className={inputClass}
                emptyMessage="No se encontraron propietarios"
              />
            </FormField>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Cupos usados: <strong>{selectedCargo.postulados.length}/3</strong>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => setPostularCargoId(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-donezo-primary px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-60"
                onClick={() => void handlePostularPropietario()}
                disabled={busy || loadingPropietarios || !selectedPropietarioId || selectedCargo.postulados.length >= 3}
              >
                {busy ? 'Guardando...' : 'Confirmar Postulación'}
              </button>
            </div>
          </div>
        </ModalBase>
      )}

      {deleteModalOpen && (
        <ModalBase
          onClose={() => !busy && setDeleteModalOpen(false)}
          title="Eliminar elecciones"
          subtitle="Esta acción eliminará elecciones, cargos, postulaciones y votos de este condominio."
          maxWidth="md"
          disableClose={busy}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
              Esta acción es irreversible. Solo continúa si estás seguro.
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => setDeleteModalOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                onClick={() => void handleEliminarElecciones()}
                disabled={busy}
              >
                {busy ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </ModalBase>
      )}

      {detalleModalOpen && detalleHistorial && (
        <ModalBase
          onClose={() => !loadingDetalleHistorial && setDetalleModalOpen(false)}
          title={`Resultados elección ${detalleHistorial.anio}`}
          subtitle={`${formatDateLabel(detalleHistorial.fecha_inicio)} - ${detalleHistorial.fecha_fin ? formatDateLabel(detalleHistorial.fecha_fin) : 'Sin fecha fin'}`}
          maxWidth="xl"
          disableClose={loadingDetalleHistorial}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Votos emitidos</p>
                <p className="font-black text-gray-900 dark:text-white">{detalleHistorial.total_votos_emitidos}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Participación</p>
                <p className="font-black text-gray-900 dark:text-white">
                  {detalleHistorial.inmuebles_con_voto} de {detalleHistorial.inmuebles_totales}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Porcentaje</p>
                <p className="font-black text-gray-900 dark:text-white">{Math.round(Number(detalleHistorial.participacion_pct || 0))}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {detalleHistorial.snapshot_json?.cargos?.map((cargo, idx) => {
                const postulados = Array.isArray(cargo.postulados)
                  ? [...cargo.postulados].sort((a, b) => Number(b.total_votos || 0) - Number(a.total_votos || 0))
                  : [];
                const totalCargo = postulados.reduce((acc, p) => acc + Number(p.total_votos || 0), 0);

                return (
                  <div key={`${cargo.cargo_id || idx}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <h4 className="mb-2 text-sm font-black text-gray-900 dark:text-white">{cargo.nombre || 'Cargo'}</h4>
                    <div className="space-y-2">
                      {postulados.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sin postulados registrados en snapshot.</p>
                      )}
                      {postulados.map((p) => {
                        const votos = Number(p.total_votos || 0);
                        const pct = totalCargo > 0 ? Math.round((votos / totalCargo) * 100) : 0;
                        return (
                          <div key={String(p.postulacion_id || p.usuario_id || votos)} className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-200">
                                {p.usuario_nombre || `Usuario #${p.usuario_id || 'N/A'}`}
                              </span>
                              <span className="font-black text-gray-900 dark:text-white">
                                {votos} ({pct}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ModalBase>
      )}
    </section>
  );
};

export default PanelElecciones;
