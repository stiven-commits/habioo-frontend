import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FC, ChangeEvent } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';
import DataTable from '../components/ui/DataTable';
import FormField from '../components/ui/FormField';
import StatusBadge, { type BadgeColor } from '../components/ui/StatusBadge';
import PageHeader from '../components/ui/PageHeader';

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
  metodo_division: string;
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

const TIPO_META: Record<TipoEncuesta, { label: string; color: string; badgeColor: BadgeColor; hint: string }> = {
  SI_NO: {
    label: 'Sí / No',
    color: 'text-blue-600 dark:text-blue-400',
    badgeColor: 'blue',
    hint: 'Dos opciones fijas: "Sí" y "No". Ideal para aprobaciones o cartas de consulta binarias.',
  },
  MULTIPLE: {
    label: 'Opción Múltiple',
    color: 'text-violet-600 dark:text-violet-400',
    badgeColor: 'violet',
    hint: 'Define las opciones tú mismo. El propietario elige una sola. Ideal para seleccionar fechas, proveedores o alternativas.',
  },
  ABIERTA: {
    label: 'Respuesta Abierta',
    color: 'text-amber-600 dark:text-amber-400',
    badgeColor: 'amber',
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

const pad2 = (value: number): string => String(value).padStart(2, '0');

const formatDateTimeLocalValue = (date: Date): string => (
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
);

const parseDateTimeLocalValue = (value: string): Date | null => {
  if (!value) return null;
  const [datePart, timePart = '00:00'] = value.split('T');
  const dateTokens = String(datePart || '').split('-');
  const timeTokens = String(timePart || '00:00').split(':');
  const year = Number.parseInt(dateTokens[0] ?? '', 10);
  const month = Number.parseInt(dateTokens[1] ?? '', 10);
  const day = Number.parseInt(dateTokens[2] ?? '', 10);
  const hours = Number.parseInt(timeTokens[0] ?? '', 10);
  const minutes = Number.parseInt(timeTokens[1] ?? '', 10);
  if ([year, month, day, hours, minutes].some((v) => Number.isNaN(v))) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const formatDateTimeDisplay = (value: string): string => {
  const date = parseDateTimeLocalValue(value);
  if (!date) return '';
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface CartaConsultaDateTimePickerProps {
  value: string;
  onChange: (next: string) => void;
  minDate: Date;
}

const CartaConsultaDateTimePicker: FC<CartaConsultaDateTimePickerProps> = ({ value, onChange, minDate }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => parseDateTimeLocalValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? minDate);

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const baseDate = selected ?? minDate;
  const hour24 = baseDate.getHours();
  const minute = baseDate.getMinutes();
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const commit = (nextDate: Date): void => {
    const normalized = nextDate < minDate ? minDate : nextDate;
    onChange(formatDateTimeLocalValue(normalized));
  };

  const handleDateSelect = (date: Date | undefined): void => {
    if (!date) return;
    commit(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour24, minute, 0, 0));
  };

  const handleHourChange = (nextHour12: number): void => {
    const normalizedHour24 = (nextHour12 % 12) + (ampm === 'PM' ? 12 : 0);
    commit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), normalizedHour24, minute, 0, 0));
  };

  const handleMinuteChange = (nextMinute: number): void => {
    commit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour24, nextMinute, 0, 0));
  };

  const handleAmPmChange = (nextAmPm: 'AM' | 'PM'): void => {
    const nextHour24 = (hour12 % 12) + (nextAmPm === 'PM' ? 12 : 0);
    commit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), nextHour24, minute, 0, 0));
  };

  const nowLabel = formatDateTimeDisplay(formatDateTimeLocalValue(minDate));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm text-left"
      >
        {value ? formatDateTimeDisplay(value) : 'Selecciona fecha y hora'}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[320px] sm:w-[360px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-2xl">
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Hora de cierre</p>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={hour12}
                onChange={(e) => handleHourChange(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1.5 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{pad2(h)}</option>
                ))}
              </select>
              <select
                value={minute}
                onChange={(e) => handleMinuteChange(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1.5 text-sm"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{pad2(m)}</option>
                ))}
              </select>
              <select
                value={ampm}
                onChange={(e) => handleAmPmChange(e.target.value as 'AM' | 'PM')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1.5 text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <DayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selected ?? undefined}
            onSelect={handleDateSelect}
            disabled={{ before: new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) }}
            showOutsideDays
            weekStartsOn={1}
            classNames={{
              chevron: 'fill-donezo-primary',
              day_selected: 'bg-donezo-primary text-white hover:bg-donezo-primary',
              day_today: 'text-donezo-primary font-bold',
            }}
          />

          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Minimo: {nowLabel}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-donezo-primary hover:underline"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
