import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import habiooLogoColor from '../assets/brand/habioo_logo_color.svg';

interface LastHttpErrorPayload {
  status?: number;
  method?: string;
  url?: string;
  requestId?: string;
  message?: string;
  timestamp?: string;
}

const LAST_ERROR_STORAGE_KEY = 'habioo:last-http-error';

const Error500 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [errorPayload, setErrorPayload] = useState<LastHttpErrorPayload | null>(null);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_ERROR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LastHttpErrorPayload;
      if (!parsed || typeof parsed !== 'object') return;
      setErrorPayload(parsed);
    } catch {
      setErrorPayload(null);
    }
  }, []);

  const queryRequestId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('rid') || '').trim();
  }, [location.search]);

  const requestId = errorPayload?.requestId || queryRequestId || '';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, hsl(var(--primary)) 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, transparent 1px, transparent 40px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        <div className="relative w-48 h-48 mb-8">
          <svg className="absolute inset-0 w-48 h-48 animate-pulse" viewBox="0 0 91.33 92.41" style={{ transform: 'translate(3px, -2px)', opacity: 0.3, filter: 'hue-rotate(20deg)' }}>
            <polygon fill="hsl(var(--primary))" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92"/>
            <polygon fill="hsl(var(--primary))" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97"/>
            <polygon fill="hsl(var(--primary))" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67"/>
          </svg>
          <svg className="absolute inset-0 w-48 h-48" viewBox="0 0 91.33 92.41" style={{ transform: 'translate(-3px, 2px)', opacity: 0.3, filter: 'hue-rotate(-20deg)' }}>
            <polygon fill="hsl(var(--destructive))" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92"/>
            <polygon fill="hsl(var(--destructive))" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97"/>
            <polygon fill="hsl(var(--destructive))" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67"/>
          </svg>
          <svg className="absolute inset-0 w-48 h-48" viewBox="0 0 91.33 92.41" style={{ opacity: 0.7 }}>
            <polygon fill="hsl(var(--primary))" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92"/>
            <polygon fill="hsl(var(--primary))" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97"/>
            <polygon fill="hsl(var(--primary))" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67"/>
          </svg>
        </div>

        <h1 className="text-8xl md:text-9xl font-black text-primary tracking-tighter leading-none mb-4">500</h1>
        <p className="text-xl md:text-2xl font-semibold text-primary/80 mb-2">Error interno del servidor</p>
        <p className="text-base text-primary/50 mb-4 max-w-sm">
          Algo salio mal de nuestro lado. Estamos trabajando para solucionarlo lo antes posible.
        </p>

        {requestId && (
          <p className="mb-8 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary/70">
            ID de incidente: <span className="font-mono font-bold">{requestId}</span>
          </p>
        )}

        {isDev && errorPayload && (
          <div className="mb-8 w-full max-w-xl rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-left text-xs text-amber-900">
            <p className="font-bold uppercase tracking-wide">Detalle tecnico (solo desarrollo)</p>
            <p className="mt-2 font-mono break-all">Status: {String(errorPayload.status || 500)}</p>
            {errorPayload.method && <p className="font-mono break-all">Metodo: {errorPayload.method}</p>}
            {errorPayload.url && <p className="font-mono break-all">URL: {errorPayload.url}</p>}
            {errorPayload.message && <p className="font-mono break-all">Mensaje: {errorPayload.message}</p>}
            {errorPayload.timestamp && <p className="font-mono break-all">Fecha: {errorPayload.timestamp}</p>}
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          Volver atras
        </button>

        <img src={habiooLogoColor} alt="Habioo" className="mt-16 h-8 opacity-40" />
      </div>
    </div>
  );
};

export default Error500;
