import { useState, type ChangeEvent, type FC } from 'react';
import ModalBase from '../../ui/ModalBase';
import FormField from '../../ui/FormField';
import { formatMoney } from '../../../utils/currency';
import { getCurrentBcvRate } from '../../../utils/bcv';
import type { ModalAjusteSaldoProps } from './types';
import { formatNumberInput } from './utils';

export const ModalAjusteSaldo: FC<ModalAjusteSaldoProps> = ({
  isOpen,
  selectedPropAjuste,
  setAjusteModalOpen,
  formAjuste,
  setFormAjuste,
  handleSubmitAjuste
}) => {
  if (!isOpen || !selectedPropAjuste) return null;
  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const montoBsNum = parseFloat(String(formAjuste.monto_bs || '').replace(',', '.')) || 0;
  const tasaNum = parseFloat(String(formAjuste.tasa_cambio || '').replace(',', '.')) || 0;
  const montoUsd = montoBsNum > 0 && tasaNum > 0 ? (montoBsNum / tasaNum) : 0;

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const rate = await getCurrentBcvRate();
      if (rate <= 0) throw new Error('Tasa inválida');
      setFormAjuste((prev) => ({ ...prev, tasa_cambio: Number(rate).toFixed(4).replace('.', ',') }));
    } catch {
      alert('No se pudo obtener la tasa BCV.');
    } finally {
      setIsFetchingBCV(false);
    }
  };

  return (
    <ModalBase
      onClose={() => setAjusteModalOpen(false)}
      closeOnOverlayClick={false}
      title="Ajustar Saldo"
      helpTooltip="Aqui puedes aplicar ajustes manuales de saldo al inmueble (deuda o favor), con nota de auditoria y tasa BCV de referencia."
      subtitle={<>Inmueble: <strong className="text-donezo-primary">{selectedPropAjuste.identificador}</strong></>}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmitAjuste} className="space-y-4">
          <FormField label="Acción a realizar">
            <select value={formAjuste.tipo_ajuste} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormAjuste({ ...formAjuste, tipo_ajuste: (e.target.value === 'FAVOR' ? 'FAVOR' : 'DEUDA'), subtipo_favor: 'directo' })} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
              <option value="FAVOR">A favor</option>
              <option value="DEUDA">Deuda</option>
            </select>
          </FormField>
          <FormField label="Monto (Bs)">
            <input type="text" value={formAjuste.monto_bs || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormAjuste({ ...formAjuste, monto_bs: e.target.value.replace(/\./g, ',').replace(/[^0-9,]/g, '') })} placeholder="Ej: 1.500,00" className="w-full p-3 rounded-xl border text-lg dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white" required />
          </FormField>
          <FormField label="Tasa BCV">
            <div className="flex gap-2">
              <input type="text" value={formAjuste.tasa_cambio || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormAjuste({ ...formAjuste, tasa_cambio: formatNumberInput(e.target.value, 4) })} placeholder="Ej: 95,2000" className="flex-1 p-3 rounded-xl border text-lg dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white" required />
              <button type="button" onClick={() => { void fetchBCV(); }} disabled={isFetchingBCV} className="px-3 rounded-xl border border-blue-300 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700 text-xs font-bold disabled:opacity-60">
                {isFetchingBCV ? 'Consultando...' : 'Obtener BCV'}
              </button>
            </div>
          </FormField>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm">
            Equivalente en USD: <strong className="font-mono">${formatMoney(montoUsd)}</strong>
          </div>
          <FormField label="Nota (Auditoría)" required>
            <textarea value={formAjuste.nota} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormAjuste({ ...formAjuste, nota: e.target.value })} placeholder="Ej: Cobro de multa" className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white text-sm min-h-[80px]" required />
          </FormField>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            Este ajuste afecta solo el estado de cuenta del inmueble. No genera movimientos en los estados de cuenta bancarios.
          </p>
          <div className="mt-6 flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setAjusteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-donezo-primary dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-donezo-primary border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-donezo-primary disabled:opacity-50"
            >
              Aplicar Ajuste
            </button>
          </div>
      </form>
    </ModalBase>
  );
};