// ─── Subcomponentes ───────────────────────────────────────────────────────────

const BarraProgreso: FC<{ conteo: ConteoPorOpcion[]; totalVotos: number; metodoDivision: string }> = ({ conteo, totalVotos, metodoDivision }) => {
  const esPorAlicuota = metodoDivision === 'Alicuota';
  // Para alícuota: el denominador es la suma de alícuotas votadas (no 100, para mostrar distribución relativa entre los que votaron)
  const totalPonderado = esPorAlicuota
    ? conteo.reduce((acc, c) => acc + Number(c.total), 0)
    : totalVotos;

  return (
    <div className="space-y-2 mt-3">
      {conteo.map((c, i) => {
        const pct = totalPonderado > 0 ? Math.round((Number(c.total) / totalPonderado) * 100) : 0;
        const etiqueta = esPorAlicuota
          ? `${Number(c.total).toFixed(2)}% alíc. · ${pct}% del total votado`
          : `${c.total} voto${c.total !== 1 ? 's' : ''} · ${pct}%`;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              <span>{c.opcion_texto ?? 'Respuesta abierta'}</span>
              <span>{etiqueta}</span>
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
};

const TablaDetalleAdmin: FC<{ detalle: VotoDetalle[]; tipo: TipoEncuesta }> = ({ detalle, tipo }) => {
  if (detalle.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Ningún propietario ha votado todavía.</p>;
  }

  return (
    <div className="overflow-x-auto mt-4" style={{ minWidth: '560px' }}>
      <DataTable<VotoDetalle>
        columns={[
          { key: 'apto', header: 'Apto / Inmueble', className: 'font-bold text-donezo-primary', render: (v) => v.propiedad_identificador },
          { key: 'votante', header: 'Votante', className: 'text-gray-700 dark:text-gray-300', render: (v) => v.user_nombre },
          {
            key: 'respuesta',
            header: tipo === 'ABIERTA' ? 'Respuesta Escrita' : 'Opción Seleccionada',
            className: 'text-gray-600 dark:text-gray-400',
            render: (v) => tipo === 'ABIERTA'
              ? (v.respuesta_texto ?? <span className="text-gray-300 italic">Sin respuesta</span>)
              : (v.opcion_texto ?? '-'),
          },
        ]}
        data={detalle}
        keyExtractor={(_, i) => i}
        rowClassName="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40"
      />
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
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>('');

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
      const data = (await res.json()) as { status: string; encuestas?: Encuesta[]; message?: string; error?: string };
      if (res.status === 403) {
        setAccessDeniedMessage(data.message ?? data.error ?? 'No tienes permisos para gestionar cartas consulta en este condominio.');
        setEncuestas([]);
        return;
      }
      setAccessDeniedMessage('');
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
          metodo_division: data.metodo_division ?? 'Partes Iguales',
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

    if (!form.fecha_fin) {
      await showAlert({ title: 'Fecha requerida', message: 'Debes seleccionar la fecha y hora de cierre.', variant: 'warning' });
      return;
    }

    if (new Date(form.fecha_fin) <= new Date()) {
      await showAlert({ title: 'Fecha inválida', message: 'La fecha de cierre debe ser posterior al momento actual.', variant: 'warning' });
      return;
    }

    if (form.tipo === 'MULTIPLE') {
      const validas = form.opciones.filter((o) => o.trim().length > 0);
      if (validas.length < 2) {
        await showAlert({ title: 'Opciones insuficientes', message: 'Debes ingresar al menos 2 opciones para una carta consulta de tipo múltiple.', variant: 'warning' });
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
      if (res.status === 403) {
        await showAlert({ title: 'Sin permisos', message: data.message ?? data.error ?? 'No autorizado.', variant: 'warning' });
        return;
      }
      if (data.status === 'success') {
        await showAlert({ title: 'Carta Consulta creada', message: data.message ?? 'La carta consulta fue publicada exitosamente.', variant: 'success' });
        setForm(FORM_INITIAL);
        void fetchEncuestas();
      } else {
        await showAlert({ title: 'Error', message: data.error ?? 'No se pudo crear la carta consulta.', variant: 'danger' });
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
      <PageHeader
        title="Cartas Consulta"
        subtitle="Crea cartas consulta para que los propietarios voten desde su portal. Los resultados son en tiempo real."
      />

      <div className="mb-6">
        {accessDeniedMessage && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            {accessDeniedMessage}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* ── Columna izquierda: Formulario de creación ── */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-donezo-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-donezo-primary text-white text-xs flex items-center justify-center font-black">+</span>
              Nueva Carta Consulta
            </h2>

            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">

              {/* Título */}
              <FormField label="Título" required>
                <input
                  type="text"
                  name="titulo"
                  value={form.titulo}
                  onChange={handleChange}
                  placeholder="Ej: ¿Aprueba el nuevo reglamento de piscina?"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm"
                />
              </FormField>

              {/* Descripción */}
              <FormField label="Descripción / Contexto">
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  placeholder="Información adicional para que los propietarios tomen una decisión informada."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary text-sm resize-none"
                />
              </FormField>

              {/* Tipo */}
              <FormField label="Tipo de Respuesta" required hint={<span className={TIPO_META[form.tipo].color}>{TIPO_META[form.tipo].hint}</span>}>
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
              </FormField>

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
              <FormField label="Fecha y Hora de Cierre" required hint="Después de esta fecha la carta consulta quedará cerrada y no aceptará más votos.">
                <CartaConsultaDateTimePicker
                  value={form.fecha_fin}
                  onChange={(next) => setForm((prev) => ({ ...prev, fecha_fin: next }))}
                  minDate={new Date()}
                />
              </FormField>

              {/* Botón */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-donezo-primary text-white font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md shadow-blue-500/20"
              >
                {submitting ? 'Publicando...' : 'Publicar Carta Consulta'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Columna derecha: Lista + Resultados ── */}
        <div className="xl:col-span-3 space-y-4">

          {/* Lista */}
          <div className="bg-white dark:bg-donezo-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 dark:text-white">Cartas Consulta Publicadas</h2>
              {!loading && (
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{encuestas.length} carta{encuestas.length !== 1 ? 's' : ''} consulta</span>
              )}
            </div>

            {loading ? (
              <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">Cargando cartas consulta...</div>
            ) : encuestas.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
                <p className="text-gray-400 dark:text-gray-500 text-sm">Aún no hay cartas consulta publicadas.</p>
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
                            <StatusBadge color={meta.badgeColor}>{meta.label}</StatusBadge>
                            {cerrada ? (
                              <StatusBadge color="gray">Cerrada</StatusBadge>
                            ) : (
                              <StatusBadge color="green">Activa</StatusBadge>
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
                                  <BarraProgreso conteo={resultados.conteo} totalVotos={enc.total_votos} metodoDivision={resultados.metodo_division} />
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


