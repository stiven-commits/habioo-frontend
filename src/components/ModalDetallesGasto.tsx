import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { formatMoney } from '../utils/currency';
import { formatDateVE } from '../utils/datetime';
import { API_BASE_URL } from '../config/api';
import ModalBase from './ui/ModalBase';
import DataTable from './ui/DataTable';

interface GastoDetalle {
  gasto_id?: number | string;
  proveedor: string;
  fecha_factura: string;
  fecha_registro: string;
  concepto: string;
  clasificacion?: string;
  nota?: string;
  tipo?: string;
  monto_bs: string | number;
  tasa_cambio: string | number;
  monto_total_usd: string | number;
  monto_pagado_proveedor_usd?: string | number;
  monto_recaudado_usd?: string | number;
  factura_img?: string;
  imagenes?: string[] | string;
}

interface ModalDetallesGastoProps {
  gasto: GastoDetalle | null;
  onClose: () => void;
}

interface PagoDetalle {
  id: string;
  pago_id?: number;
  inmueble: string | null;
  monto_usd: string | number | null;
  referencia: string | null;
  fecha_pago: string | null;
  fecha_registro: string | null;
  monto_bs?: string | number | null;
  tasa_cambio?: string | number | null;
  nota?: string | null;
  es_ajuste_historico?: boolean | null;
}

interface HistPagadoRow {
  fondo_id?: string | number;
  monto_usd?: string | number;
  monto_bs?: string | number;
  fecha_operacion?: string;
}

interface PagosDetalleResponse {
  status: string;
  pagos?: PagoDetalle[];
  message?: string;
  error?: string;
}

interface FondoLite {
  id: number | string;
  nombre: string;
}

interface FondosResponse {
  status: string;
  fondos?: FondoLite[];
}

const toNumber = (value: string | number | null | undefined): number => parseFloat(String(value ?? 0)) || 0;

