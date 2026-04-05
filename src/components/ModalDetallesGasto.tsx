import React from 'react';
import type { FC } from 'react';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import ModalBase from './ui/ModalBase';

interface GastoDetalle {
  proveedor: string;
  fecha_factura: string;
  fecha_registro: string;
  concepto: string;
  clasificacion?: string;
  nota?: string;
  monto_bs: string | number;
  tasa_cambio: string | number;
  monto_total_usd: string | number;
  factura_img?: string;
  imagenes?: string[] | string;
}

interface ModalDetallesGastoProps {
  gasto: GastoDetalle | null;
  onClose: () => void;
}

const ModalDetallesGasto: FC<ModalDetallesGastoProps> = ({ gasto, onClose }) => {
  if (!gasto) return null;
  const isPdf = (path: string): boolean => /\.pdf($|\?)/i.test(path);
  const getFileUrl = (path: string): string => {
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE_URL}${path}`;
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
  const soportesAdjuntos = normalizeSoportes(gasto.imagenes);
  const notaRaw = String(gasto.nota || '').trim();
  const cuotasHistoricasMatch = notaRaw.match(/\[hist\.cuotas:(\d+)\]/i);
  const pagoHistoricoMatch = notaRaw.match(/\[hist\.proveedor_usd:([0-9]+(?:\.[0-9]+)?)\]/i);
  const cuotasHistoricas = cuotasHistoricasMatch?.[1] ? parseInt(cuotasHistoricasMatch[1], 10) : 0;
  const pagoHistoricoProveedorUsd = pagoHistoricoMatch?.[1] ? Number(pagoHistoricoMatch[1]) : 0;
  const notaLimpia = notaRaw
    .replace(/\s*\|\s*\[hist\.cuotas:\d+\]/gi, '')
    .replace(/\s*\|\s*\[hist\.proveedor_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .replace(/\[hist\.cuotas:\d+\]/gi, '')
    .replace(/\[hist\.proveedor_usd:[0-9]+(?:\.[0-9]+)?\]/gi, '')
    .trim();

  return (
    <ModalBase onClose={onClose} title="Inspección de Gasto" maxWidth="max-w-md">
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
            <strong className="text-gray-800 dark:text-white">Etiqueta:</strong>{' '}
            {String(gasto.clasificacion || 'Variable') === 'Fijo' ? 'Gasto fijo' : 'Gasto variable'}
          </p>
          <p>
            <strong className="text-gray-800 dark:text-white">Notas:</strong>{' '}
            {notaLimpia ? notaLimpia : 'Sin notas'}
          </p>
          {(cuotasHistoricas > 0 || pagoHistoricoProveedorUsd > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="text-xs font-black uppercase tracking-wider">Contexto histórico</p>
              <div className="mt-2 space-y-1 text-sm">
                {cuotasHistoricas > 0 && (
                  <p>
                    <strong>Cuotas ya transcurridas:</strong> {cuotasHistoricas}
                  </p>
                )}
                {pagoHistoricoProveedorUsd > 0 && (
                  <p>
                    <strong>Pago histórico al proveedor:</strong> ${formatMoney(pagoHistoricoProveedorUsd)}
                  </p>
                )}
              </div>
            </div>
          )}
          
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
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Factura o recibo</p>
              <a href={getFileUrl(gasto.factura_img)} target="_blank" rel="noreferrer" className="block">
                {isPdf(gasto.factura_img) ? (
                  <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    Ver PDF adjunto
                  </div>
                ) : (
                  <img src={getFileUrl(gasto.factura_img)} alt="Factura" className="w-full h-32 object-cover rounded-xl border border-blue-200 shadow-sm"/>
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
                      <img src={getFileUrl(img)} alt={`Soporte`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"/>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

      <button onClick={onClose} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cerrar</button>
    </ModalBase>
  );
};

export default ModalDetallesGasto;
