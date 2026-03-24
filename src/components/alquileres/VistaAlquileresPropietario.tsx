import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../../config/api';
import ModalReservarAlquiler from './ModalReservarAlquiler';

interface AlquilerDisponible {
  id: number;
  nombre: string;
  descripcion: string | null;
  costo_usd: number | string;
  deposito_usd: number | string;
  activo: boolean;
}

interface GetAlquileresResponse {
  status: 'success' | 'error';
  data?: AlquilerDisponible[];
  message?: string;
}

const usdFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatUsd = (value: unknown): string => usdFormatter.format(toNumber(value));

const VistaAlquileresPropietario: FC = () => {
  const [alquileres, setAlquileres] = useState<AlquilerDisponible[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alquilerSeleccionado, setAlquilerSeleccionado] = useState<AlquilerDisponible | null>(null);
  const [error, setError] = useState<string>('');

  const fetchAlquileres = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result: GetAlquileresResponse = (await response.json()) as GetAlquileresResponse;

      if (!response.ok || result.status !== 'success') {
        setAlquileres([]);
        setError(result.message || 'No se pudieron cargar los espacios disponibles.');
        return;
      }

      const rows = Array.isArray(result.data) ? result.data : [];
      setAlquileres(rows.filter((item) => Boolean(item.activo)));
    } catch {
      setAlquileres([]);
      setError('Ocurrió un error cargando los espacios de alquiler.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlquileres();
  }, [fetchAlquileres]);

  const hasData = useMemo(() => alquileres.length > 0, [alquileres.length]);

  return (
    <section className="space-y-6 animate-fadeIn">
      <header className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-6 shadow-sm">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Alquiler de Espacios</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Consulta áreas disponibles, revisa reglamentos y solicita tu reserva.
        </p>
      </header>

      {isLoading && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-6 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <CalendarDays size={18} className="animate-pulse" />
            Cargando espacios disponibles...
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isLoading && !error && !hasData && (
        <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-8 text-center">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            No hay áreas disponibles para reservar en este momento.
          </p>
        </div>
      )}

      {!isLoading && !error && hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alquileres.map((alquiler) => (
            <article
              key={alquiler.id}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <header className="mb-4">
                <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{alquiler.nombre}</h3>
              </header>

              <div className="space-y-2">
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  ${formatUsd(alquiler.costo_usd)} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">USD</span>
                </p>
                {toNumber(alquiler.deposito_usd) > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Depósito en garantía:{' '}
                    <span className="font-bold text-gray-900 dark:text-white">${formatUsd(alquiler.deposito_usd)} USD</span>
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3 max-h-36 overflow-y-auto">
                <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap [&_p]:my-0 [&_ul]:my-2 [&_ol]:my-2">
                  <ReactMarkdown>{alquiler.descripcion?.trim() || 'Sin reglamento registrado.'}</ReactMarkdown>
                </div>
              </div>

              <footer className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setAlquilerSeleccionado(alquiler)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 transition-colors"
                >
                  <CalendarDays size={16} />
                  Solicitar Reserva
                </button>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <Info size={12} />
                  La reserva quedará en revisión de administración.
                </p>
              </footer>
            </article>
          ))}
        </div>
      )}

      <ModalReservarAlquiler
        alquiler={alquilerSeleccionado}
        isOpen={Boolean(alquilerSeleccionado)}
        onClose={() => setAlquilerSeleccionado(null)}
        onSuccess={() => {
          setAlquilerSeleccionado(null);
          void fetchAlquileres();
        }}
      />
    </section>
  );
};

export default VistaAlquileresPropietario;
