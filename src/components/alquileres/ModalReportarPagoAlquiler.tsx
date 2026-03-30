import { useEffect, useMemo, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import ModalBase from '../ui/ModalBase';
import { CalendarDays, UploadCloud } from 'lucide-react';
import DatePicker from '../ui/DatePicker';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../../config/api';
import { useDialog } from '../ui/DialogProvider';

interface ReservacionPago {
  id: number;
  amenidad_nombre: string;
  condominio_id?: number;
  monto_total_usd: number | string;
  monto_pagado_usd?: number | string | null;
  deposito_usd?: number | string;
}

interface ModalReportarPagoAlquilerProps {
  isOpen: boolean;
  onClose: () => void;
  reservacion: ReservacionPago | null;
  onSuccess: () => void;
}

interface CuentaPrincipal {
  id: number;
  nombre_banco?: string | null;
  apodo?: string | null;
  tipo?: string | null;
}

interface CuentaPrincipalResponse {
  status?: string;
  data?: CuentaPrincipal;
  message?: string;
}

interface PagoResponse {
  status?: 'success' | 'error';
  message?: string;
}

interface BcvResponse {
  promedio?: number | string;
}

const getTodayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toSingleDate = (value: Date | Date[] | null): Date | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

const parseInputNumber = (value: string): number => {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const formatInputNumber = (value: string, maxDecimals = 2): string => {
  let raw = value.replace(/[^0-9,]/g, '');
  const parts = raw.split(',');
  if (parts.length > 2) raw = `${parts[0]},${parts.slice(1).join('')}`;
  let [intPart = '', decimalPart] = raw.split(',');
  if (intPart) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimalPart !== undefined) return `${intPart},${decimalPart.slice(0, maxDecimals)}`;
  return intPart;
};

const formatMoneyVe = (value: number | string): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toBackendLocaleNumber = (value: string): string => {
  if (!value) return '0';
  return value.replace(/\./g, '').trim();
};

const ModalReportarPagoAlquiler: FC<ModalReportarPagoAlquilerProps> = ({
  isOpen,
  onClose,
  reservacion,
  onSuccess,
}) => {
  const { showAlert } = useDialog();
  const [tasaCambio, setTasaCambio] = useState<string>('');
  const [montoBs, setMontoBs] = useState<string>('');
  const [bancoDestinoId, setBancoDestinoId] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  const [fechaPago, setFechaPago] = useState<string>(getTodayYmd());
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingBcv, setIsLoadingBcv] = useState<boolean>(true);
  const [cuentaPrincipal, setCuentaPrincipal] = useState<CuentaPrincipal | null>(null);
  const [error, setError] = useState<string>('');

  const montoUsdTotal = useMemo<number>(() => Number(reservacion?.monto_total_usd) || 0, [reservacion?.monto_total_usd]);
  const montoPagadoUsd = useMemo<number>(() => Number(reservacion?.monto_pagado_usd) || 0, [reservacion?.monto_pagado_usd]);
  const restanteUsd = useMemo<number>(() => Math.max(0, montoUsdTotal - montoPagadoUsd), [montoUsdTotal, montoPagadoUsd]);
  const depositoUsd = useMemo<number>(() => Number(reservacion?.deposito_usd) || 0, [reservacion?.deposito_usd]);
  const esPrimerPago = useMemo<boolean>(() => montoPagadoUsd <= 0.000001, [montoPagadoUsd]);
  const minimoUsd = useMemo<number>(() => {
    if (!esPrimerPago) return 0;
    if (depositoUsd > 0) return Math.min(depositoUsd, restanteUsd);
    return 0;
  }, [esPrimerPago, depositoUsd, restanteUsd]);
  const tasaNum = useMemo<number>(() => parseInputNumber(tasaCambio), [tasaCambio]);
  const montoBsNum = useMemo<number>(() => parseInputNumber(montoBs), [montoBs]);
  const minimoBs = useMemo<number>(() => (tasaNum > 0 ? minimoUsd * tasaNum : 0), [minimoUsd, tasaNum]);
  const equivalenteUsd = useMemo<number>(() => (tasaNum > 0 ? montoBsNum / tasaNum : 0), [montoBsNum, tasaNum]);

  useEffect(() => {
    if (!isOpen) return;
    setFechaPago(getTodayYmd());
    setReferencia('');
    setTasaCambio('');
    setMontoBs('');
    setBancoDestinoId('');
    setComprobante(null);
    setError('');
    setIsLoadingBcv(true);
    setCuentaPrincipal(null);
  }, [isOpen, reservacion?.id, reservacion?.condominio_id]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPrincipal = async (): Promise<void> => {
      try {
        if (!reservacion?.condominio_id) {
          setCuentaPrincipal(null);
          setBancoDestinoId('');
          return;
        }
        const token = localStorage.getItem('habioo_token');
        const response = await fetch(`${API_BASE_URL}/api/propietario/cuenta-principal/${reservacion.condominio_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as CuentaPrincipalResponse;
        if (!response.ok || data.status !== 'success' || !data.data) {
          setCuentaPrincipal(null);
          setBancoDestinoId('');
          return;
        }
        setCuentaPrincipal(data.data);
        setBancoDestinoId(String(data.data.id));
      } catch {
        setCuentaPrincipal(null);
        setBancoDestinoId('');
      }
    };
    void fetchPrincipal();
  }, [isOpen, reservacion?.condominio_id]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchBcv = async (): Promise<void> => {
      try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!response.ok) throw new Error('BCV error');
        const json = (await response.json()) as BcvResponse;
        const promedio = Number.parseFloat(String(json.promedio ?? '').replace(',', '.'));
        if (!Number.isFinite(promedio) || promedio <= 0) throw new Error('BCV invalido');
        const tasaRedondeada = Number(promedio.toFixed(3));
        const tasaFormatted = tasaRedondeada.toFixed(3).replace('.', ',');
        setTasaCambio(tasaFormatted);
        const restanteBsAuto = restanteUsd * tasaRedondeada;
        setMontoBs(restanteBsAuto.toFixed(2).replace('.', ','));
      } catch {
        setError('No se pudo obtener la tasa BCV automática. Intenta nuevamente en unos segundos.');
      } finally {
        setIsLoadingBcv(false);
      }
    };
    void fetchBcv();
  }, [isOpen, restanteUsd]);

  const handleMontoBsChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setMontoBs(formatInputNumber(e.target.value, 2));
  };

  const handleComprobanteChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0] ?? null;
    setComprobante(file);
  };

  const bancoDestinoLabel = useMemo<string>(() => {
    if (!cuentaPrincipal) return 'Cuenta principal no disponible';
    const banco = cuentaPrincipal.nombre_banco || 'Banco';
    const apodo = cuentaPrincipal.apodo ? ` (${cuentaPrincipal.apodo})` : '';
    return `${banco}${apodo}`;
  }, [cuentaPrincipal]);

  const isSubmitDisabled =
    isLoading ||
    isLoadingBcv ||
    !reservacion ||
    !referencia.trim() ||
    !comprobante ||
    !fechaPago ||
    !bancoDestinoId ||
    montoBsNum <= 0 ||
    tasaNum <= 0 ||
    (minimoBs > 0 && montoBsNum < minimoBs);

  const handleClose = (): void => {
    if (isLoading) return;
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!reservacion) return;

    if (minimoBs > 0 && montoBsNum < minimoBs) {
      setError(`El primer pago debe ser al menos Bs ${formatMoneyVe(minimoBs)} (depósito mínimo).`);
      return;
    }

    if (isSubmitDisabled) {
      setError('Completa referencia, fecha, monto válido y comprobante para enviar el reporte.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('habioo_token');
      const formData = new FormData();
      formData.append('monto_bs_pagado', toBackendLocaleNumber(montoBs));
      formData.append('tasa_cambio', toBackendLocaleNumber(tasaCambio));
      formData.append('referencia', referencia.trim());
      formData.append('fecha_pago', fechaPago);
      formData.append('banco_destino_id', bancoDestinoId);
      if (comprobante) formData.append('comprobante', comprobante);

      const response = await fetch(`${API_BASE_URL}/alquileres/reservaciones/${reservacion.id}/pagar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = (await response.json()) as PagoResponse;
      if (!response.ok || result.status !== 'success') {
        setError(result.message || 'No se pudo reportar el pago.');
        return;
      }

      await showAlert({
        title: 'Pago reportado',
        message: 'Pago reportado exitosamente.',
        confirmText: 'Aceptar',
        variant: 'success',
      });
      onSuccess();
      onClose();
    } catch {
      setError('Error de conexión al reportar el pago.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !reservacion) return null;

  return (
    <ModalBase onClose={handleClose} title={`Reportar Pago - ${reservacion.amenidad_nombre}`} subtitle="Registra el soporte del pago para validación de la Junta." maxWidth="max-w-3xl" disableClose={isLoading}>
      <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-300">Resumen</p>
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                Monto Restante: ${formatMoneyVe(restanteUsd)} USD
              </p>
              {esPrimerPago && depositoUsd > 0 && (
                <p className="mt-2 text-sm font-semibold text-blue-700/90 dark:text-blue-200">
                  Primer pago mínimo: depósito ${formatMoneyVe(depositoUsd)} USD
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Tasa de Cambio *
                </label>
                <input
                  type="text"
                  value={tasaCambio}
                  readOnly
                  placeholder={isLoadingBcv ? 'Cargando BCV...' : 'Tasa BCV'}
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 outline-none dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Monto en Bs *
                </label>
                <input
                  type="text"
                  value={montoBs}
                  onChange={handleMontoBsChange}
                  placeholder="0,00"
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                  required
                />
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Equivale a: ${formatMoneyVe(equivalenteUsd)} USD
                  {minimoBs > 0 ? ` · mínimo Bs ${formatMoneyVe(minimoBs)}` : ''}
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Banco Destino *
                </label>
                <input
                  type="text"
                  value={bancoDestinoLabel}
                  readOnly
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 outline-none dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Número de Referencia *
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
                  placeholder="Ej: 45671239"
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Fecha de Pago *
                </label>
                <DatePicker
                  selected={ymdToDate(fechaPago)}
                  onChange={(date: Date | Date[] | null) => setFechaPago(dateToYmd(toSingleDate(date)))}
                  dateFormat="dd/MM/yyyy"
                  locale={es}
                  maxDate={new Date()}
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
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Comprobante *
              </label>
              <label className="w-full min-h-28 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-4 py-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-donezo-primary/60 transition-colors">
                <UploadCloud size={20} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {comprobante ? comprobante.name : 'Seleccionar captura o comprobante'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG o PDF</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleComprobanteChange}
                  required
                />
              </label>
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
                disabled={isSubmitDisabled}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
      </form>
    </ModalBase>
  );
};

export default ModalReportarPagoAlquiler;


