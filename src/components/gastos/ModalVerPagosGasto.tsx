import React, { useEffect, useMemo, useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Pagos del gasto</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              #{gasto.gasto_id} · {gasto.proveedor || 'Proveedor'} · {gasto.concepto || 'Sin concepto'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl font-bold leading-none text-slate-500 transition hover:bg-slate-100 hover:text-red-500 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-6">
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    <th className="p-3 font-bold">Fondo / Banco</th>
                    <th className="p-3 font-bold">Monto (Bs)</th>
                    <th className="p-3 font-bold">Tasa</th>
                    <th className="p-3 font-bold">Monto (USD)</th>
                    <th className="p-3 font-bold">Referencia</th>
                    <th className="p-3 font-bold">Fecha registro</th>
                    <th className="p-3 font-bold">Fecha pago</th>
                    <th className="p-3 font-bold">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((pago: PagoDetalle) => (
                    <tr key={pago.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                      <td className="p-3 text-slate-700 dark:text-slate-100">
                        <div className="font-semibold">{pago.fondo_nombre || 'Sin fondo / tránsito'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-300">{pago.banco_nombre || 'Banco N/A'}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-100">
                        {toNumber(pago.monto_bs) > 0 ? `Bs ${formatMoney(pago.monto_bs || 0)}` : '-'}
                      </td>
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-100">
                        {toNumber(pago.tasa_cambio) > 0 ? formatMoney(pago.tasa_cambio || 0) : '-'}
                      </td>
                      <td className="p-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        ${formatMoney(pago.monto_usd || 0)}
                      </td>
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-100">{pago.referencia || 'N/A'}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-100">{formatFecha(pago.fecha_registro)}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-100">{formatFecha(pago.fecha_pago)}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{pago.nota || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalVerPagosGasto;
