import { useEffect, useRef, useState, type FC } from 'react';
import { MessageCircle, Paperclip, Send, Trash2, X, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/api';
import DatePicker from './ui/DatePicker';
import PagosCargaMasivaModal, { type CargaMasivaResultado, type CargaMasivaPreview } from './PagosCargaMasivaModal';

type ChatRole = 'user' | 'ai';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface ChatAskApiResponse {
  status?: string;
  respuesta?: unknown;
  message?: string;
}

interface CargaMasivaPreviewApiResponse {
  tipo: 'preview';
  preview: CargaMasivaPreview;
  mensaje?: string;
  mensaje_usuario?: string;
  error?: string;
}

type CargaMasivaUploadApiResponse = (CargaMasivaResultado & {
  error?: string;
  mensaje_usuario?: string;
  columnas_faltantes?: string[];
}) | CargaMasivaPreviewApiResponse;

type CargaMasivaConfirmApiResponse = CargaMasivaResultado & {
  error?: string;
  message?: string;
};

const CHAT_STORAGE_KEY = 'habioo_chat_history';
const MAX_CHAT_MESSAGES = 13;

const DATE_REQUEST_PATTERN = /fecha\b.{0,25}pago|pago\b.{0,25}fecha|dd[\s/]?mm[\s/]?aa|d[ií]a[\s/]mes[\s/]a[ñn]|d[ií]me.{0,15}fecha|indica.{0,15}fecha|ingresa.{0,15}fecha|selecciona.{0,15}fecha|cu[aá]l.{0,15}fecha/i;

const isAskingForDate = (messages: ChatMessage[]): boolean => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'ai') return DATE_REQUEST_PATTERN.test(m.text);
  }
  return false;
};

const fixMojibake = (value: string): string =>
  value
    .replace(/Â¿/g, '¿')
    .replace(/Â¡/g, '¡')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã'/g, 'Ñ');

const normalizeAssistantText = (value: string): string => {
  let text = fixMojibake(value).replace(/\r\n/g, '\n').trim();
  const headingFixes: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /^\?\s*Que debes hacer:/gim, replacement: '🔹 Qué debes hacer:' },
    { pattern: /^\?\?\s*Quien puede hacerlo:/gim, replacement: '👤 Quién puede hacerlo:' },
    { pattern: /^\?\?\s*Pasos a seguir:/gim, replacement: '🧭 Pasos a seguir:' },
    { pattern: /^\?\?\s*Resultado esperado:/gim, replacement: '✅ Resultado esperado:' },
    { pattern: /^\?\?\s*Nota importante:/gim, replacement: '⚠️ Nota importante:' },
    { pattern: /^\?\?\s*Base legal consultada:/gim, replacement: '📚 Base legal consultada:' },
    { pattern: /^\?\?\s*Que indica la ley:/gim, replacement: '📖 Qué indica la ley:' },
    { pattern: /^\?\s*Que significa en la practica:/gim, replacement: '🔎 Qué significa en la práctica:' },
  ];
  headingFixes.forEach(({ pattern, replacement }) => {
    text = text.replace(pattern, replacement);
  });
  return text;
};

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  text: '¡Hola! Soy el asistente de Habioo. ¿En qué te puedo ayudar hoy?',
};

type QuickAction = { label: string; message: string; upload: boolean };

const QUICK_ACTIONS_BASE: QuickAction[] = [
  { label: '💳 Reportar pago', message: 'Quiero reportar un pago', upload: false },
  { label: '💬 Consultar', message: 'Tengo una consulta', upload: false },
];

const clampMessages = (items: ChatMessage[]): ChatMessage[] => {
  if (items.length <= MAX_CHAT_MESSAGES) return items;
  return items.slice(items.length - MAX_CHAT_MESSAGES);
};

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<ChatMessage>;
  return (item.role === 'user' || item.role === 'ai') && typeof item.text === 'string';
};

const normalizeLoadedMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  text: message.role === 'ai' ? normalizeAssistantText(message.text) : fixMojibake(message.text),
});

interface AIChatWidgetProps {
  userRole?: string;
}

