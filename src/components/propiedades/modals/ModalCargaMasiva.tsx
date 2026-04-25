import { type FC } from 'react';
import ModalBase from '../../ui/ModalBase';
import { formatMoney } from '../../../utils/currency';
import DataTable from '../../ui/DataTable';
import type { ModalCargaMasivaProps } from './types';

export const ModalCargaMasiva: FC<ModalCargaMasivaProps> = ({
  isOpen,
  setLoteModalOpen,
  loteData,
  setLoteData,
  loteErrors,
  montoTotalIngresoLote,
  isUploadingLote,
  uploadProgress,
  handleDownloadTemplate,
  handleSaveLote,
  handleFileUpload
}) => {
  if (!isOpen) return null;

  const handleClose = (): void => {
    if (isUploadingLote) return;
    setLoteData([]);
    setLoteModalOpen(false);
  };

  return (
    <ModalBase
      onClose={handleClose}
      closeOnOverlayClick={false}
      title="Carga Masiva de Inmuebles"
      subtitle={
        loteData.length > 0 ? (
          <>
            Se encontraron {loteData.length} registros.
            {loteErrors > 0 && <span className="text-red-500 font-bold ml-2">Hay {loteErrors} errores detectados.</span>}
            <span className="block text-emerald-600 dark:text-emerald-400 font-bold mt-1">
              Monto total a ingresar en inmuebles: ${formatMoney(montoTotalIngresoLote)}
            </span>
          </>
        ) : undefined
      }
      maxWidth="3xl"
      disableClose={isUploadingLote}
    >
        {loteData.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center bg-white dark:bg-donezo-card-dark min-h-[300px]">
            <div className="text-6xl mb-4">Excel</div>
            <h4 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Importar desde Excel</h4>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8">
              Para cargar múltiples propiedades de golpe, descarga nuestra plantilla de Excel, llénala con los datos y súbela al sistema. Las cédulas se usarán como claves temporales.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
               <button onClick={handleDownloadTemplate} className="flex-1 py-3 px-4 rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-sm">
                 1. Descargar Plantilla
               </button>
               <label className="flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-bold cursor-pointer shadow-md hover:bg-green-700 transition-all text-center">
                 2. Subir Archivo
                 <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
               </label>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 flex flex-col">
            {isUploadingLote && (
              <div className="absolute inset-0 bg-white/55 dark:bg-black/55 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4 w-full max-w-sm">
                  <span className="font-bold text-gray-800 dark:text-white text-lg">Procesando {loteData.length} registros...</span>
                  <p className="text-sm text-gray-500 text-center">Por favor, no cierre esta ventana mientras se guardan los datos.</p>

                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative shadow-inner mt-2">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.round(uploadProgress)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-donezo-card-dark custom-scrollbar">
              <DataTable
                columns={[
                  {
                    key: 'estado',
                    header: 'Estado',
                    headerClassName: 'text-center',
                    className: 'text-center text-xs',
                    render: (row) => row.isValid ? (
                      <span className="text-green-500 text-lg" title="Correcto">OK</span>
                    ) : (
                      <span className="text-red-500 font-semibold" title={row.errors}>ERR{row.errors ? ` - ${row.errors}` : ''}</span>
                    ),
                  },
                  { key: 'apto', header: 'Apto/Casa', className: 'font-bold text-gray-800 dark:text-white', render: (row) => row.identificador },
                  {
                    key: 'propietario',
                    header: 'Propietario',
                    render: (row) => (
                      <>
                        <div className="text-gray-700 dark:text-gray-300 font-medium">{row.nombre}</div>
                        {!row.isValid && row.errors.includes('Nombre') && <span className="text-[10px] text-red-500 font-bold">Requerido</span>}
                      </>
                    ),
                  },
                  {
                    key: 'cedula',
                    header: 'Cédula',
                    className: 'font-mono text-gray-600 dark:text-gray-400',
                    render: (row) => (
                      <>
                        {row.cedula}
                        {!row.isValid && row.errors.includes('Cédula') && <div className="text-[10px] text-red-500 font-bold">Inválida</div>}
                      </>
                    ),
                  },
                  {
                    key: 'correo',
                    header: 'Correo',
                    className: 'text-gray-500 dark:text-gray-400 text-xs',
                    render: (row) => (
                      <>
                        {row.correo || '-'}
                        {!row.isValid && row.errors.includes('Correo duplicado') && <div className="text-[10px] text-red-500 font-bold">Repetido</div>}
                      </>
                    ),
                  },
                  { key: 'telefono', header: 'Teléfono', className: 'text-gray-500 dark:text-gray-400 text-xs', render: (row) => row.telefono || '-' },
                  {
                    key: 'alicuota',
                    header: 'Alícuota',
                    headerClassName: 'text-right',
                    className: 'text-right font-mono font-bold text-blue-600 dark:text-blue-400',
                    render: (row) => (
                      <>
                        {String(row.alicuota).replace('.', ',')}%
                        {!row.isValid && row.errors.includes('Alícuota') && <div className="text-[10px] text-red-500 font-bold">Debe ser &gt; 0</div>}
                      </>
                    ),
                  },
                  {
                    key: 'saldo',
                    header: 'Saldo Inicial',
                    headerClassName: 'text-right',
                    className: 'text-right font-mono font-medium',
                    render: (row) => {
                      const saldo = parseFloat(String(row.saldo_inicial));
                      return (
                        <span className={saldo > 0 ? 'text-red-500' : saldo < 0 ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>
                          ${formatMoney(Math.abs(parseFloat(String(row.saldo_inicial || 0))))}
                        </span>
                      );
                    },
                  },
                ]}
                data={loteData}
                keyExtractor={(_, i) => i}
                rowClassName={(row) => `border-b ${row.isValid ? 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}
              />
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                {!isUploadingLote ? (
                  <label className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-sm">
                     Subir otro archivo
                     <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse">Guardando...</span>
                )}

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleClose}
                    disabled={isUploadingLote}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveLote}
                    disabled={loteErrors > 0 || isUploadingLote}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isUploadingLote ? 'Guardando...' : `Confirmar y Guardar ${loteData.length}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </ModalBase>
  );
};



