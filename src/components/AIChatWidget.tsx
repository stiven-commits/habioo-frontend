import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/api';

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

const CHAT_STORAGE_KEY = 'habioo_chat_history';
const MAX_CHAT_MESSAGES = 13;

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
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ');

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

const AIChatWidget: FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
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

  const clearChat = (): void => {
    setMessages([WELCOME_MESSAGE]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const textoDelUsuario = input.trim();
    if (!textoDelUsuario || isLoading) return;

    const token = localStorage.getItem('habioo_token');

    setMessages((prev) => clampMessages([...prev, { role: 'user', text: textoDelUsuario }]));
    setInput('');
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

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-2xl transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label="Abrir asistente"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-50 w-full h-full sm:w-80 md:w-96 sm:h-[500px] bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold">Asistente Habioo</h3>
        <div className="flex items-center gap-1">
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
        onSubmit={(e) => void handleSubmit(e)}
        className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChatWidget;
