import type { FC } from 'react';
import { Fragment, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ModalBase from './ui/ModalBase';

interface ErrorFila {
  fila: number;
  referencia?: string;
  inmueble?: string;
  errores: string[];
  etapa?: 'validacion' | 'insercion';
  valid_funds?: string[];
}

interface PagoPreview {
  fila: number;
  fecha_pago: string;
  referencia: string;
  inmueble: string;
  banco_origen: string;
  monto_bs: number;
  tasa_cambio: number;
  monto_usd: number;
  fondo?: string;
  modo: 'distribuido' | 'fondo_unico';
}

export interface CargaMasivaResultado {
  tipo: 'exito' | 'parcial_o_error' | 'error_validacion';
  mensaje: string;
  exitosos: number;
  fallidos: number;
  total: number;
  errores?: ErrorFila[];
}

export interface CargaMasivaPreview {
  pagos: PagoPreview[];
  errores?: ErrorFila[];
  totalFilas: number;
}

interface Props {
  resultado: CargaMasivaResultado;
  nombreArchivo?: string;
  onClose: () => void;
  preview?: CargaMasivaPreview;
  onConfirm?: () => void;
}

const PagosCargaMasivaModal: FC<Props> = ({ resultado, nombreArchivo, onClose, preview, onConfirm }) => {
  const { tipo, mensaje, exitosos, fallidos, total, errores = [] } = resultado;
  const [copiedFund, setCopiedFund] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFund(text);
      setTimeout(() => setCopiedFund(null), 1500);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedFund(text);
      setTimeout(() => setCopiedFund(null), 1500);
    }
  };

  const renderError = (err: string, validFunds?: string[]): React.ReactNode => {
    const fundMatch = err.match(/Fondo "([^"]+)" no existe\. V[uá]lidos:\s*(.+)/);
    if (fundMatch && validFunds && validFunds.length > 0) {
      return (
        <div className="leading-snug">
          <span>• Fondo "{fundMatch[1]}" no existe. Válidos:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {validFunds.map((fund) => (
              <button
                key={fund}
                type="button"
                onClick={() => copyToClipboard(fund)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors group"
                title={`Copiar "${fund}"`}
              >
                {copiedFund === fund ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">{fund}</span>
                  </>
                ) : (
                  <>
                    {fund}
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 dark:text-amber-400" />
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return <div className="leading-snug">• {err}</div>;
  };

  const handleConfirm = async (): Promise<void> => {
    setConfirming(true);
    try {
      await onConfirm?.();
    } finally {
      setConfirming(false);
    }
  };

  const subtitle = nombreArchivo ? `Archivo: ${nombreArchivo}` : undefined;

  // Preview mode: show table of payments to be uploaded
  if (preview && preview.pagos.length > 0) {
    return (
      <ModalBase
        onClose={onClose}
        title="Vista Previa de Carga Masiva"
        helpTooltip="Revisa todas las filas antes de confirmar: aqui puedes validar montos, fondos, referencias y errores detectados en el archivo."
        subtitle={subtitle}
        maxWidth="max-w-5xl"
      >
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800 dark:text-amber-200">
          ⚠️ Revisa los datos antes de confirmar. Se registrarán {preview.totalFilas} pago(s).
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{preview.totalFilas}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total filas</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{preview.pagos.length}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Válidos</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-red-600 dark:text-red-400">{preview.errores?.length || 0}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Con errores</p>
          </div>
        </div>

        {/* Preview table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fila</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Referencia</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Inmueble</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Banco</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Monto Bs</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Tasa</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Monto USD</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fondo</th>
              </tr>
            </thead>
            <tbody>
              {preview.pagos.map((pago, i) => (
                <tr
                  key={i}
                  className={`border-t border-slate-100 dark:border-slate-700 ${
                    i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{pago.fila}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{pago.fecha_pago}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{pago.referencia}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{pago.inmueble}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{pago.banco_origen}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    Bs {pago.monto_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {pago.tasa_cambio.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    ${pago.monto_usd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">
                    {pago.fondo ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {pago.fondo}
                      </span>
                    ) : (
                      <span className="text-slate-400">Distribuido</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Errors section */}
        {preview.errores && preview.errores.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
              Filas con errores ({preview.errores.length})
            </h4>
            <div className="overflow-x-auto rounded-xl border border-red-100 dark:border-red-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                    <th className="px-3 py-2 text-left font-semibold">Fila</th>
                    <th className="px-3 py-2 text-left font-semibold">Referencia</th>
                    <th className="px-3 py-2 text-left font-semibold">Inmueble</th>
                    <th className="px-3 py-2 text-left font-semibold">Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errores.map((e, i) => (
                    <tr
                      key={i}
                      className={`border-t border-red-100 dark:border-red-900/30 ${
                        i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-red-50/40 dark:bg-red-900/10'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{e.fila}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{e.referencia || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{e.inmueble || '—'}</td>
                      <td className="px-3 py-2 text-red-600 dark:text-red-400">
                        {e.errores.map((err, j) => (
                          <Fragment key={j}>{renderError(err, e.valid_funds)}</Fragment>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-5 border-t border-gray-200/80 dark:border-gray-700/60 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || preview.pagos.length === 0}
            className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Procesando...
              </span>
            ) : (
              `Subir ${preview.pagos.length} Cargo(s)`
            )}
          </button>
        </div>
      </ModalBase>
    );
  }

  // Default mode: show result after upload
  return (
    <ModalBase
      onClose={onClose}
      title="Carga Masiva de Pagos"
      helpTooltip="Esta ventana muestra el resultado de la carga masiva: total procesado, exitos, errores y observaciones para corregir el archivo."
      subtitle={subtitle}
      maxWidth="max-w-3xl"
    >
      {/* Resumen */}
      <div
        className={`rounded-xl px-4 py-3 mb-5 text-sm font-medium whitespace-pre-wrap ${
          tipo === 'exito'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700'
            : tipo === 'error_validacion'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700'
        }`}
      >
        {mensaje}
      </div>

      {/* Estadísticas */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{total}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total filas</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{exitosos}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Exitosos</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-center">
            <p className="text-2xl font-black text-red-600 dark:text-red-400">{fallidos}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Con errores</p>
          </div>
        </div>
      )}

      {/* Tabla de errores */}
      {errores.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
            Detalle de errores ({errores.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-red-100 dark:border-red-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fila</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Referencia</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Inmueble</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Etapa</th>
                  <th className="px-3 py-2 text-left font-semibold">Errores</th>
                </tr>
              </thead>
              <tbody>
                {errores.map((e, i) => (
                  <tr
                    key={i}
                    className={`border-t border-red-100 dark:border-red-900/30 ${
                      i % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-red-50/40 dark:bg-red-900/10'
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {e.fila}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {e.referencia || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {e.inmueble || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.etapa === 'insercion' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          Inserción
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                          Validación
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-red-600 dark:text-red-400">
                      {e.errores.map((err, j) => (
                        <Fragment key={j}>
                          {renderError(err, e.valid_funds)}
                        </Fragment>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
        >
          Cerrar
        </button>
      </div>
    </ModalBase>
  );
};

export default PagosCargaMasivaModal;
