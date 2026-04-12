import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import ModalBase from '../ui/ModalBase';
import ReactMarkdown from 'react-markdown';
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
import { API_BASE_URL } from '../../config/api';

interface ModalNuevoAlquilerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zonas?: Array<{ id: number; nombre: string; activa?: boolean }>;
  isJuntaGeneral?: boolean;
  mode?: 'create' | 'edit';
  initialData?: {
    id: number;
    nombre: string;
    descripcion: string | null;
    costo_usd: string | number;
    deposito_usd: string | number;
    zona_id?: number | null;
  } | null;
}

interface CreateAlquilerResponse {
  status: string;
  message?: string;
}

interface MarkdownEditorFieldProps {
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
}

const editorBtnClass =
  'rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

const parseUsdInput = (value: string): number => {
  const raw = value.trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
};

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
      namespace: 'ModalNuevoAlquilerMarkdownEditor',
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
              <ContentEditable className="min-h-[220px] p-3 text-sm text-gray-900 outline-none dark:text-white [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-0.5" />
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

const ModalNuevoAlquiler: FC<ModalNuevoAlquilerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  zonas = [],
  isJuntaGeneral = false,
  mode = 'create',
  initialData = null,
}) => {
  const [nombre, setNombre] = useState<string>('');
  const [costoUsd, setCostoUsd] = useState<string>('');
  const [depositoUsd, setDepositoUsd] = useState<string>('');
  const [zonaId, setZonaId] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const markdownPreview = useMemo<string>(() => {
    const text = descripcion.trim();
    if (text) return text;
    return '### Vista previa\n\nEscribe aquí las reglas del espacio en **Markdown**.';
  }, [descripcion]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialData) {
      setNombre(initialData.nombre || '');
      setCostoUsd(String(initialData.costo_usd ?? ''));
      setDepositoUsd(String(initialData.deposito_usd ?? ''));
      setZonaId(initialData.zona_id ? String(initialData.zona_id) : '');
      setDescripcion(initialData.descripcion || '');
      setError('');
      return;
    }
    resetForm();
  }, [isOpen, mode, initialData]);

  const resetForm = (): void => {
    setNombre('');
    setCostoUsd('');
    setDepositoUsd('');
    setZonaId('');
    setDescripcion('');
    setError('');
  };

  const handleClose = (): void => {
    if (isLoading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isLoading) return;

    const nombreTrim = nombre.trim();
    const descripcionTrim = descripcion.trim();
    const costoNum = parseUsdInput(costoUsd);
    const depositoNum = depositoUsd.trim() === '' ? 0 : parseUsdInput(depositoUsd);

    if (!nombreTrim) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!Number.isFinite(costoNum) || costoNum < 0) {
      setError('El costo USD es inválido.');
      return;
    }
    if (!Number.isFinite(depositoNum) || depositoNum < 0) {
      setError('El depósito USD es inválido.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const endpoint = mode === 'edit' && initialData ? `${API_BASE_URL}/alquileres/${initialData.id}` : `${API_BASE_URL}/alquileres`;
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: nombreTrim,
          descripcion: descripcionTrim || null,
          costo_usd: costoNum,
          deposito_usd: depositoNum,
          zona_id: zonaId ? Number(zonaId) : null,
        }),
      });

      const result: CreateAlquilerResponse = await response.json();
      if (!response.ok || result.status !== 'success') {
        setError(result.message || (mode === 'edit' ? 'No se pudo actualizar el alquiler.' : 'No se pudo registrar el alquiler.'));
        return;
      }

      onSuccess();
      resetForm();
      onClose();
    } catch {
      setError(mode === 'edit' ? 'No se pudo actualizar el alquiler por un error de conexión.' : 'No se pudo registrar el alquiler por un error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalBase onClose={handleClose} title={mode === 'edit' ? 'Editar Alquiler' : 'Registrar Nuevo Alquiler'} subtitle={mode === 'edit' ? 'Actualiza los datos del espacio alquilable.' : 'Crea un espacio reservable para residentes y copropietarios.'} maxWidth="max-w-5xl" disableClose={isLoading}>
      <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <section className="p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Nombre del espacio *</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Ej: Salón de Fiestas"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Costo USD *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={costoUsd}
                      onChange={(event) => setCostoUsd(event.target.value)}
                      placeholder="Ej: 50,00"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Depósito USD (Opcional)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={depositoUsd}
                      onChange={(event) => setDepositoUsd(event.target.value)}
                      placeholder="Ej: 20,00"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {isJuntaGeneral ? 'Área / Sector (Juntas)' : 'Área / Sector'}
                  </label>
                  <select
                    value={zonaId}
                    onChange={(event) => setZonaId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sin área / sector</option>
                    {zonas
                      .filter((z) => z.activa !== false)
                      .map((z) => (
                        <option key={`alquiler-zona-${z.id}`} value={String(z.id)}>
                          {z.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Reglas de uso</label>
                  <MarkdownEditorField
                    value={descripcion}
                    placeholder="Ej: - No se permite música después de las 10:00pm"
                    onChange={(val) => setDescripcion(val || '')}
                  />
                  <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Soporta formato Markdown.</p>
                </div>
              </section>

              <section className="p-6">
                <div className="h-full rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3">Previsualización del reglamento</p>
                  <div className="prose prose-sm dark:prose-invert break-words whitespace-pre-wrap max-w-none">
                    <ReactMarkdown>{markdownPreview}</ReactMarkdown>
                  </div>
                </div>
              </section>
            </div>

            <div className="pt-5 mt-4 border-t border-gray-200/80 dark:border-gray-700/60 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error || ' '}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (mode === 'edit' ? 'Guardando cambios...' : 'Guardando...') : (mode === 'edit' ? 'Guardar Cambios' : 'Guardar Alquiler')}
                </button>
              </div>
            </div>
      </form>
    </ModalBase>
  );
};

export default ModalNuevoAlquiler;
