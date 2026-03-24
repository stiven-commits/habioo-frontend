import { useMemo, useState, type FC, type FormEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../../config/api';
import { useDialog } from '../ui/DialogProvider';
import 'react-datepicker/dist/react-datepicker.css';

interface AlquilerDisponible {
  id: number;
  nombre: string;
  descripcion: string | null;
  costo_usd: number | string;
  deposito_usd: number | string;
  activo: boolean;
}

interface ModalReservarAlquilerProps {
  alquiler: AlquilerDisponible | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReservaResponse {
  status: 'success' | 'error';
  message?: string;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatUsd = (value: unknown): string =>
  toNumber(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((v) => Number(v));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ModalReservarAlquiler: FC<ModalReservarAlquilerProps> = ({ isOpen, onClose, alquiler, onSuccess }) => {
  const [fechaReserva, setFechaReserva] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { showAlert } = useDialog();

  const fechaMinima = useMemo<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const costo = useMemo<number>(() => toNumber(alquiler?.costo_usd), [alquiler?.costo_usd]);
  const deposito = useMemo<number>(() => toNumber(alquiler?.deposito_usd), [alquiler?.deposito_usd]);
  const total = useMemo<number>(() => costo + deposito, [costo, deposito]);

  const handleClose = (): void => {
    if (isLoading) return;
    setFechaReserva('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!alquiler || isLoading) return;

    if (!fechaReserva) {
      setError('Selecciona una fecha para continuar.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch(`${API_BASE_URL}/alquileres/reservar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amenidad_id: alquiler.id,
          fecha_reserva: fechaReserva,
        }),
      });

      const data: ReservaResponse = (await response.json()) as ReservaResponse;
      const backendMessage = String(data.message || '');
      const isSolvenciaError = response.status === 403 || /d[ií]a|solvente/i.test(backendMessage);

      if (!response.ok || data.status !== 'success') {
        if (isSolvenciaError) {
          setError('❌ No puedes reservar: Debes estar al día con tus pagos del condominio.');
        } else {
          setError(backendMessage || 'No se pudo enviar la solicitud de reserva.');
        }
        return;
      }

      await showAlert({
        title: 'Reserva enviada',
        message: 'Solicitud enviada a la Junta.',
        confirmText: 'Aceptar',
        variant: 'success',
      });
      setFechaReserva('');
      onSuccess();
      onClose();
    } catch {
      setError('No se pudo enviar la solicitud por un error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!alquiler) return null;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="w-full max-w-lg rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Reservar {alquiler.nombre}</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="h-10 w-10 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-60"
                aria-label="Cerrar modal"
              >
                X
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumen de pago</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Costo: <span className="font-black text-gray-900 dark:text-white">${formatUsd(costo)} USD</span>
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Depósito: <span className="font-black text-gray-900 dark:text-white">${formatUsd(deposito)} USD</span>
              </p>
              <p className="pt-1 border-t border-gray-200 dark:border-gray-700 text-base font-black text-emerald-700 dark:text-emerald-400">
                Total a pagar: ${formatUsd(total)} USD
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Fecha del evento *</label>
              <DatePicker
                selected={ymdToDate(fechaReserva)}
                onChange={(date: Date | null) => setFechaReserva(dateToYmd(date))}
                minDate={fechaMinima}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Selecciona fecha (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                icon={<CalendarDays size={16} className="text-gray-500 dark:text-gray-400" />}
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 pr-10 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {isLoading ? 'Enviando...' : 'Confirmar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalReservarAlquiler;
