import { useCallback, useEffect, useState, type FC } from 'react';
import { DollarSign, MapPin, Pencil, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ModalNuevoAlquiler from '../components/alquileres/ModalNuevoAlquiler';
import VistaSolicitudesAlquiler from '../components/alquileres/VistaSolicitudesAlquiler';
import { API_BASE_URL } from '../config/api';

interface Alquiler {
  id: number;
  nombre: string;
  descripcion: string | null;
  costo_usd: string | number;
  deposito_usd: string | number;
  activo: boolean;
}

interface AlquileresResponse {
  status: string;
  data?: Alquiler[];
  message?: string;
}

type AlquilerTab = 'espacios' | 'solicitudes';

const toNumber = (value: string | number | null | undefined): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const formatUsd = (value: string | number | null | undefined): string => {
  return toNumber(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const VistaAlquileres: FC = () => {
  const [activeTab, setActiveTab] = useState<AlquilerTab>('espacios');
  const [alquileres, setAlquileres] = useState<Alquiler[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAlquiler, setEditingAlquiler] = useState<Alquiler | null>(null);
  const [updatingEstadoId, setUpdatingEstadoId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  const fetchAlquileres = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: AlquileresResponse = (await response.json()) as AlquileresResponse;

      if (!response.ok || data.status !== 'success') {
        setAlquileres([]);
        setError(data.message || 'No se pudieron cargar los alquileres.');
        return;
      }

      setAlquileres(Array.isArray(data.data) ? data.data : []);
    } catch {
      setAlquileres([]);
      setError('No se pudieron cargar los alquileres por un error de conexión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlquileres();
  }, [fetchAlquileres]);

  const toggleAmenidadEstado = async (item: Alquiler): Promise<void> => {
    if (updatingEstadoId !== null) return;
    const nextActivo = !item.activo;
    setUpdatingEstadoId(item.id);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres/${item.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activo: nextActivo }),
      });
      const data: AlquileresResponse = (await response.json()) as AlquileresResponse;
      if (!response.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo actualizar el estado del alquiler.');
        return;
      }

      setAlquileres((prev) => prev.map((row) => (row.id === item.id ? { ...row, activo: nextActivo } : row)));
    } catch {
      setError('No se pudo actualizar el estado del alquiler por un error de conexión.');
    } finally {
      setUpdatingEstadoId(null);
    }
  };

  const openCreateModal = (): void => {
    setEditingAlquiler(null);
    setIsModalOpen(true);
  };

  const renderEspacios = (): JSX.Element => (
    <>
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-donezo-card-dark p-5 shadow-sm"
              aria-hidden="true"
            >
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-4 h-8 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!isLoading && !error && alquileres.length === 0 && (
        <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-900 p-10 text-center shadow-sm">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <MapPin size={24} />
          </div>
          <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Aún no hay espacios registrados</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Crea el primer alquiler para habilitar reservaciones y control de cobros de amenidades.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 transition-colors"
          >
            <Plus size={16} />
            Crear primer alquiler
          </button>
        </div>
      )}

      {!isLoading && !error && alquileres.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {alquileres.map((item) => (
            <article
              key={item.id}
              className="group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-donezo-card-dark p-5 shadow-sm hover:shadow-md transition-all"
            >
              <header className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{item.nombre}</h3>
                <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {item.activo ? 'Activo' : 'Inactivo'}
                </span>
              </header>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Costo por uso</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${formatUsd(item.costo_usd)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">USD</span>
                  </p>
                </div>
              </div>

              {toNumber(item.deposito_usd) > 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Depósito: <span className="font-bold text-slate-700 dark:text-slate-200">${formatUsd(item.deposito_usd)} USD</span>
                </p>
              )}

              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-h-20 overflow-hidden">
                <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0">
                  <ReactMarkdown>{item.descripcion?.trim() || 'Sin reglamento registrado.'}</ReactMarkdown>
                </div>
              </div>

              <footer className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlquiler(item);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Pencil size={15} />
                    Editar
                  </button>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.activo}
                      disabled={updatingEstadoId === item.id}
                      onChange={() => {
                        void toggleAmenidadEstado(item);
                      }}
                      className="sr-only peer"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 dark:bg-slate-700" aria-hidden="true">
                      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {updatingEstadoId === item.id ? 'Actualizando...' : item.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-donezo-card-dark p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Administra espacios reservables y gestiona solicitudes de vecinos.
            </p>
          </div>
          {activeTab === 'espacios' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 transition-colors shadow-[0_14px_30px_-14px_rgba(16,185,129,0.8)]"
            >
              <Plus size={18} />
              Nuevo Alquiler
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('espacios')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === 'espacios'
                ? 'bg-donezo-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Espacios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('solicitudes')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === 'solicitudes'
                ? 'bg-donezo-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Ver Solicitudes
          </button>
        </div>
      </div>

      {activeTab === 'espacios' ? renderEspacios() : <VistaSolicitudesAlquiler />}

      <ModalNuevoAlquiler
        isOpen={isModalOpen}
        mode={editingAlquiler ? 'edit' : 'create'}
        initialData={editingAlquiler}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAlquiler(null);
        }}
        onSuccess={() => {
          void fetchAlquileres();
          setEditingAlquiler(null);
        }}
      />
    </div>
  );
};

export default VistaAlquileres;
