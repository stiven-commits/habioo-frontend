import { useState, useEffect, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { useDialog } from '../../components/ui/DialogProvider';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEncuesta = 'SI_NO' | 'MULTIPLE' | 'ABIERTA';

interface PropiedadActiva {
  id_propiedad: number;
  identificador: string;
  nombre_condominio: string;
  condominio_id?: number;
}

interface OutletContextType {
  propiedadActiva?: PropiedadActiva | null;
}

interface Opcion {
  id: number;
  texto: string;
}

interface Encuesta {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: TipoEncuesta;
  fecha_fin: string;
  opciones: Opcion[];
  ya_voto: boolean;
  total_votos: number;
}

interface ConteoPorOpcion {
  opcion_id: number | null;
  opcion_texto: string | null;
  total: number;
}

interface ResultadosData {
  conteo: ConteoPorOpcion[];
  respuestas_abiertas: string[];
}

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface DialogContextValue {
  showAlert: (opts: { title: string; message: string; variant: DialogVariant }) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const formatFechaFin = (iso: string): string =>
  new Date(iso).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const isClosed = (fecha_fin: string): boolean => new Date() > new Date(fecha_fin);

const TIPO_META: Record<TipoEncuesta, { label: string; badge: string }> = {
  SI_NO:    { label: 'Sí / No',           badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  MULTIPLE: { label: 'Opción Múltiple',   badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  ABIERTA:  { label: 'Respuesta Abierta', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

// ─── Sub-componente: Barra de progreso (anónima) ──────────────────────────────

const BarrasAnonimas: FC<{ conteo: ConteoPorOpcion[]; totalVotos: number }> = ({ conteo, totalVotos }) => (
  <div className="space-y-2 mt-2">
    {conteo.map((c, i) => {
      const pct = totalVotos > 0 ? Math.round((c.total / totalVotos) * 100) : 0;
      return (
        <div key={i}>
          <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            <span>{c.opcion_texto ?? 'Otros'}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-donezo-primary h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    })}
    {conteo.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Sin votos aún.</p>}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const EncuestasPropietario: FC = () => {
  const { propiedadActiva } = useOutletContext<OutletContextType>();
  const { showAlert } = useDialog() as DialogContextValue;

  const [condominioId, setCondominioId] = useState<number | null>(null);
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Panel de votación activo
  const [votandoId, setVotandoId] = useState<number | null>(null);
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<number | null>(null);
  const [respuestaTexto, setRespuestaTexto] = useState<string>('');
  const [submittingVoto, setSubmittingVoto] = useState<boolean>(false);

  // Panel de resultados
  const [resultadoActivoId, setResultadoActivoId] = useState<number | null>(null);
  const [resultados, setResultados] = useState<ResultadosData | null>(null);
  const [loadingResultados, setLoadingResultados] = useState<boolean>(false);

  // Obtener condominio_id del JWT
  useEffect(() => {
    const token = localStorage.getItem('habioo_token');
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (payload?.condominio_id) setCondominioId(payload.condominio_id);
  }, []);

  // Cargar encuestas
  const fetchEncuestas = useCallback(async (): Promise<void> => {
    if (!condominioId || !propiedadActiva?.id_propiedad) return;
    const token = localStorage.getItem('habioo_token');
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/encuestas/${condominioId}?propiedad_id=${propiedadActiva.id_propiedad}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as { status: string; encuestas?: Encuesta[] };
      if (data.status === 'success') setEncuestas(data.encuestas ?? []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [condominioId, propiedadActiva?.id_propiedad]);

  useEffect(() => { void fetchEncuestas(); }, [fetchEncuestas]);

  // Abrir panel de votación
  const handleIniciarVoto = (enc: Encuesta): void => {
    setVotandoId(enc.id);
    setOpcionSeleccionada(null);
    setRespuestaTexto('');
    setResultadoActivoId(null);
    setResultados(null);
  };

  // Cargar resultados anónimos
  const handleVerResultados = async (encuesta: Encuesta): Promise<void> => {
    if (resultadoActivoId === encuesta.id) {
      setResultadoActivoId(null);
      setResultados(null);
      return;
    }
    setVotandoId(null);
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
          conteo: data.conteo ?? [],
          respuestas_abiertas: data.respuestas_abiertas ?? [],
        });
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingResultados(false);
    }
  };

  // Registrar voto
  const handleVotar = async (encuesta: Encuesta): Promise<void> => {
    if (!propiedadActiva?.id_propiedad) return;

    if (encuesta.tipo !== 'ABIERTA' && opcionSeleccionada === null) {
      await showAlert({ title: 'Selecciona una opción', message: 'Debes elegir una opción antes de votar.', variant: 'warning' });
      return;
    }
    if (encuesta.tipo === 'ABIERTA' && respuestaTexto.trim().length === 0) {
      await showAlert({ title: 'Escribe tu respuesta', message: 'El campo de respuesta no puede estar vacío.', variant: 'warning' });
      return;
    }

    setSubmittingVoto(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const body = {
        propiedad_id: propiedadActiva.id_propiedad,
        opcion_id:       encuesta.tipo !== 'ABIERTA' ? opcionSeleccionada : undefined,
        respuesta_texto: encuesta.tipo === 'ABIERTA'  ? respuestaTexto.trim() : undefined,
      };
      const res = await fetch(`${API_BASE_URL}/encuestas/${encuesta.id}/votar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { status: string; message?: string; error?: string };
      if (data.status === 'success') {
        await showAlert({ title: 'Voto registrado', message: '¡Tu voto fue registrado exitosamente!', variant: 'success' });
        setVotandoId(null);
        void fetchEncuestas();
      } else {
        await showAlert({ title: 'No se pudo votar', message: data.error ?? data.message ?? 'Error al registrar voto.', variant: 'warning' });
      }
    } catch (err: unknown) {
      console.error(err);
      await showAlert({ title: 'Error de red', message: 'No se pudo conectar con el servidor.', variant: 'danger' });
    } finally {
      setSubmittingVoto(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!propiedadActiva) {
    return (
      <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
        Selecciona un inmueble para ver las encuestas.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Encuestas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Participa en las consultas de tu condominio. Tus respuestas son anónimas para otros propietarios.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Cargando encuestas...</div>
      ) : encuestas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No hay encuestas publicadas en tu condominio.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {encuestas.map((enc) => {
            const cerrada = isClosed(enc.fecha_fin);
            const meta = TIPO_META[enc.tipo];
            const estaVotando = votandoId === enc.id;
            const estaVerResultados = resultadoActivoId === enc.id;

            return (
              <div key={enc.id} className="bg-white dark:bg-donezo-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">

                {/* Cabecera */}
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                    {cerrada ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Cerrada</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Activa</span>
                    )}
                    {enc.ya_voto && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-donezo-primary/10 text-donezo-primary">Ya votaste</span>
                    )}
                  </div>
                  <p className="font-bold text-gray-800 dark:text-white">{enc.titulo}</p>
                  {enc.descripcion && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{enc.descripcion}</p>
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2">
                    {cerrada ? 'Cerró' : 'Cierra'}: {formatFechaFin(enc.fecha_fin)} · {enc.total_votos} voto{enc.total_votos !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Acciones */}
                {!cerrada && !enc.ya_voto && (
                  <div className="px-5 pb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => estaVotando ? setVotandoId(null) : handleIniciarVoto(enc)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        estaVotando
                          ? 'bg-donezo-primary text-white border-donezo-primary'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {estaVotando ? 'Cancelar' : 'Votar'}
                    </button>
                    {enc.ya_voto || enc.total_votos > 0 ? (
                      <button
                        type="button"
                        onClick={() => { void handleVerResultados(enc); }}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                      >
                        {estaVerResultados ? 'Ocultar' : 'Ver resultados'}
                      </button>
                    ) : null}
                  </div>
                )}
                {(cerrada || enc.ya_voto) && (
                  <div className="px-5 pb-3">
                    <button
                      type="button"
                      onClick={() => { void handleVerResultados(enc); }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        estaVerResultados
                          ? 'bg-donezo-primary text-white border-donezo-primary'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {estaVerResultados ? 'Ocultar resultados' : 'Ver resultados'}
                    </button>
                  </div>
                )}

                {/* Panel de votación */}
                {estaVotando && !cerrada && !enc.ya_voto && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/30">
                    {enc.tipo === 'ABIERTA' ? (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                          Tu respuesta
                        </label>
                        <textarea
                          rows={3}
                          value={respuestaTexto}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRespuestaTexto(e.target.value)}
                          placeholder="Escribe tu respuesta aquí..."
                          className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm resize-none"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Elige una opción</p>
                        {enc.opciones.map((op) => (
                          <label
                            key={op.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              opcionSeleccionada === op.id
                                ? 'border-donezo-primary bg-donezo-primary/5 dark:bg-donezo-primary/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`encuesta-${enc.id}`}
                              value={op.id}
                              checked={opcionSeleccionada === op.id}
                              onChange={() => setOpcionSeleccionada(op.id)}
                              className="accent-donezo-primary"
                            />
                            <span className={`text-sm font-medium ${opcionSeleccionada === op.id ? 'text-donezo-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                              {op.texto}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { void handleVotar(enc); }}
                      disabled={submittingVoto}
                      className="mt-4 w-full py-2.5 rounded-xl bg-donezo-primary text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-all"
                    >
                      {submittingVoto ? 'Enviando...' : 'Confirmar Voto'}
                    </button>
                  </div>
                )}

                {/* Panel de resultados anónimos */}
                {estaVerResultados && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4">
                    {loadingResultados ? (
                      <p className="text-xs text-gray-400 text-center py-2">Cargando resultados...</p>
                    ) : resultados ? (
                      <>
                        {enc.tipo !== 'ABIERTA' && (
                          <BarrasAnonimas conteo={resultados.conteo} totalVotos={enc.total_votos} />
                        )}
                        {enc.tipo === 'ABIERTA' && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                              Respuestas recibidas ({resultados.respuestas_abiertas.length})
                            </p>
                            {resultados.respuestas_abiertas.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-2">Sin respuestas aún.</p>
                            ) : (
                              <ul className="space-y-2">
                                {resultados.respuestas_abiertas.map((r, i) => (
                                  <li key={i} className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                                    "{r}"
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-3 text-center">
                          Los resultados son anónimos — no se muestran nombres ni apartamentos.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No se pudieron cargar los resultados.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EncuestasPropietario;