const toLocaleNumber = (value: string | number | null | undefined): number => {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  let normalized = cleaned;
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    normalized = cleaned.split(thousandsSep).join('');
    if (decimalSep === ',') normalized = normalized.replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSoportes = (value: string[] | string | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [trimmed];
};

const ModalDetallesGasto: FC<ModalDetallesGastoProps> = ({ gasto, onClose }) => {
  const [loadingPagos, setLoadingPagos] = useState<boolean>(false);
  const [pagosError, setPagosError] = useState<string>('');
  const [pagosRecaudacion, setPagosRecaudacion] = useState<PagoDetalle[]>([]);
  const [currentPagePagos, setCurrentPagePagos] = useState<number>(1);
  const [fondosCatalogo, setFondosCatalogo] = useState<FondoLite[]>([]);
  const [showAllPagosHistoricos, setShowAllPagosHistoricos] = useState<boolean>(false);

  const isExtra = String(gasto?.tipo || '').trim().toLowerCase() === 'extra';
  const montoRecaudado = toNumber(gasto?.monto_recaudado_usd);
  const montoPagado = toNumber(gasto?.monto_pagado_proveedor_usd);

  const isPdf = (path: string): boolean => /\.pdf($|\?)/i.test(path);
  const getFileUrl = (path: string): string => {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE_URL}${path}`;
  };

  const soportesAdjuntos = normalizeSoportes(gasto?.imagenes);
  const notaRaw = String(gasto?.nota || '').trim();
  const cuotasHistoricasMatch = notaRaw.match(/\[hist\.cuotas:(\d+)\]/i);
  const pagoHistoricoMatch = notaRaw.match(/\[hist\.proveedor_usd:([0-9]+(?:\.[0-9]+)?)\]/i);
  const pagoHistoricoBsMatch = notaRaw.match(/\[hist\.proveedor_bs:([0-9]+(?:\.[0-9]+)?)\]/i);
  const pagadoRowsB64Match = notaRaw.match(/\[hist\.pagado_rows_b64:([A-Za-z0-9+/=_-]+)\]/i);
  const tasaHistoricaMatch = notaRaw.match(/\[hist\.tasa:([0-9]+(?:\.[0-9]+)?)\]/i);
  const cuotasHistoricas = cuotasHistoricasMatch?.[1] ? parseInt(cuotasHistoricasMatch[1], 10) : 0;
  const pagoHistoricoProveedorUsd = pagoHistoricoMatch?.[1] ? Number(pagoHistoricoMatch[1]) : 0;
  const pagoHistoricoProveedorBs = pagoHistoricoBsMatch?.[1] ? Number(pagoHistoricoBsMatch[1]) : 0;
  const tasaHistorica = tasaHistoricaMatch?.[1]
    ? Number(tasaHistoricaMatch[1])
    : toLocaleNumber(gasto?.tasa_cambio);
  const pagadoRowsHistoricos: HistPagadoRow[] = (() => {
    if (!pagadoRowsB64Match?.[1]) return [];
    try {
      const parsed = JSON.parse(atob(pagadoRowsB64Match[1]));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const pagosHistoricosPreview = showAllPagosHistoricos
    ? pagadoRowsHistoricos
    : pagadoRowsHistoricos.slice(0, 3);
  const notaLimpia = notaRaw
    .replace(/\s*\|\s*\[hist\.[^\]]+\]/gi, '')
    .replace(/\[hist\.[^\]]+\]/gi, '')
    .replace(/\s*\|\s*\|+/g, ' | ')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim();

  const totalPagosTablaUsd = useMemo<number>(
    () => pagosRecaudacion.reduce((acc, pago) => acc + toNumber(pago.monto_usd), 0),
    [pagosRecaudacion]
  );
  const ITEMS_PER_PAGE = 5;
  const totalPagesPagos = useMemo<number>(
    () => Math.max(1, Math.ceil(pagosRecaudacion.length / ITEMS_PER_PAGE)),
    [pagosRecaudacion.length]
  );
  const pagosPaginaActual = useMemo<PagoDetalle[]>(() => {
    const start = (currentPagePagos - 1) * ITEMS_PER_PAGE;
    return pagosRecaudacion.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPagePagos, pagosRecaudacion]);

  useEffect(() => {
    if (!isExtra || !gasto?.gasto_id) {
      setPagosRecaudacion([]);
      setPagosError('');
      return;
    }

    const controller = new AbortController();

    const run = async (): Promise<void> => {
      setLoadingPagos(true);
      setPagosError('');
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/pagos/recaudacion-extra/gasto/${gasto?.gasto_id}/detalles`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data: PagosDetalleResponse = await res.json();
        if (!res.ok || data.status !== 'success') {
          throw new Error(data.message || data.error || 'No se pudieron cargar los pagos vinculados al gasto.');
        }
        setPagosRecaudacion(Array.isArray(data.pagos) ? data.pagos : []);
      } catch (error: unknown) {
        if ((error as Error)?.name === 'AbortError') return;
        setPagosError(error instanceof Error ? error.message : 'No se pudieron cargar los pagos vinculados al gasto.');
      } finally {
        setLoadingPagos(false);
      }
    };

    run();
    return () => controller.abort();
  }, [gasto?.gasto_id, isExtra]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/fondos`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data: FondosResponse = await res.json();
        if (!res.ok || data.status !== 'success') return;
        setFondosCatalogo(Array.isArray(data.fondos) ? data.fondos : []);
      } catch (error: unknown) {
        if ((error as Error)?.name === 'AbortError') return;
      }
    };
    run();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setCurrentPagePagos(1);
  }, [gasto?.gasto_id, pagosRecaudacion.length]);

  useEffect(() => {
    setShowAllPagosHistoricos(false);
  }, [gasto?.gasto_id]);

  useEffect(() => {
    if (currentPagePagos > totalPagesPagos) {
      setCurrentPagePagos(totalPagesPagos);
    }
  }, [currentPagePagos, totalPagesPagos]);

  if (!gasto) return null;

  return (
    <ModalBase onClose={onClose} title="Inspeccion de Gasto" helpTooltip="Consulta el detalle completo del gasto: datos base, documentos, pagos asociados, origenes y movimientos relacionados." maxWidth={isExtra ? 'max-w-7xl' : 'max-w-2xl'}>
      <div className={`grid grid-cols-1 ${isExtra ? 'xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-6' : ''}`}>
        <div className="space-y-3 pt-1 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-3">
            <div>
              <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> <br />{gasto.proveedor}</p>
            </div>
            <div className="text-right">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Factura: <strong className="text-gray-800 dark:text-gray-300">{gasto.fecha_factura}</strong></span>
              <span className="block text-[10px] text-gray-400">Cargado el: {gasto.fecha_registro}</span>
            </div>
          </div>

          <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {gasto.concepto}</p>
          <p>
            <strong className="text-gray-800 dark:text-white">Etiqueta:</strong>{' '}
            {String(gasto.clasificacion || 'Variable') === 'Fijo' ? 'Gasto fijo' : 'Gasto variable'}
          </p>
          <p>
            <strong className="text-gray-800 dark:text-white">Notas:</strong>{' '}
            {notaLimpia ? notaLimpia : 'Sin notas'}
          </p>

          {(cuotasHistoricas > 0 || pagoHistoricoProveedorUsd > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="text-xs font-black uppercase tracking-wider">Contexto historico</p>
              <div className="mt-2 space-y-1 text-sm">
                {cuotasHistoricas > 0 && (
                  <p>
                    <strong>Cuotas ya transcurridas:</strong> {cuotasHistoricas}
                  </p>
                )}
                {pagoHistoricoProveedorUsd > 0 && (
                  <p>
                    <strong>Pago historico al proveedor:</strong> ${formatMoney(pagoHistoricoProveedorUsd)}
                  </p>
                )}
                {pagoHistoricoProveedorBs > 0 && (
                  <p>
                    <strong>Pago historico al proveedor (Bs):</strong> Bs {formatMoney(pagoHistoricoProveedorBs)}
                  </p>
                )}
                {pagadoRowsHistoricos.length > 0 && (
                  <div className="space-y-1">
                    {pagosHistoricosPreview.map((row, idx) => (
                      <p key={`hist-pagado-${idx}`}>
                        {(() => {
                          const montoBs = toLocaleNumber(row.monto_bs);
                          const montoUsd = toLocaleNumber(row.monto_usd);
                          const bsVisible = montoBs > 0
                            ? montoBs
                            : (montoUsd > 0 && tasaHistorica > 0 ? montoUsd * tasaHistorica : 0);
                          const bsEsEstimado = montoBs <= 0 && montoUsd > 0 && tasaHistorica > 0;
                          return (
                            <>
                              <strong>Detalle pago histórico {idx + 1}:</strong>{' '}
                              Fondo usado {fondosCatalogo.find((f) => String(f.id) === String(row.fondo_id || ''))?.nombre || `#${String(row.fondo_id || 'N/A')}`} | Fecha {row.fecha_operacion ? formatDateVE(row.fecha_operacion) : 'N/A'} | Bs {formatMoney(bsVisible)}{bsEsEstimado ? ' (estimado)' : ''}{montoUsd > 0 ? ` | USD ${formatMoney(montoUsd)}` : ''}
                            </>
                          );
                        })()}
                      </p>
                    ))}
                    {pagadoRowsHistoricos.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPagosHistoricos((prev) => !prev)}
                        className="mt-1 text-xs font-bold text-amber-700 underline decoration-amber-400 underline-offset-2 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                      >
                        {showAllPagosHistoricos
                          ? 'Ver menos pagos históricos'
                          : `Ver ${pagadoRowsHistoricos.length - 3} pago(s) histórico(s) más`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 text-xs">
              <p className="text-gray-500 dark:text-gray-400">Monto Base: <br /><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {formatMoney(gasto.monto_bs)}</strong></p>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <p className="text-right text-gray-500 dark:text-gray-400">Tasa Aplicada: <br /><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {formatMoney(gasto.tasa_cambio)}</strong></p>
            </div>
            <p className="flex justify-between items-center">
              <strong>Monto Total (USD):</strong>
              <span className="text-lg font-black text-gray-800 dark:text-white">${formatMoney(gasto.monto_total_usd)}</span>
            </p>
            {isExtra && (
              <p className="mt-2 flex justify-between items-center">
                <strong>Monto Pagado (USD):</strong>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">${formatMoney(montoPagado)}</span>
              </p>
            )}
            {isExtra && (
              <p className="mt-2 flex justify-between items-center">
                <strong>Recaudado hasta {formatDateVE(gasto.fecha_registro)} (USD):</strong>
                <span className="text-base font-black text-sky-600 dark:text-sky-400">${formatMoney(montoRecaudado)}</span>
              </p>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {gasto.factura_img && (
              <div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Factura o recibo</p>
                <a href={getFileUrl(gasto.factura_img)} target="_blank" rel="noreferrer" className="block">
                  {isPdf(gasto.factura_img) ? (
                    <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                      Ver PDF adjunto
                    </div>
                  ) : (
                    <img src={getFileUrl(gasto.factura_img)} alt="Factura" className="w-full h-32 object-cover rounded-xl border border-blue-200 shadow-sm" />
                  )}
                </a>
              </div>
            )}

            {soportesAdjuntos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider dark:text-gray-400">Soportes Adjuntos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Haz click en la vista previa para abrir el soporte completo.</p>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {soportesAdjuntos.map((img: string, idx: number) => (
                    <a key={idx} href={getFileUrl(img)} target="_blank" rel="noreferrer" className="flex-shrink-0">
                      {isPdf(img) ? (
                        <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 flex items-center justify-center text-center px-1">
                          PDF
                        </div>
                      ) : (
                        <img src={getFileUrl(img)} alt="Soporte" className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm" />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isExtra && (
          <aside className="mt-6 xl:mt-0 xl:border-l xl:border-gray-200 xl:dark:border-gray-700 xl:pl-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 dark:text-slate-300">
                <span>Pagos de recaudacion nuevos</span>
                <span>{pagosRecaudacion.length} registro{pagosRecaudacion.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600 dark:text-slate-200">Total tabla (USD)</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">${formatMoney(totalPagosTablaUsd)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/30">
              {loadingPagos ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">Cargando pagos...</p>
              ) : pagosError ? (
                <p className="py-8 text-center text-sm font-semibold text-red-500">{pagosError}</p>
              ) : pagosRecaudacion.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">No hay pagos vinculados para este gasto.</p>
              ) : (
                <DataTable<PagoDetalle>
                  columns={[
                    {
                      key: 'inmueble',
                      header: 'Inmueble / Pago',
                      render: (pago) => (
                        <>
                          <div className="font-semibold text-slate-700 dark:text-slate-100">{pago.inmueble || 'Inmueble N/A'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-300">Pago #{pago.pago_id || 'N/A'}</div>
                          {Boolean(pago.es_ajuste_historico) && (
                            <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Historico
                            </span>
                          )}
                        </>
                      ),
                    },
                    {
                      key: 'monto_usd',
                      header: 'Monto USD',
                      className: 'font-mono font-semibold text-emerald-600 dark:text-emerald-400',
                      render: (pago) => `$${formatMoney(pago.monto_usd || 0)}`,
                    },
                    {
                      key: 'referencia',
                      header: 'Referencia',
                      className: 'font-mono text-slate-700 dark:text-slate-100',
                      render: (pago) => pago.referencia || 'N/A',
                    },
                    {
                      key: 'monto_bs',
                      header: 'Monto Bs',
                      className: 'font-mono text-slate-600 dark:text-slate-300',
                      render: (pago) => (toNumber(pago.monto_bs) > 0 ? `Bs ${formatMoney(pago.monto_bs || 0)}` : '-'),
                    },
                    {
                      key: 'fecha_pago',
                      header: 'Fecha',
                      className: 'text-slate-700 dark:text-slate-100',
                      render: (pago) => formatDateVE(pago.fecha_pago || pago.fecha_registro),
                    },
                  ]}
                  data={pagosPaginaActual}
                  keyExtractor={(pago) => pago.id}
                  rowClassName="border-b border-slate-100 dark:border-slate-800 align-top"
                />
              )}

              {!loadingPagos && !pagosError && pagosRecaudacion.length > ITEMS_PER_PAGE && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Página {currentPagePagos} de {totalPagesPagos}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPagePagos((prev) => Math.max(1, prev - 1))}
                      disabled={currentPagePagos === 1}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPagePagos((prev) => Math.min(totalPagesPagos, prev + 1))}
                      disabled={currentPagePagos === totalPagesPagos}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <button onClick={onClose} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cerrar</button>
    </ModalBase>
  );
};

export default ModalDetallesGasto;

