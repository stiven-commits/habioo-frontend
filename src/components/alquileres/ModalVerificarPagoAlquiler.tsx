import { useMemo, useState, type FC } from 'react';
import ModalBase from '../ui/ModalBase';
import { Copy, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { useDialog } from '../ui/DialogProvider';

type EstadoAccion = 'RECHAZADA' | 'CONFIRMADA';

interface SolicitudVerificacion {
  id: number;
  lugar: string;
  fecha_alquiler: string;
  monto_total_usd: number | string;
  monto_bs_pagado: number | string;
  tasa_cambio: number | string;
  referencia: string;
  comprobante_url?: string | null;
  banco_destino_nombre?: string | null;
}

interface ModalVerificarPagoAlquilerProps {
  isOpen: boolean;
  onClose: () => void;
  solicitud: SolicitudVerificacion | null;
  onSuccess: () => void;
  readOnly?: boolean;
}

interface UpdateEstadoResponse {
  status: 'success' | 'error';
  message?: string;
}

const formatUsd = (value: number | string): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatBs = (value: number | string): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseLocaleNumber = (value: number | string): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (raw.includes(',')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTasa = (value: number | string): string => {
  const safe = parseLocaleNumber(value);
  return safe.toLocaleString('es-VE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const formatDateVe = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const resolveComprobanteUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const isPdfFile = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(url);
};

const toApiEstado = (estado: EstadoAccion): 'Rechazada' | 'Confirmada' => {
  return estado === 'RECHAZADA' ? 'Rechazada' : 'Confirmada';
};

const ModalVerificarPagoAlquiler: FC<ModalVerificarPagoAlquilerProps> = ({
  isOpen,
  onClose,
  solicitud,
  onSuccess,
  readOnly = false,
}) => {
  const { showAlert } = useDialog();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const comprobanteUrl = useMemo<string>(() => resolveComprobanteUrl(solicitud?.comprobante_url), [solicitud?.comprobante_url]);
  const showPdf = useMemo<boolean>(() => isPdfFile(solicitud?.comprobante_url), [solicitud?.comprobante_url]);
  const montoBsReportado = useMemo<number>(() => parseLocaleNumber(solicitud?.monto_bs_pagado ?? 0), [solicitud?.monto_bs_pagado]);
  const tasaCambio = useMemo<number>(() => parseLocaleNumber(solicitud?.tasa_cambio ?? 0), [solicitud?.tasa_cambio]);
  const equivalenteUsd = useMemo<number>(() => {
    if (tasaCambio <= 0) return 0;
    return montoBsReportado / tasaCambio;
  }, [montoBsReportado, tasaCambio]);

  const copyReferencia = async (): Promise<void> => {
    if (!solicitud?.referencia) return;
    try {
      await navigator.clipboard.writeText(solicitud.referencia);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const procesarPago = async (estado: EstadoAccion): Promise<void> => {
    if (!solicitud || isLoading) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const isConfirm = estado === 'CONFIRMADA';
      const response = await fetch(
        isConfirm
          ? `${API_BASE_URL}/alquileres/reservaciones/${solicitud.id}/aprobar-pago`
          : `${API_BASE_URL}/alquileres/reservaciones/${solicitud.id}/estado`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: isConfirm ? JSON.stringify({}) : JSON.stringify({ estado: toApiEstado(estado) }),
        }
      );
      const result = (await response.json()) as UpdateEstadoResponse;

      if (!response.ok || result.status !== 'success') {
        await showAlert({
          title: 'No se pudo procesar',
          message: result.message || 'Ocurrió un error al procesar el pago.',
          confirmText: 'Aceptar',
          variant: 'warning',
        });
        return;
      }

      await showAlert({
        title: 'Proceso completado',
        message: estado === 'CONFIRMADA' ? 'Pago confirmado correctamente.' : 'Pago rechazado correctamente.',
        confirmText: 'Aceptar',
        variant: 'success',
      });
      onSuccess();
      onClose();
    } catch {
      await showAlert({
        title: 'Error de conexión',
        message: 'No fue posible procesar el pago en este momento.',
        confirmText: 'Aceptar',
        variant: 'danger',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !solicitud) return null;

  return (
    <ModalBase onClose={onClose} title={`Verificar Pago - ${solicitud.lugar}`} helpTooltip="Este modal es para validar o rechazar pagos reportados, revisar soportes y dejar observaciones de verificacion." subtitle="Revisión y validación del pago reportado." maxWidth="max-w-5xl" disableClose={isLoading}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha del evento</p>
                <p className="text-base font-bold text-gray-900 dark:text-white">{formatDateVe(solicitud.fecha_alquiler)}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Total esperado</p>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">${formatUsd(solicitud.monto_total_usd)} USD</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto reportado</p>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  Bs {formatBs(montoBsReportado)} <span className="text-gray-500 dark:text-gray-400">(Tasa: {formatTasa(tasaCambio)})</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Equivalente: ${formatUsd(equivalenteUsd)} USD
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Banco destino</p>
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{solicitud.banco_destino_nombre || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Nro. Referencia</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-wide">{solicitud.referencia || 'N/A'}</p>
                  {!!solicitud.referencia && (
                    <button
                      type="button"
                      onClick={() => void copyReferencia()}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Copiar referencia"
                    >
                      <Copy size={14} />
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Comprobante</p>
              {!comprobanteUrl && (
                <div className="min-h-[260px] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center">
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Sin comprobante adjunto</p>
                </div>
              )}

              {!!comprobanteUrl && showPdf && (
                <div className="min-h-[260px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center justify-center">
                  <a
                    href={comprobanteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Ver comprobante PDF
                  </a>
                </div>
              )}

              {!!comprobanteUrl && !showPdf && (
                <a href={comprobanteUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img src={comprobanteUrl} alt="Comprobante de pago" className="w-full h-[320px] object-contain bg-white dark:bg-gray-900" />
                </a>
              )}
            </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            {readOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void procesarPago('RECHAZADA')}
                  className="px-5 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 bg-white dark:bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors disabled:opacity-60"
                >
                  {isLoading ? 'Procesando...' : 'Rechazar Pago'}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void procesarPago('CONFIRMADA')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-60"
                >
                  {isLoading ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </>
            )}
      </div>
    </ModalBase>
  );
};

export default ModalVerificarPagoAlquiler;
