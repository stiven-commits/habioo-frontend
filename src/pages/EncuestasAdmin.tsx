import { useState, useEffect, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEncuesta = 'SI_NO' | 'MULTIPLE' | 'ABIERTA';

interface EncuestaForm {
  titulo: string;
  descripcion: string;
  tipo: TipoEncuesta;
  fecha_fin: string;
  opciones: string[];
}

interface Opcion {
  id: number;
  encuesta_id: number;
  texto: string;
}

interface Encuesta {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: TipoEncuesta;
  fecha_fin: string;
  created_at: string;
  opciones: Opcion[];
  ya_voto: boolean;
  total_votos: number;
}

interface ConteoPorOpcion {
  opcion_id: number | null;
  opcion_texto: string | null;
  total: number;
}

interface VotoDetalle {
  opcion_id: number | null;
  opcion_texto: string | null;
  respuesta_texto: string | null;
  user_nombre: string;
  propiedad_identificador: string;
}

interface EncuestaResumen {
  id: number;
  titulo: string;
  tipo: TipoEncuesta;
}

interface ResultadosData {
  encuesta: EncuestaResumen;
  conteo: ConteoPorOpcion[];
  detalle: VotoDetalle[];
}

interface JwtPayload {
  id: number;
  condominio_id?: number;
  is_admin?: boolean;
  [key: string]: unknown;
}

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface DialogContextValue {
  showAlert: (opts: { title: string; message: string; variant: DialogVariant }) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part)) as JwtPayload;
  } catch {
    return null;
  }
};

const formatFechaFin = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const isClosed = (fecha_fin: string): boolean => new Date() > new Date(fecha_fin);

const TIPO_META: Record<TipoEncuesta, { label: string; color: string; badge: string; hint: string }> = {
  SI_NO: {
    label: 'Sí / No',
    color: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    hint: 'Dos opciones fijas: "Sí" y "No". Ideal para aprobaciones o consultas binarias.',
  },
  MULTIPLE: {
    label: 'Opción Múltiple',
    color: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    hint: 'Define las opciones tú mismo. El propietario elige una sola. Ideal para seleccionar fechas, proveedores o alternativas.',
  },
  ABIERTA: {
    label: 'Respuesta Abierta',
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    hint: 'El propietario escribe libremente su respuesta. Ideal para recolectar opiniones, sugerencias o comentarios.',
  },
};

