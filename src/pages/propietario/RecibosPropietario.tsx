import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import VistaAvisoCobro from '../../components/recibos/VistaAvisoCobro';
import StatusBadge from '../../components/ui/StatusBadge';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';
import DataTable from '../../components/ui/DataTable';

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

const toNumber = (value: string | number | undefined | null): number => Number.parseFloat(String(value ?? 0)) || 0;

const RecibosPropietario: FC = () => {
  const { userRole, propiedadActiva } = useOutletContext<OutletContextType>();
  const [recibos, setRecibos] = useState<ReciboPropietario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReciboId, setSelectedReciboId] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
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
        
        <div className="mt-2">
          <DataTable
            columns={[
              {
                key: 'mes',
                header: 'Mes',
                render: (recibo) => (
                  <>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{recibo.mes_cobro}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{recibo.fecha_emision ? String(recibo.fecha_emision).slice(0, 10) : ''}</p>
                  </>
                ),
              },
              { key: 'monto', header: 'Monto ($)', headerClassName: 'text-right', className: 'text-right font-bold text-gray-700 dark:text-gray-200', render: (recibo) => `$${formatMoney(recibo.monto)}` },
              { key: 'pagado', header: 'Monto Pagado ($)', headerClassName: 'text-right', className: 'text-right font-bold text-emerald-700 dark:text-emerald-300', render: (recibo) => `$${formatMoney(recibo.pagado)}` },
              { key: 'pendiente', header: 'Saldo Pendiente ($)', headerClassName: 'text-right', className: 'text-right font-black text-red-600 dark:text-red-400', render: (recibo) => `$${formatMoney(recibo.saldoPendiente)}` },
              {
                key: 'estado',
                header: 'Estado',
                headerClassName: 'text-center',
                className: 'text-center',
                render: (recibo) => (
                  <StatusBadge
                    color={recibo.saldoPendiente <= 0 ? 'emerald' : toNumber(recibo.pagado) > 0 ? 'amber' : 'red'}
                    size="md"
                    className="font-black"
                  >
                    {recibo.saldoPendiente <= 0 ? 'Pagado' : toNumber(recibo.pagado) > 0 ? 'Abonado' : 'Pendiente'}
                  </StatusBadge>
                ),
              },
              {
                key: 'acciones',
                header: 'Acciones',
                headerClassName: 'text-center',
                className: 'text-center',
                render: (recibo) => (
                  <button
                    type="button"
                    onClick={() => handleOpenRecibo(recibo.id)}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    title="Ver / Imprimir"
                  >
                    🖨️
                  </button>
                ),
              },
            ]}
            data={rows}
            keyExtractor={(recibo) => recibo.id}
            loading={loading}
            emptyMessage="No hay recibos para este inmueble."
            rowClassName="border-b border-gray-50 hover:bg-gray-50/70 dark:border-gray-800/70 dark:hover:bg-gray-800/40"
          />
        </div>
      </div>

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
