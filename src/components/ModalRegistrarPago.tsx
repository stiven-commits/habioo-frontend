import React, { useState, useEffect } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { sanitizeCedulaRif, isValidCedulaRif } from '../utils/validators';
import { useDialog } from './ui/DialogProvider';

interface ModalRegistrarPagoProps {
  propiedadPreseleccionada: PropiedadPreseleccionada | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface PropiedadPreseleccionada {
  id: number;
  identificador: string;
  saldo_actual: string | number;
}

interface BancoCuenta {
  id: number;
  nombre_banco?: string;
  apodo?: string;
  tipo?: string;
}

interface Fondo {
  cuenta_bancaria_id: number;
}

interface CuentasResponse {
  status: string;
  bancos?: BancoCuenta[];
}

interface FondosResponse {
  status: string;
  fondos?: Fondo[];
}

interface PagoResponse {
  status: string;
  message?: string;
  error?: string;
}

interface BcvResponse {
  promedio?: number | string;
}

interface FormPagoState {
  cuenta_id: string;
  monto_origen: string;
  tasa_cambio: string;
  referencia: string;
  fecha_pago: string;
  nota: string;
  cedula_origen: string;
  banco_origen: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'warning';
}

interface DialogContextType {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const initialFormPago = (): FormPagoState => ({
  cuenta_id: '',
  monto_origen: '',
  tasa_cambio: '',
  referencia: '',
  fecha_pago: new Date().toISOString().split('T')[0] ?? '',
  nota: '',
  cedula_origen: '',
  banco_origen: ''
});

const ModalRegistrarPago: FC<ModalRegistrarPagoProps> = ({ propiedadPreseleccionada, onClose, onSuccess }) => {
  const { showConfirm } = useDialog() as DialogContextType;
  const [cuentasBancarias, setCuentasBancarias] = useState<BancoCuenta[]>([]);
  const [cuentasConFondos, setCuentasConFondos] = useState<BancoCuenta[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState<boolean>(true);

  const [formPago, setFormPago] = useState<FormPagoState>(initialFormPago());

  const BANCOS_VENEZUELA: string[] = [
    'Banco de Venezuela (BDV)', 'Banesco Banco Universal', 'Banco Mercantil', 'BBVA Provincial',
    'Banco Nacional de Crédito (BNC)', 'Bancamiga Banco Universal', 'Banplus Banco Universal',
    'Banco del Tesoro', 'Banco del Caribe (Bancaribe)', 'Banco Fondo Común (BFC)', 'Banco Caroní',
    'Banco Activo', 'Banco Venezolano de Crédito (BVC)', 'Banco Sofitasa', '100% Banco',
    'Delsur Banco Universal', 'Banco Agrícola de Venezuela', 'Banco Bicentenario', 'Banco Plaza',
    'Banco Exterior', 'Banco de la Fuerza Armada Nacional Bolivariana (Banfanb)',
    'Banco Digital de los Trabajadores (BDT)', 'N58 Banco Digital', 'Bancrecer', 'Bangente', 'R4 Banco Microfinanciero'
  ];

  const [conversionUSD, setConversionUSD] = useState<string>('0.00');

  useEffect(() => {
    const fetchCuentasBancarias = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('habioo_token');
        const [resCuentas, resFondos] = await Promise.all([
          fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const dataCuentas: CuentasResponse = await resCuentas.json();
        const dataFondos: FondosResponse = await resFondos.json();
        const cuentas = dataCuentas.status === 'success' ? (dataCuentas.bancos || []) : [];
        const fondos = dataFondos.status === 'success' ? (dataFondos.fondos || []) : [];

        const idsConFondos = new Set(fondos.map((f: Fondo) => String(f.cuenta_bancaria_id)));
        const cuentasFiltradas = cuentas.filter((c: BancoCuenta) => idsConFondos.has(String(c.id)));

        setCuentasBancarias(cuentas);
        setCuentasConFondos(cuentasFiltradas);
      } catch (error) {
        console.error('Error al cargar cuentas bancarias', error);
      } finally {
        setLoadingCuentas(false);
      }
    };
    fetchCuentasBancarias();
  }, []);

  const formatCurrencyInput = (value: string): string => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;
    let [integerPart = '', decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimalPart !== undefined) {
      decimalPart = decimalPart.slice(0, 2);
      return `${integerPart},${decimalPart}`;
    }
    return integerPart ?? '';
  };

  const getConversionUSD = (updatedForm: FormPagoState): string => {
    if (!updatedForm.monto_origen || !updatedForm.cuenta_id) return '0.00';

    const banco = cuentasConFondos.find((b: BancoCuenta) => b.id.toString() === updatedForm.cuenta_id);
    const monto = parseFloat(updatedForm.monto_origen.replace(/\./g, '').replace(',', '.')) || 0;
    const isForeign = !!banco && ['Zelle', 'Efectivo'].includes(String(banco.tipo || ''));
    const tasaRaw = parseFloat(updatedForm.tasa_cambio.replace(/\./g, '').replace(',', '.'));

    if (isForeign) return monto.toFixed(2);
    if (tasaRaw && tasaRaw > 0) return (monto / tasaRaw).toFixed(2);
    return '0.00';
  };

  const applyFormChange = (name: keyof FormPagoState, value: string): void => {
    const updatedForm: FormPagoState = { ...formPago, [name]: value };
    setFormPago(updatedForm);
    setConversionUSD(getConversionUSD(updatedForm));
  };

  const handlePagoChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const field = name as keyof FormPagoState;
    let newVal = value;

    if (field === 'monto_origen' || field === 'tasa_cambio') newVal = formatCurrencyInput(value);
    if (field === 'cedula_origen') newVal = sanitizeCedulaRif(value);

    applyFormChange(field, newVal);
  };

  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('API Error');
      const json: BcvResponse = await response.json();
      if (json && json.promedio) {
        const usdRate = String(json.promedio).replace('.', ',');
        applyFormChange('tasa_cambio', formatCurrencyInput(usdRate));
      } else alert('No se pudo encontrar la tasa del BCV actual.');
    } catch {
      alert('Error de conexión o API. No se pudo obtener la tasa BCV.');
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const selectedBank = cuentasConFondos.find((b: BancoCuenta) => b.id.toString() === formPago.cuenta_id);
  const requiresTasa = !!selectedBank && ['Transferencia', 'Pago Movil'].includes(String(selectedBank.tipo || ''));

  const handleSubmitPago = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!cuentasConFondos.some((c: BancoCuenta) => c.id.toString() === formPago.cuenta_id)) {
      alert('Error: seleccione una cuenta bancaria que tenga al menos un fondo activo.');
      return;
    }
    if (requiresTasa && !isValidCedulaRif(formPago.cedula_origen)) {
      alert('Error: la cédula de origen debe iniciar con V, E, J o G y contener solo números.');
      return;
    }
    const ok = await showConfirm({
      title: 'Confirmar abono',
      message: `¿Confirmar abono por $${formatMoney(conversionUSD)} a la cuenta de ${propiedadPreseleccionada?.identificador}?`,
      confirmText: 'Procesar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok || !propiedadPreseleccionada) return;

    setIsSubmitting(true);
    try {
      const monedaReal = requiresTasa ? 'BS' : 'USD';
      const token = localStorage.getItem('habioo_token');

      const payload = {
        ...formPago,
        propiedad_id: propiedadPreseleccionada.id,
        moneda: monedaReal,
      };

      const res = await fetch(`${API_BASE_URL}/pagos-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const result: PagoResponse = await res.json();
      if (result.status === 'success') {
        alert(result.message);
        onSuccess();
      } else alert(result.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!propiedadPreseleccionada) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {isSubmitting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 rounded-3xl flex flex-col items-center justify-center px-6 text-center">
            <div className="relative w-14 h-14 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-900/50" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Procesando pago y actualizando saldos... Por favor, espere.
            </p>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Registrar Pago</h3>
          <button disabled={isSubmitting} onClick={onClose} className="text-gray-400 hover:text-red-500 text-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">✕</button>
        </div>

        <div className={`p-4 rounded-xl mb-4 text-center border ${toNumber(propiedadPreseleccionada.saldo_actual) > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/50' : 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/50'}`}>
          <p className={`text-xs font-bold mb-1 uppercase tracking-wider ${toNumber(propiedadPreseleccionada.saldo_actual) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {toNumber(propiedadPreseleccionada.saldo_actual) > 0 ? 'Deuda Pendiente' : 'Saldo a Favor'}
          </p>
          <p className={`text-3xl font-black font-mono ${toNumber(propiedadPreseleccionada.saldo_actual) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            ${formatMoney(Math.abs(toNumber(propiedadPreseleccionada.saldo_actual) || 0))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-2">
            Inmueble: <span className="text-gray-800 dark:text-white">{propiedadPreseleccionada.identificador}</span>
          </p>
        </div>

        <form onSubmit={handleSubmitPago} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Cuenta Bancaria Destino</label>
            <select name="cuenta_id" value={formPago.cuenta_id} onChange={handlePagoChange} className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required disabled={loadingCuentas}>
              <option value="">{loadingCuentas ? 'Cargando cuentas bancarias...' : (cuentasConFondos.length ? 'Seleccione cuenta bancaria...' : 'No hay cuentas con fondos activos')}</option>
              {cuentasConFondos.map((b: BancoCuenta) => <option key={b.id} value={b.id}>{b.nombre_banco || 'Cuenta'} ({b.apodo || b.tipo || 'Sin alias'})</option>)}
            </select>
            {!loadingCuentas && cuentasBancarias.length > 0 && cuentasConFondos.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                Debe crear al menos un fondo en una cuenta bancaria para registrar pagos.
              </p>
            )}
          </div>

          {requiresTasa ? (
            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Monto Pagado</label>
                  <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Tasa de Cambio <span className="text-red-500">*</span></label>
                  <input type="text" name="tasa_cambio" value={formPago.tasa_cambio} onChange={handlePagoChange} placeholder="Ej: 36,50" required className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" />
                </div>
              </div>
              <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="h-full min-h-[118px] w-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-60" title="Consultar tasa actual del BCV">
                {isFetchingBCV ? '⌛...' : '🔄 BCV'}
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Monto Pagado</label>
              <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
          )}

          {requiresTasa && (
            <div className="grid grid-cols-2 gap-3 mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Banco de Origen</label>
                <select name="banco_origen" value={formPago.banco_origen} onChange={handlePagoChange} className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required>
                  <option value="">Seleccione...</option>
                  {BANCOS_VENEZUELA.map((b: string) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Cédula Origen</label>
                <input type="text" name="cedula_origen" value={formPago.cedula_origen} onChange={handlePagoChange} pattern="^[VEJG][0-9]{5,9}$" placeholder="V12345678" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center px-2 py-1 mt-1 mb-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
            <span className="text-xs text-green-700 dark:text-green-500 font-bold uppercase tracking-wider">Abono Equivalente:</span>
            <span className="font-black text-green-600 dark:text-green-400 text-lg">+ ${formatMoney(conversionUSD)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Referencia</label>
              <input type="text" name="referencia" value={formPago.referencia} onChange={handlePagoChange} placeholder="Ref / Comprobante" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Fecha Pago</label>
              <input type="date" name="fecha_pago" value={formPago.fecha_pago} onChange={handlePagoChange} max={new Date().toISOString().split('T')[0]} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
            </div>
          </div>

          <div className="pt-2">
            <button disabled={isSubmitting} type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              Procesar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const toNumber = (value: string | number | undefined | null): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default ModalRegistrarPago;
