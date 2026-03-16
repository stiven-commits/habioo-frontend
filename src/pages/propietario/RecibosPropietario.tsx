import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalRegistrarPago from '../../components/ModalRegistrarPago';
import VistaAvisoCobro from '../../components/recibos/VistaAvisoCobro';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';

interface ReciboPropietario {
  id: number;
  propiedad_id: number;
  mes_cobro: string;
  monto_usd: string | number;
  monto_pagado_usd: string | number;
  estado: string;
  fecha_emision: string;
  fecha_vencimiento?: string | null;
}

interface MisRecibosResponse {
  status: 'success' | 'error';
  data?: ReciboPropietario[];
  message?: string;
}

interface NotificacionPago {
  id: number;
  propiedad_id: number;
  estado: string;
}

interface NotificacionesResponse {
  status: 'success' | 'error';
  data?: NotificacionPago[];
  message?: string;
}

interface PropiedadActiva {
  id_propiedad: number;
  identificador: string;
  nombre_condominio: string;
  id_condominio: number;
  saldo_actual: string | number;
}

interface OutletContextType {
  userRole?: string;
  propiedadActiva?: PropiedadActiva | null;
}

interface PropiedadPreseleccionada {
  id: number;
  identificador: string;
  saldo_actual: string | number;
}

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const RecibosPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [recibos, setRecibos] = useState<ReciboPropietario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReciboId, setSelectedReciboId] = useState<number | null>(null);
  const [selectedPropPago, setSelectedPropPago] = useState<PropiedadPreseleccionada | null>(null);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const avisoPrintRef = useRef<HTMLDivElement | null>(null);

  const fetchRecibos = async (): Promise<void> => {
    if (!propiedadActiva?.id_propiedad) {
      setRecibos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/api/propietario/mis-recibos/${propiedadActiva.id_propiedad}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: MisRecibosResponse = (await res.json()) as MisRecibosResponse;
      if (!res.ok || data.status !== 'success') {
        setRecibos([]);
        return;
      }
      setRecibos(Array.isArray(data.data) ? data.data : []);
    } catch {
      setRecibos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRecibos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadActiva?.id_propiedad]);

  useEffect(() => {
    const fetchNotificaciones = async (): Promise<void> => {
      if (!propiedadActiva?.id_propiedad) {
        setPendingApprovals(0);
        return;
      }
      try {
        const token = localStorage.getItem('habioo_token');
        const res = await fetch(`${API_BASE_URL}/api/propietario/notificaciones?propiedad_id=${propiedadActiva.id_propiedad}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: NotificacionesResponse = (await res.json()) as NotificacionesResponse;
        if (!res.ok || data.status !== 'success') {
          setPendingApprovals(0);
          return;
        }
        const list = Array.isArray(data.data) ? data.data : [];
        const pending = list.filter((n) => n.estado === 'PendienteAprobacion').length;
        setPendingApprovals(pending);
      } catch {
        setPendingApprovals(0);
      }
    };
    void fetchNotificaciones();
  }, [propiedadActiva?.id_propiedad, showPayModal]);

  const rows = useMemo(
    () =>
      recibos.map((r) => {
        const monto = toNumber(r.monto_usd);
        const pagado = toNumber(r.monto_pagado_usd);
        const saldoPendiente = Math.max(0, monto - pagado);
        return { ...r, monto, pagado, saldoPendiente };
      }),
    [recibos],
  );

  const openPagoModal = (): void => {
    if (!propiedadActiva) return;
    const totalPendiente = rows.reduce((acc, row) => acc + row.saldoPendiente, 0);
    setSelectedPropPago({
      id: propiedadActiva.id_propiedad,
      identificador: propiedadActiva.identificador,
      saldo_actual: totalPendiente,
    });
    setSelectedReciboId(null);
    setShowPayModal(true);
  };

  const handleOpenRecibo = (reciboId: number): void => {
    setSelectedReciboId(reciboId);
    setShowPrintModal(true);
  };

  const handlePrintAviso = (): void => {
    const target = avisoPrintRef.current;
    if (!target) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Aviso de Cobro</title>
          ${styles}
          <style>
            @page { size: auto; margin: 6mm; }
            html, body { background: #ffffff; margin: 0; padding: 0; }
            .print-shell { padding: 0; zoom: 80%; }
            @supports not (zoom: 1) {
              .print-shell {
                transform: scale(0.8);
                transform-origin: top left;
                width: 125%;
              }
            }
            .print-shell > .min-h-screen {
              min-height: auto !important;
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-shell > .min-h-screen > .mx-auto {
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 4mm !important;
            }
            .print-shell .shadow-sm,
            .print-shell .shadow-lg,
            .print-shell .shadow-2xl {
              box-shadow: none !important;
            }
            .print-shell .aviso-header {
              display: flex !important;
              flex-direction: row !important;
              align-items: flex-start !important;
              justify-content: space-between !important;
              gap: 12px !important;
            }
            .print-shell .aviso-header-left {
              width: 25% !important;
            }
            .print-shell .aviso-header-center {
              width: 50% !important;
              text-align: center !important;
            }
            .print-shell .aviso-header-right {
              width: 25% !important;
              text-align: right !important;
            }
            .print-shell .aviso-top-grid,
            .print-shell .aviso-mensajes-grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 12px !important;
            }
          </style>
        </head>
        <body>
          <div class="print-shell">${target.innerHTML}</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (userRole !== 'Propietario') {
    return <p className="p-6 text-gray-500 dark:text-gray-400">No tienes permisos para ver esta sección.</p>;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-white">Mis Recibos / Pagar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {propiedadActiva
                ? `Inmueble activo: ${propiedadActiva.identificador} | ${propiedadActiva.nombre_condominio}`
                : 'Selecciona un inmueble para ver sus recibos.'}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {pendingApprovals > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
              Tienes {pendingApprovals} pago(s) en aprobacion por la junta de condominio.
            </div>
          )}
          <button
            type="button"
            onClick={openPagoModal}
            disabled={!rows.some((r) => r.saldoPendiente > 0)}
            className="mb-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Registrar Pago
          </button>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="p-3 font-bold">Mes</th>
                  <th className="p-3 text-right font-bold">Monto ($)</th>
                  <th className="p-3 text-right font-bold">Monto Pagado ($)</th>
                  <th className="p-3 text-right font-bold">Saldo Pendiente ($)</th>
                  <th className="p-3 text-center font-bold">Estado</th>
                  <th className="p-3 text-center font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Cargando recibos...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay recibos para este inmueble.
                    </td>
                  </tr>
                ) : (
                  rows.map((recibo) => (
                    <tr key={recibo.id} className="border-b border-gray-50 hover:bg-gray-50/70 dark:border-gray-800/70 dark:hover:bg-gray-800/40">
                      <td className="p-3">
                        <p className="font-bold text-gray-800 dark:text-gray-200">{recibo.mes_cobro}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{recibo.fecha_emision ? String(recibo.fecha_emision).slice(0, 10) : ''}</p>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-200">${formatMoney(recibo.monto)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-300">${formatMoney(recibo.pagado)}</td>
                      <td className="p-3 text-right font-black text-red-600 dark:text-red-400">${formatMoney(recibo.saldoPendiente)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                            recibo.saldoPendiente <= 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : toNumber(recibo.pagado) > 0
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          {recibo.saldoPendiente <= 0 ? 'Pagado' : toNumber(recibo.pagado) > 0 ? 'Abonado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenRecibo(recibo.id)}
                          className="rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                          title="Ver / Imprimir"
                        >
                          🖨️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPayModal && (
        <ModalRegistrarPago
          propiedadPreseleccionada={selectedPropPago}
          reciboId={selectedReciboId}
          soloCuentaPrincipal={true}
          condominioId={propiedadActiva?.id_condominio ?? null}
          onClose={() => {
            setShowPayModal(false);
            setSelectedReciboId(null);
            setSelectedPropPago(null);
          }}
          onSuccess={() => {
            setShowPayModal(false);
            setSelectedReciboId(null);
            setSelectedPropPago(null);
            void fetchRecibos();
          }}
        />
      )}

      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto print:hidden">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900/95">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Aviso de Cobro {selectedReciboId ? `#${selectedReciboId}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAviso}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedReciboId(null);
                  }}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div ref={avisoPrintRef} className="max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
              <VistaAvisoCobro reciboId={selectedReciboId} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RecibosPropietario;
