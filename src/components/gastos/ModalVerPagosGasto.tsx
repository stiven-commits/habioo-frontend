import { useEffect, useMemo, useState } from 'react';
import ModalBase from '../ui/ModalBase';
import DataTable from '../ui/DataTable';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';
import { formatDateVE } from '../../utils/datetime';

interface PagoDetalle {
  id: string;
  fondo_id: number | null;
  fondo_nombre: string | null;
  banco_nombre: string | null;
  monto_bs: string | number | null;
  tasa_cambio: string | number | null;
  monto_usd: string | number | null;
  referencia: string | null;
  fecha_pago: string | null;
  fecha_registro: string | null;
  nota: string | null;
  es_ajuste_historico?: boolean | null;
}

interface PagosDetalleResponse {
  status: string;
  pagos?: PagoDetalle[];
  message?: string;
  error?: string;
}

interface GastoHeader {
  gasto_id: number | string;
  proveedor?: string;
  concepto?: string;
}

interface ModalVerPagosGastoProps {
  isOpen: boolean;
  onClose: () => void;
  gasto: GastoHeader | null;
}

const toNumber = (value: string | number | null | undefined): number => parseFloat(String(value ?? 0)) || 0;

const formatFecha = (value?: string | null): string => formatDateVE(value);

const ModalVerPagosGasto: React.FC<ModalVerPagosGastoProps> = ({ isOpen, onClose, gasto }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pagos, setPagos] = useState<PagoDetalle[]>([]);

  useEffect(() => {
    if (!isOpen || !gasto?.gasto_id) return;
    const controller = new AbortController();

    const run = async (): Promise<void> => {
      setLoading(true);
      setErrorMsg('');
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/pagos-proveedores/gasto/${gasto.gasto_id}/detalles`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        const data: PagosDetalleResponse = await res.json();
        if (!res.ok || data.status !== 'success') {
          throw new Error(data.message || data.error || 'No se pudieron cargar los pagos.');
        }
        setPagos(Array.isArray(data.pagos) ? data.pagos : []);
      } catch (error: unknown) {
        if ((error as Error)?.name === 'AbortError') return;
        setErrorMsg(error instanceof Error ? error.message : 'No se pudieron cargar los pagos.');
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isOpen, gasto?.gasto_id]);

  const totalUsd = useMemo<number>(() => pagos.reduce((acc, p) => acc + toNumber(p.monto_usd), 0), [pagos]);

  if (!isOpen || !gasto) return null;

  return (
    <ModalBase onClose={onClose} title="Pagos del gasto" subtitle={<>#{gasto.gasto_id} · {gasto.proveedor || 'Proveedor'} · {gasto.concepto || 'Sin concepto'}</>} maxWidth="max-w-6xl">
      <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-600 dark:text-slate-200">Total registrado (USD)</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">${formatMoney(totalUsd)}</span>
            </div>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-300">Cargando pagos...</p>
          ) : errorMsg ? (
            <p className="py-6 text-center text-sm font-semibold text-red-500">{errorMsg}</p>
          ) : pagos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-300">No hay pagos registrados para este gasto.</p>
          ) : (
            <DataTable<PagoDetalle>
              columns={[
                {
                  key: 'fondo',
                  header: 'Fondo / Banco',
                  render: (pago) => (
                    <>
                      <div className="font-semibold text-slate-700 dark:text-slate-100">{pago.fondo_nombre || 'Sin fondo / tránsito'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-300">{pago.banco_nombre || 'Banco N/A'}</div>
                      {Boolean(pago.es_ajuste_historico) && (
                        <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Histórico
                        </span>
                      )}
                    </>
                  ),
                },
                { key: 'monto_bs', header: 'Monto (Bs)', className: 'font-mono text-slate-700 dark:text-slate-100', render: (pago) => toNumber(pago.monto_bs) > 0 ? `Bs ${formatMoney(pago.monto_bs || 0)}` : '-' },
                { key: 'tasa', header: 'Tasa', className: 'font-mono text-slate-700 dark:text-slate-100', render: (pago) => toNumber(pago.tasa_cambio) > 0 ? formatMoney(pago.tasa_cambio || 0) : '-' },
                { key: 'monto_usd', header: 'Monto (USD)', className: 'font-mono font-semibold text-emerald-600 dark:text-emerald-400', render: (pago) => `$${formatMoney(pago.monto_usd || 0)}` },
                { key: 'referencia', header: 'Referencia', className: 'font-mono text-slate-700 dark:text-slate-100', render: (pago) => pago.referencia || 'N/A' },
                { key: 'fecha_registro', header: 'Fecha registro', className: 'text-slate-700 dark:text-slate-100', render: (pago) => formatFecha(pago.fecha_registro) },
                { key: 'fecha_pago', header: 'Fecha pago', className: 'text-slate-700 dark:text-slate-100', render: (pago) => formatFecha(pago.fecha_pago) },
                { key: 'nota', header: 'Nota', className: 'text-slate-600 dark:text-slate-300', render: (pago) => pago.nota || '-' },
              ]}
              data={pagos}
              keyExtractor={(pago) => pago.id}
              rowClassName="border-b border-slate-100 dark:border-slate-800 align-top"
            />
          )}
      </div>
    </ModalBase>
  );
};

export default ModalVerPagosGasto;