const AIChatWidget: FC<AIChatWidgetProps> = ({ userRole }) => {
  const puedeCargarMasivo = userRole === 'Administrador' || userRole === 'SuperUsuario';
  const quickActions: QuickAction[] = puedeCargarMasivo
    ? [...QUICK_ACTIONS_BASE, { label: '📊 Carga masiva de pagos', message: '', upload: true }]
    : QUICK_ACTIONS_BASE;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [cargaMasivaResultado, setCargaMasivaResultado] = useState<CargaMasivaResultado | null>(null);
  const [cargaMasivaNombreArchivo, setCargaMasivaNombreArchivo] = useState<string>('');
  const [cargaMasivaPreview, setCargaMasivaPreview] = useState<CargaMasivaPreview | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return [WELCOME_MESSAGE];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [WELCOME_MESSAGE];
      const valid = parsed.filter(isChatMessage).map(normalizeLoadedMessage);
      return valid.length > 0 ? clampMessages(valid) : [WELCOME_MESSAGE];
    } catch {
      return [WELCOME_MESSAGE];
    }
  });
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const dateMode = isAskingForDate(messages);
  const showQuickActions = messages.length === 1 && messages[0]?.role === 'ai' && !isLoading;

  const clearChat = (): void => {
    setMessages([WELCOME_MESSAGE]);
    setPickerDate(null);
    setInput('');
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const sendMessage = async (texto: string): Promise<void> => {
    const textoDelUsuario = texto.trim();
    if (!textoDelUsuario || isLoading) return;

    const token = localStorage.getItem('habioo_token');
    setMessages((prev) => clampMessages([...prev, { role: 'user', text: textoDelUsuario }]));
    setInput('');
    setPickerDate(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mensaje: textoDelUsuario }),
      });

      const data = (await res.json()) as ChatAskApiResponse;

      if (!res.ok || data.status !== 'success') {
        setMessages((prev) =>
          clampMessages([
            ...prev,
            {
              role: 'ai',
              text: normalizeAssistantText(String(data.message || 'No pude procesar tu solicitud en este momento.')),
            },
          ]),
        );
        return;
      }

      const respuestaTexto =
        typeof data.respuesta === 'string'
          ? data.respuesta
          : data.respuesta !== undefined && data.respuesta !== null
            ? JSON.stringify(data.respuesta)
            : 'Sin respuesta del asistente.';

      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: normalizeAssistantText(respuestaTexto) }]),
      );
    } catch {
      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: 'Error de conexión con el asistente. Inténtalo nuevamente.' }]),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void sendMessage(input);
  };

  const uploadExcel = async (file: File): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    setIsUploadingExcel(true);
    setMessages((prev) =>
      clampMessages([...prev, { role: 'user', text: `📎 ${file.name}` }]),
    );

    try {
      const formData = new FormData();
      formData.append('archivo', file);

      // Use the new preview endpoint that validates directly in the backend
      const res = await fetch(`${API_BASE_URL}/chat/preview-carga-pagos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = (await res.json()) as CargaMasivaUploadApiResponse;

      if (!res.ok) {
        const errMsg = data.mensaje_usuario || data.error || 'Error al procesar el archivo.';
        setMessages((prev) =>
          clampMessages([...prev, { role: 'ai', text: `❌ ${errMsg}` }]),
        );
        return;
      }

      // Preview response
      if (data.tipo === 'preview') {
        setCargaMasivaPreview(data.preview);
        setCargaMasivaNombreArchivo(file.name);
        
        const validCount = data.preview.pagos.length;
        const errorCount = (data.preview.errores || []).length;
        let previewMsg = `✅ ${validCount} pago(s) válido(s) encontrado(s).`;
        if (errorCount > 0) previewMsg += ` ${errorCount} con error(es).`;
        previewMsg += ' Revisa la vista previa y confirma la carga.';
        
        setMessages((prev) =>
          clampMessages([...prev, { role: 'ai', text: previewMsg }]),
        );
        return;
      }

      // Legacy response
      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: data.mensaje || '✅ Archivo procesado.' }]),
      );
      setCargaMasivaNombreArchivo(file.name);
      setCargaMasivaResultado(data);
    } catch {
      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: 'Error de conexión al subir el archivo.' }]),
      );
    } finally {
      setIsUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmCargaMasiva = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    if (!cargaMasivaPreview) return;

    try {
      const res = await fetch(`${API_BASE_URL}/chat/confirmar-carga-pagos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pagos: cargaMasivaPreview.pagos }),
      });

      const data = (await res.json()) as CargaMasivaConfirmApiResponse;

      if (!res.ok) {
        setMessages((prev) =>
          clampMessages([...prev, { role: 'ai', text: `❌ ${data.error || data.message || 'Error al registrar los pagos.'}` }]),
        );
        setCargaMasivaPreview(null);
        return;
      }

      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: data.mensaje || `✅ ${data.exitosos} pago(s) registrado(s) exitosamente.` }]),
      );
      setCargaMasivaResultado(data);
      setCargaMasivaPreview(null);
    } catch {
      setMessages((prev) =>
        clampMessages([...prev, { role: 'ai', text: 'Error de conexión al confirmar la carga.' }]),
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setMessages((prev) =>
        clampMessages([
          ...prev,
          { role: 'ai', text: '❌ Solo se permiten archivos Excel (.xlsx o .xls). Por favor selecciona un archivo válido.' },
        ]),
      );
      return;
    }
    void uploadExcel(file);
  };

  const handleDateChange = (date: Date | null): void => {
    setPickerDate(date);
    if (!date) return;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    setInput(`${d}/${m}/${y}`);
  };

  if (!isOpen) {
    return (
      <>
        {cargaMasivaResultado && (
          <PagosCargaMasivaModal
            resultado={cargaMasivaResultado}
            nombreArchivo={cargaMasivaNombreArchivo}
            onClose={() => setCargaMasivaResultado(null)}
          />
        )}
        {cargaMasivaPreview && (
          <PagosCargaMasivaModal
            resultado={{
              tipo: 'exito',
              mensaje: '',
              exitosos: cargaMasivaPreview.pagos.length,
              fallidos: cargaMasivaPreview.errores?.length || 0,
              total: cargaMasivaPreview.totalFilas,
              errores: cargaMasivaPreview.errores ?? [],
            }}
            nombreArchivo={cargaMasivaNombreArchivo}
            onClose={() => setCargaMasivaPreview(null)}
            preview={cargaMasivaPreview}
            onConfirm={confirmCargaMasiva}
          />
        )}
        <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-2xl transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label="Abrir asistente"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      </>
    );
  }

  return (
    <>
    {cargaMasivaResultado && (
      <PagosCargaMasivaModal
        resultado={cargaMasivaResultado}
        nombreArchivo={cargaMasivaNombreArchivo}
        onClose={() => setCargaMasivaResultado(null)}
      />
    )}
    {cargaMasivaPreview && (
      <PagosCargaMasivaModal
        resultado={{
          tipo: 'exito',
          mensaje: '',
          exitosos: cargaMasivaPreview.pagos.length,
          fallidos: cargaMasivaPreview.errores?.length || 0,
          total: cargaMasivaPreview.totalFilas,
          errores: cargaMasivaPreview.errores ?? [],
        }}
        nombreArchivo={cargaMasivaNombreArchivo}
        onClose={() => setCargaMasivaPreview(null)}
        preview={cargaMasivaPreview}
        onConfirm={confirmCargaMasiva}
      />
    )}
    <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-50 w-full h-full sm:w-80 md:w-96 sm:h-[500px] bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold">Asistente Habioo</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-emerald-700 transition-colors"
            aria-label="Minimizar chat"
            title="Minimizar"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="p-1 rounded-md hover:bg-emerald-700 transition-colors"
            aria-label="Limpiar chat"
            title="Limpiar chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-emerald-700 transition-colors"
            aria-label="Cerrar chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                message.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-md'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-bl-md'
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 pl-5">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 pl-5">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {showQuickActions && (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() =>
                  action.upload
                    ? fileInputRef.current?.click()
                    : void sendMessage(action.message)
                }
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md text-sm bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Escribiendo...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        {dateMode && (
          <div className="mb-2">
            <DatePicker
              selected={pickerDate}
              onChange={handleDateChange}
              maxDate={new Date()}
              placeholderText="Selecciona la fecha de pago"
              className="w-full h-9 rounded-lg border border-emerald-400 bg-slate-50 dark:bg-slate-800 px-3 pr-8 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              wrapperClassName="w-full"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploadingExcel}
            className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Adjuntar Excel de pagos"
            title="Cargar Excel de pagos"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dateMode ? 'DD/MM/AAAA o escribe la fecha...' : 'Escribe tu mensaje...'}
            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isUploadingExcel}
            className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
    </>
  );
};

export default AIChatWidget;