const FORM_INITIAL: EncuestaForm = {
  titulo: '',
  descripcion: '',
  tipo: 'SI_NO',
  fecha_fin: '',
  opciones: ['', ''],
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

const BarraProgreso: FC<{ conteo: ConteoPorOpcion[]; totalVotos: number }> = ({ conteo, totalVotos }) => (
  <div className="space-y-2 mt-3">
    {conteo.map((c, i) => {
      const pct = totalVotos > 0 ? Math.round((c.total / totalVotos) * 100) : 0;
      return (
        <div key={i}>
          <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            <span>{c.opcion_texto ?? 'Respuesta abierta'}</span>
            <span>{c.total} voto{c.total !== 1 ? 's' : ''} · {pct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-donezo-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    })}
    {conteo.length === 0 && (
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Sin votos aún.</p>
    )}
  </div>
);

const TablaDetalleAdmin: FC<{ detalle: VotoDetalle[]; tipo: TipoEncuesta }> = ({ detalle, tipo }) => {
  if (detalle.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Ningún propietario ha votado todavía.</p>;
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left text-sm border-collapse min-w-[560px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <th className="py-2 px-3 font-bold">Apto / Inmueble</th>
            <th className="py-2 px-3 font-bold">Votante</th>
            <th className="py-2 px-3 font-bold">
              {tipo === 'ABIERTA' ? 'Respuesta Escrita' : 'Opción Seleccionada'}
            </th>
          </tr>
        </thead>
        <tbody>
          {detalle.map((v, i) => (
            <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="py-2.5 px-3 font-bold text-donezo-primary">{v.propiedad_identificador}</td>
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{v.user_nombre}</td>
              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                {tipo === 'ABIERTA'
                  ? (v.respuesta_texto ?? <span className="text-gray-300 italic">Sin respuesta</span>)
                  : (v.opcion_texto ?? '-')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const EncuestasAdmin: FC = () => {
  const { showAlert } = useDialog() as DialogContextValue;

  const [condominioId, setCondominioId] = useState<number | null>(null);
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [form, setForm] = useState<EncuestaForm>(FORM_INITIAL);

  // Panel de resultados
  const [resultadoActivoId, setResultadoActivoId] = useState<number | null>(null);
  const [resultados, setResultados] = useState<ResultadosData | null>(null);
  const [loadingResultados, setLoadingResultados] = useState<boolean>(false);

  // ── Inicializar condominio desde JWT ─────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('habioo_token');
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (payload?.condominio_id) setCondominioId(payload.condominio_id);
  }, []);

  // ── Cargar encuestas ──────────────────────────────────────────────────────────
  const fetchEncuestas = useCallback(async (): Promise<void> => {
    if (!condominioId) return;
    const token = localStorage.getItem('habioo_token');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/encuestas/${condominioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { status: string; encuestas?: Encuesta[] };
      if (data.status === 'success') setEncuestas(data.encuestas ?? []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [condominioId]);

  useEffect(() => { void fetchEncuestas(); }, [fetchEncuestas]);

  // ── Cargar resultados ─────────────────────────────────────────────────────────
  const handleVerResultados = async (encuesta: Encuesta): Promise<void> => {
    if (resultadoActivoId === encuesta.id) {
      setResultadoActivoId(null);
      setResultados(null);
      return;
    }
    setResultadoActivoId(encuesta.id);
    setResultados(null);
    setLoadingResultados(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/encuestas/${encuesta.id}/resultados`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { status: string } & Partial<ResultadosData>;
      if (data.status === 'success') {
        setResultados({
          encuesta: data.encuesta!,
          conteo: data.conteo ?? [],
          detalle: data.detalle ?? [],
        });
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingResultados(false);
    }
  };

  // ── Manejo del formulario ─────────────────────────────────────────────────────
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'tipo') {
        const tipo = value as TipoEncuesta;
        return {
          ...prev,
          tipo,
          opciones: tipo === 'MULTIPLE' ? ['', ''] : [],
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleOpcionChange = (index: number, value: string): void => {
    setForm((prev) => {
      const next = [...prev.opciones];
      next[index] = value;
      return { ...prev, opciones: next };
    });
  };

  const addOpcion = (): void => {
    setForm((prev) => ({ ...prev, opciones: [...prev.opciones, ''] }));
  };

  const removeOpcion = (index: number): void => {
    setForm((prev) => ({
      ...prev,
      opciones: prev.opciones.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: { preventDefault: () => void }): Promise<void> => {
    e.preventDefault();

    if (form.tipo === 'MULTIPLE') {
      const validas = form.opciones.filter((o) => o.trim().length > 0);
      if (validas.length < 2) {
        await showAlert({ title: 'Opciones insuficientes', message: 'Debes ingresar al menos 2 opciones para una encuesta de tipo múltiple.', variant: 'warning' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const body = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        tipo: form.tipo,
        fecha_fin: form.fecha_fin,
        opciones: form.tipo === 'MULTIPLE' ? form.opciones.filter((o) => o.trim().length > 0) : undefined,
      };
      const res = await fetch(`${API_BASE_URL}/encuestas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { status: string; message?: string; error?: string };
      if (data.status === 'success') {
        await showAlert({ title: 'Encuesta creada', message: data.message ?? 'La encuesta fue publicada exitosamente.', variant: 'success' });
        setForm(FORM_INITIAL);
        void fetchEncuestas();
      } else {
        await showAlert({ title: 'Error', message: data.error ?? 'No se pudo crear la encuesta.', variant: 'danger' });
      }
    } catch (err: unknown) {
      console.error(err);
      await showAlert({ title: 'Error de red', message: 'No se pudo conectar con el servidor.', variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Encuestas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Crea consultas para que los propietarios voten desde su portal. Los resultados son en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* ── Columna izquierda: Formulario de creación ── */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-donezo-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-donezo-primary text-white text-xs flex items-center justify-center font-black">+</span>
              Nueva Encuesta
            </h2>

            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">

              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Título *
                </label>
                <input
                  type="text"
                  name="titulo"
                  value={form.titulo}
                  onChange={handleChange}
                  placeholder="Ej: ¿Aprueba el nuevo reglamento de piscina?"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Descripción / Contexto
                </label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  placeholder="Información adicional para que los propietarios tomen una decisión informada."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm resize-none"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Tipo de Respuesta *
                </label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleChange}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm"
                >
                  <option value="SI_NO">Sí / No</option>
                  <option value="MULTIPLE">Opción Múltiple</option>
                  <option value="ABIERTA">Respuesta Abierta</option>
                </select>
                {/* Nota de ayuda dinámica según tipo */}
                <p className={`mt-1.5 text-[11px] leading-relaxed ${TIPO_META[form.tipo].color}`}>
                  {TIPO_META[form.tipo].hint}
                </p>
              </div>

              {/* Generador dinámico de opciones — solo MULTIPLE */}
              {form.tipo === 'MULTIPLE' && (
                <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10 p-3 space-y-2">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider mb-2">
                    Opciones disponibles
                  </p>
                  {form.opciones.map((opcion, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={opcion}
                        onChange={(e) => handleOpcionChange(i, e.target.value)}
                        placeholder={`Opción ${i + 1}`}
                        className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-violet-400 text-sm"
                      />
                      {form.opciones.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOpcion(i)}
                          className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOpcion}
                    className="w-full mt-1 py-1.5 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    + Agregar opción
                  </button>
                </div>
              )}

              {/* Fecha de cierre */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Fecha y Hora de Cierre *
                </label>
                <input
                  type="datetime-local"
                  name="fecha_fin"
                  value={form.fecha_fin}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Después de esta fecha la encuesta quedará cerrada y no aceptará más votos.
                </p>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-donezo-primary text-white font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md shadow-blue-500/20"
              >
                {submitting ? 'Publicando...' : 'Publicar Encuesta'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Columna derecha: Lista + Resultados ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* Lista */}
          <div className="bg-white dark:bg-donezo-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 dark:text-white">Encuestas Publicadas</h2>
              {!loading && (
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{encuestas.length} encuesta{encuestas.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {loading ? (
              <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">Cargando encuestas...</div>
            ) : encuestas.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
                <p className="text-gray-400 dark:text-gray-500 text-sm">Aún no hay encuestas publicadas.</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">Usa el formulario de la izquierda para crear la primera.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                {encuestas.map((enc) => {
                  const cerrada = isClosed(enc.fecha_fin);
                  const meta = TIPO_META[enc.tipo];
                  const activa = resultadoActivoId === enc.id;

                  return (
                    <li key={enc.id} className="px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                              {meta.label}
                            </span>
                            {cerrada ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                Cerrada
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                Activa
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight">{enc.titulo}</p>
                          {enc.descripcion && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{enc.descripcion}</p>
                          )}
                          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                            Cierra: {formatFechaFin(enc.fecha_fin)} · {enc.total_votos} voto{enc.total_votos !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Acciones */}
                        <button
                          type="button"
                          onClick={() => { void handleVerResultados(enc); }}
                          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            activa
                              ? 'bg-donezo-primary text-white border-donezo-primary'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {activa ? 'Ocultar' : 'Ver Resultados'}
                        </button>
                      </div>

                      {/* Panel de resultados expandible */}
                      {activa && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                          {loadingResultados ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Cargando resultados...</p>
                          ) : resultados ? (
                            <>
                              {/* Conteo con barras */}
                              {(enc.tipo === 'SI_NO' || enc.tipo === 'MULTIPLE') && (
                                <div className="mb-4">
                                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Resumen de votos</p>
                                  <BarraProgreso conteo={resultados.conteo} totalVotos={enc.total_votos} />
                                </div>
                              )}

                              {/* Tabla detallada admin */}
                              <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                  Detalle por propietario
                                </p>
                                <TablaDetalleAdmin detalle={resultados.detalle} tipo={enc.tipo} />
                              </div>

                              {/* Respuestas abiertas: se muestran también en tabla detalle */}
                              {enc.tipo === 'ABIERTA' && resultados.detalle.length > 0 && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
                                  {resultados.detalle.length} respuesta{resultados.detalle.length !== 1 ? 's' : ''} recibida{resultados.detalle.length !== 1 ? 's' : ''}.
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No se pudieron cargar los resultados.</p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EncuestasAdmin;
