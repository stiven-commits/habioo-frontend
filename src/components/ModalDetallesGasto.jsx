import React from 'react';
import { formatMoney } from '../utils/currency';

export default function ModalDetallesGasto({ gasto, onClose }) {
  if (!gasto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inspección de Gasto</h3>
        
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-3">
            <div>
              <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> <br/>{gasto.proveedor}</p>
            </div>
            <div className="text-right">
              <span className="block text-xs text-gray-500 dark:text-gray-400">Factura: <strong className="text-gray-800 dark:text-gray-300">{gasto.fecha_factura}</strong></span>
              <span className="block text-[10px] text-gray-400">Cargado el: {gasto.fecha_registro}</span>
            </div>
          </div>
          <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {gasto.concepto}</p>
          <p>
            <strong className="text-gray-800 dark:text-white">Notas:</strong>{' '}
            {gasto.nota && String(gasto.nota).trim() ? gasto.nota : 'Sin notas'}
          </p>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 text-xs">
                <p className="text-gray-500 dark:text-gray-400">Monto Base: <br/><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {formatMoney(gasto.monto_bs)}</strong></p>
                <span className="text-gray-300 dark:text-gray-600">÷</span>
                <p className="text-right text-gray-500 dark:text-gray-400">Tasa Aplicada: <br/><strong className="text-gray-700 dark:text-gray-300 text-sm">Bs. {formatMoney(gasto.tasa_cambio)}</strong></p>
            </div>
            <p className="flex justify-between items-center">
              <strong>Monto Total (USD):</strong> 
              <span className="text-lg font-black text-gray-800 dark:text-white">${formatMoney(gasto.monto_total_usd)}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {gasto.factura_img && (
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Factura Original</p>
              <a href={`https://auth.habioo.cloud${gasto.factura_img}`} target="_blank" rel="noreferrer">
                <img src={`https://auth.habioo.cloud${gasto.factura_img}`} alt="Factura" className="w-full h-32 object-cover rounded-xl border border-blue-200 shadow-sm"/>
              </a>
            </div>
          )}
          {gasto.imagenes && gasto.imagenes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider dark:text-gray-400">Soportes Adjuntos</p>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {gasto.imagenes.map((img, idx) => (
                  <a key={idx} href={`https://auth.habioo.cloud${img}`} target="_blank" rel="noreferrer" className="flex-shrink-0">
                    <img src={`https://auth.habioo.cloud${img}`} alt={`Soporte`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"/>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cerrar</button>
      </div>
    </div>
  );
}

