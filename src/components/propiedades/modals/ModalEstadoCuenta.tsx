import { useEffect, useState, type FC } from 'react';
import DateRangePicker from '../../ui/DateRangePicker';
import ModalBase from '../../ui/ModalBase';
import { es } from 'date-fns/locale/es';
import { formatMoney } from '../../../utils/currency';
import { formatDateVE } from '../../../utils/datetime';
import DataTable from '../../ui/DataTable';
import type { ModalEstadoCuentaProps } from './types';
import { dateToYmd, ymdToDate } from './utils';

export const ModalEstadoCuenta: FC<ModalEstadoCuentaProps> = ({
  isOpen,
  selectedPropCuenta,
  setEstadoCuentaModalOpen,
  selectedPropAjuste,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  handleOpenAjuste,
  onRevertirAjuste,
  loadingCuenta,
  estadoCuentaFiltrado,
  showAjuste = true
}) => {
  if (!isOpen || !selectedPropCuenta) return null;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 12;
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [isOpen, fechaDesde, fechaHasta, estadoCuentaFiltrado.length]);

  const totalPages = Math.ceil(estadoCuentaFiltrado.length / ITEMS_PER_PAGE);
  const movimientosPagina = estadoCuentaFiltrado.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const saldoFinal = estadoCuentaFiltrado.length > 0 ? (estadoCuentaFiltrado[estadoCuentaFiltrado.length - 1]?.saldoFila ?? 0) : 0;

  return (
    <ModalBase
      onClose={() => setEstadoCuentaModalOpen(false)}
      closeOnOverlayClick={false}
      title={`${selectedPropCuenta.identificador} | ${selectedPropCuenta.prop_nombre}`}
      subtitle={selectedPropCuenta.inq_nombre ? <>Residente: <span className="text-gray-700 dark:text-gray-300">{selectedPropCuenta.inq_nombre}</span></> : undefined}
      maxWidth="7xl"
    >
      <div className="-mx-6 -my-5 flex flex-col">
        <div className="px-6 py-4 flex flex-wrap justify-between items-end gap-4 bg-white dark:bg-donezo-card-dark border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-3 items-center">
            <div className="min-w-[300px]">
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Rango</label>
              <DateRangePicker
                from={ymdToDate(fechaDesde)}
                to={ymdToDate(fechaHasta)}
                onChange={({ from, to }) => {
                  setFechaDesde(dateToYmd(from));
                  setFechaHasta(dateToYmd(to));
                }}
                maxDate={ymdToDate(todayYmd) as Date}
                locale={es}
                placeholderText="Rango (dd/mm/yyyy - dd/mm/yyyy)"
                wrapperClassName="w-full min-w-0"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 mt-5"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-donezo-card-dark custom-scrollbar">
          {loadingCuenta ? <p className="text-center text-gray-400 py-10">Cargando movimientos...</p> : estadoCuentaFiltrado.length === 0 ? <p className="text-center text-gray-400 py-10">No hay movimientos en este rango de fechas.</p> : (
            <DataTable
              tableStyle={{ minWidth: '1100px' }}
              columns={[
                { key: 'fecha_op', header: 'Fecha Op.', className: 'text-gray-600 dark:text-gray-300 font-mono text-xs', render: (m) => formatDateVE(m.fecha_operacion) },
                { key: 'fecha_reg', header: 'Ingreso al Sistema', className: 'text-gray-400 font-mono text-[10px]', render: (m) => formatDateVE(m.fecha_registro) },
                {
                  key: 'concepto',
                  header: 'Concepto',
                  className: 'font-medium text-gray-800 dark:text-gray-200',
                  render: (m) => {
                    const concepto = String(m.concepto || '').trim();
                    if (m.tipo === 'RECIBO') return concepto;
                    const esPago = m.tipo === 'PAGO';
                    if (esPago && /^pago\b/i.test(concepto)) return concepto;
                    if (!esPago && /^ajuste\b/i.test(concepto)) return concepto;
                    return `${esPago ? 'PAGO' : 'AJUSTE'} ${concepto}`.trim();
                  }
                },
                { key: 'monto_bs', header: 'Monto Bs', headerClassName: 'text-right', className: 'text-right font-mono text-gray-700 dark:text-gray-300', render: (m) => m.monto_bs > 0 ? `Bs ${formatMoney(m.monto_bs)}` : '-' },
                { key: 'tasa', header: 'Tasa', headerClassName: 'text-right', className: 'text-right font-mono text-gray-700 dark:text-gray-300', render: (m) => m.tasa_cambio > 0 ? formatMoney(m.tasa_cambio, 4) : '-' },
                { key: 'cargos', header: 'Cargos (Deuda)', headerClassName: 'text-right', className: 'text-right text-red-500 font-mono font-medium', render: (m) => m.cargo > 0 ? `$${formatMoney(m.cargo)}` : '-' },
                { key: 'abonos', header: 'Abonos (Pago)', headerClassName: 'text-right', className: 'text-right text-green-500 font-mono font-medium', render: (m) => m.abono > 0 ? `$${formatMoney(m.abono)}` : '-' },
                { key: 'saldo', header: 'Saldo Final', headerClassName: 'text-right text-donezo-primary', className: 'text-right font-mono font-black text-gray-800 dark:text-white', render: (m) => `$${formatMoney(m.saldoFila)}` },
                {
                  key: 'ver',
                  header: 'Acciones',
                  headerClassName: 'text-center',
                  className: 'text-center',
                  render: (m) => {
                    if (m.tipo === 'RECIBO') {
                      return (
                        <button type="button" title="Ver detalle del aviso (proximamente)" className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
                          Ver
                        </button>
                      );
                    }
                    if (m.tipo === 'AJUSTE' && m.ref_id && onRevertirAjuste) {
                      return (
                        <button
                          type="button"
                          title="Revertir este ajuste manual"
                          onClick={() => onRevertirAjuste(m.ref_id!)}
                          className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200/70 dark:border-red-800/40 transition-colors"
                        >
                          Revertir
                        </button>
                      );
                    }
                    return <span className="text-gray-300 dark:text-gray-600">-</span>;
                  },
                },
              ]}
              data={movimientosPagina}
              keyExtractor={(_, idx) => idx}
              rowClassName="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              renderFooter={() => (
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                    <td colSpan={7} className="p-3 text-right font-black uppercase text-xs text-gray-600 dark:text-gray-300 tracking-wider">Saldo Final:</td>
                    <td className="p-3 text-right font-black text-donezo-primary dark:text-cyan-300 font-mono">${formatMoney(saldoFinal)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            />
          )}
        </div>
        {!loadingCuenta && estadoCuentaFiltrado.length > 0 && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Anterior
            </button>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
};



