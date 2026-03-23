import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
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
const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  text: '¡Hola! Soy el asistente de Habioo. ¿En qué te puedo ayudar hoy?',
};

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<ChatMessage>;
  return (item.role === 'user' || item.role === 'ai') && typeof item.text === 'string';
};

const AIChatWidget: FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return [WELCOME_MESSAGE];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [WELCOME_MESSAGE];
      const valid = parsed.filter(isChatMessage);
      return valid.length > 0 ? valid : [WELCOME_MESSAGE];
    } catch {
      return [WELCOME_MESSAGE];
    }
  });
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

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

    setMessages((prev) => [...prev, { role: 'user', text: textoDelUsuario }]);
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
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: String(data.message || 'No pude procesar tu solicitud en este momento.') },
        ]);
        return;
      }

      const respuestaTexto =
        typeof data.respuesta === 'string'
          ? data.respuesta
          : data.respuesta !== undefined && data.respuesta !== null
            ? JSON.stringify(data.respuesta)
            : 'Sin respuesta del asistente.';

      setMessages((prev) => [...prev, { role: 'ai', text: respuestaTexto }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Error de conexión con el asistente. Inténtalo nuevamente.' },
      ]);
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
              {message.text}
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

