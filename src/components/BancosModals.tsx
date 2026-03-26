import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from './ui/DialogProvider';
import 'react-datepicker/dist/react-datepicker.css';

interface ModalBaseProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Fondo {
  id: number | string;
  cuenta_bancaria_id?: number | string;
  nombre: string;
  moneda: string;
  saldo_actual: number | string;
  porcentaje_asignacion?: number | string;
  es_operativo?: boolean;
}

interface CuentaBancaria {
  id: number | string;
  numero_cuenta?: string;
  nombre_banco?: string;
  apodo?: string;
  tipo?: string;
  moneda?: string;
}

interface GastoPendiente {
  id: number | string;
  proveedor: string;
  concepto: string;
  deuda_restante: number | string;
}

interface ApiResult {
  status: 'success' | 'error' | string;
  message?: string;
  error?: string;
}

interface FondosResponse extends ApiResult {
  fondos?: Fondo[];
}

interface BancosResponse extends ApiResult {
  bancos?: CuentaBancaria[];
}

interface GastosPendientesResponse extends ApiResult {
  gastos?: GastoPendiente[];
}

interface PagoProveedorForm {
  gasto_id: string;
  fondo_id: string;
  monto_origen: string;
  tasa_cambio: string;
  referencia: string;
  fecha_pago: string;
  nota: string;
}

interface TransferenciaForm {
  fondo_origen_id: string;
  monto_origen: string;
  referencia: string;
  fecha: string;
  nota: string;
}

interface BcvResponse {
  promedio?: number | string;
}

interface ModalEliminarFondoProps extends ModalBaseProps {
  fondo: Fondo | null;
  fondosDisponibles: Fondo[];
}

interface ModalRegistrarEgresoProps extends ModalBaseProps {
  initialCuentaId?: string;
}

interface RegistrarEgresoForm {
  cuenta_id: string;
  fondo_id: string;
  monto_origen: string;
  tasa_cambio: string;
  referencia: string;
  concepto: string;
  fecha: string;
}

function parseNumber(val: unknown): number {
  return parseFloat(String(val || '').replace(/\./g, '').replace(',', '.')) || 0;
}

const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((v) => Number(v));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateToYmd = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function formatNumberInput(value: unknown, maxDecimals = 2): string {
  const cleanedRaw = String(value || '').replace(/[^0-9,]/g, '');
  const parts = cleanedRaw.split(',');
  parts[0] = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const integerPart = parts[0] ?? '';
  const decimalPart = (parts[1] || '').slice(0, maxDecimals);
  return decimalPart ? `${integerPart},${decimalPart}` : integerPart;
}

function formatCuentaDestinoLabel(cuenta: CuentaBancaria): string {
  const nombreCuenta = String(cuenta.apodo || cuenta.nombre_banco || cuenta.tipo || `Cuenta ${cuenta.id}`).trim();
  const ultimos4 = String(cuenta.numero_cuenta || '').replace(/\D/g, '').slice(-4);
  return ultimos4.length === 4 ? `${nombreCuenta} - ****${ultimos4}` : nombreCuenta;
}

export const ModalPagoProveedor: React.FC<ModalBaseProps> = ({ onClose, onSuccess }) => {
  const { showAlert, showConfirm } = useDialog();

  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [gastos, setGastos] = useState<GastoPendiente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);

  const [form, setForm] = useState<PagoProveedorForm>({
    gasto_id: '',
    fondo_id: '',
    monto_origen: '',
    tasa_cambio: '',
    referencia: '',
    fecha_pago: new Date().toISOString().split('T')[0] ?? '',
    nota: '',
  });

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [resFondos, resGastos] = await Promise.all([
          fetch(`${API_BASE_URL}/fondos`, { headers }),
          fetch(`${API_BASE_URL}/gastos-pendientes-pago`, { headers }),
        ]);
        const dataFondos: FondosResponse = (await resFondos.json()) as FondosResponse;
        const dataGastos: GastosPendientesResponse = (await resGastos.json()) as GastosPendientesResponse;

        if (dataFondos.status === 'success' && Array.isArray(dataFondos.fondos)) setFondos(dataFondos.fondos);
        if (dataGastos.status === 'success' && Array.isArray(dataGastos.gastos)) setGastos(dataGastos.gastos);
      } catch (error) {
        console.error(error);
        await showAlert({ title: 'Error', message: 'No se pudieron cargar fondos y gastos pendientes.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const selectedFondo = fondos.find((f) => f.id.toString() === form.fondo_id);
  const isBs = selectedFondo?.moneda === 'BS';

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json: BcvResponse = (await response.json()) as BcvResponse;
      if (json?.promedio) {
        const rateNumber = parseFloat(String(json.promedio));
        const formattedRate = Number.isFinite(rateNumber)
          ? formatNumberInput(rateNumber.toFixed(3).replace('.', ','), 3)
          : formatNumberInput(String(json.promedio).replace('.', ','), 3);
        setForm((prev: PagoProveedorForm) => ({ ...prev, tasa_cambio: formattedRate }));
      }
    } catch {
      await showAlert({ title: 'BCV no disponible', message: 'No se pudo obtener la tasa BCV.', variant: 'warning' });
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const montoUsd = useMemo(() => {
    const monto = parseNumber(form.monto_origen);
    const tasa = parseNumber(form.tasa_cambio) || 1;
    return isBs ? monto / tasa : monto;
  }, [form.monto_origen, form.tasa_cambio, isBs]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const ok = await showConfirm({
      title: 'Confirmar pago',
      message: `Se aplicara un pago por $${formatMoney(montoUsd)} al proveedor.`,
      confirmText: 'Procesar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/pagos-proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          monto_usd: montoUsd.toFixed(2),
          monto_bs: isBs ? parseNumber(form.monto_origen) : null,
        }),
      });
      const result: ApiResult = (await res.json()) as ApiResult;
      if (result.status === 'success') {
        await showAlert({ title: 'Pago registrado', message: result.message || 'Pago registrado correctamente.', variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || 'No se pudo procesar el pago.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo registrar el pago.', variant: 'danger' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Pagar a Proveedor</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Factura Pendiente *</label>
              <select required value={form.gasto_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, gasto_id: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione una factura...</option>
                {gastos.map((g) => (
                  <option key={g.id} value={g.id}>{g.proveedor} - {g.concepto} (Debe: ${g.deuda_restante})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fondo de Origen *</label>
              <select required value={form.fondo_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, fondo_id: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione un fondo...</option>
                {fondos.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto Pagado ({selectedFondo ? selectedFondo.moneda : '?'}) *</label>
                <input required type="text" value={form.monto_origen} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, monto_origen: formatNumberInput(e.target.value, 2) })} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>

              {isBs && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa BCV *</label>
                  <div className="flex gap-2">
                    <input required type="text" value={form.tasa_cambio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, tasa_cambio: formatNumberInput(e.target.value, 3) })} placeholder="Ej: 36,500" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                    <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-3 rounded-xl font-bold border border-blue-300 dark:border-blue-700">
                      {isFetchingBCV ? '...' : 'BCV'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedFondo && form.monto_origen && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/50 flex justify-between items-center">
                <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Se descontara:</span>
                <span className="font-black text-red-600 dark:text-red-300 text-lg">${formatMoney(montoUsd)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                <input required type="text" value={form.referencia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, referencia: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                <DatePicker
                  selected={ymdToDate(form.fecha_pago)}
                  onChange={(date: Date | null) => setForm({ ...form, fecha_pago: dateToYmd(date) })}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={es}
                  placeholderText="Fecha (dd/mm/yyyy)"
                  showIcon
                  toggleCalendarOnIconClick
                  wrapperClassName="w-full min-w-0"
                  popperClassName="habioo-datepicker-popper"
                  calendarClassName="habioo-datepicker-calendar"
                  className="h-[50px] w-full rounded-xl border border-gray-300 bg-white p-3 pr-10 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg">Confirmar Pago a Proveedor</button>
          </form>
        )}
      </div>
    </div>
  );
};

export const ModalTransferencia: React.FC<ModalBaseProps> = ({ onClose, onSuccess }) => {
  const { showAlert, showConfirm } = useDialog();

  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');

  const [form, setForm] = useState<TransferenciaForm>({
    fondo_origen_id: '',
    monto_origen: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0] ?? '',
    nota: '',
  });

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [resFondos, resBancos] = await Promise.all([
          fetch(`${API_BASE_URL}/fondos`, { headers }),
          fetch(`${API_BASE_URL}/bancos`, { headers }),
        ]);

        const dataFondos: FondosResponse = (await resFondos.json()) as FondosResponse;
        const dataBancos: BancosResponse = (await resBancos.json()) as BancosResponse;

        if (dataFondos.status === 'success' && Array.isArray(dataFondos.fondos)) setFondos(dataFondos.fondos);
        if (dataBancos.status === 'success' && Array.isArray(dataBancos.bancos)) setCuentas(dataBancos.bancos);
      } catch (error) {
        console.error(error);
        await showAlert({ title: 'Error', message: 'No se pudieron cargar las cuentas y fondos.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fondoOrigen = fondos.find((f) => f.id.toString() === form.fondo_origen_id);
  const cuentaOrigenId = fondoOrigen?.cuenta_bancaria_id?.toString() || '';
  const cuentasDestinoDisponibles = cuentas.filter((c) => c.id.toString() !== cuentaOrigenId);
  const fondosDestinoCuenta = fondos.filter((f) =>
    f.cuenta_bancaria_id?.toString() === cuentaDestinoId &&
    (!fondoOrigen || String(f.moneda || '').toUpperCase() === String(fondoOrigen.moneda || '').toUpperCase()) &&
    f.id.toString() !== form.fondo_origen_id
  );
  const cuentaDestinoSinFondos = Boolean(cuentaDestinoId) && fondosDestinoCuenta.length === 0;
  const montoOrigenNum = parseNumber(form.monto_origen);

  const distribucionPreview = useMemo(() => {
    if (!fondoOrigen || !cuentaDestinoId || cuentaDestinoSinFondos || montoOrigenNum <= 0) return [];
    const noOperativos = fondosDestinoCuenta.filter((f) => !f.es_operativo);
    const principal = fondosDestinoCuenta.find((f) => f.es_operativo) || fondosDestinoCuenta[0];
    const items = noOperativos.map((f) => {
      const pct = parseNumber(f.porcentaje_asignacion || 0);
      const monto = Number(((montoOrigenNum * pct) / 100).toFixed(2));
      return { id: String(f.id), nombre: f.nombre, pct, monto };
    });
    const usado = Number(items.reduce((acc, item) => acc + item.monto, 0).toFixed(2));
    const resto = Number((montoOrigenNum - usado).toFixed(2));
    if (principal && resto !== 0) {
      const idx = items.findIndex((item) => item.id === String(principal.id));
      if (idx >= 0) {
        const current = items[idx];
        if (current) current.monto = Number((current.monto + resto).toFixed(2));
      }
      else items.push({ id: String(principal.id), nombre: principal.nombre, pct: Number((100 - noOperativos.reduce((acc, f) => acc + parseNumber(f.porcentaje_asignacion || 0), 0)).toFixed(2)), monto: resto });
    }
    return items;
  }, [cuentaDestinoId, cuentaDestinoSinFondos, fondoOrigen, fondosDestinoCuenta, montoOrigenNum]);

  const isTransferFormValid = Boolean(
    form.fondo_origen_id &&
    cuentaDestinoId &&
    montoOrigenNum > 0 &&
    form.referencia.trim() &&
    form.fecha &&
    !cuentaDestinoSinFondos
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!form.fondo_origen_id || !cuentaDestinoId) {
      await showAlert({ title: 'Campos requeridos', message: 'Seleccione fondo de origen y cuenta destino.', variant: 'warning' });
      return;
    }
    if (cuentaDestinoSinFondos) {
      await showAlert({
        title: 'Cuenta sin fondos',
        message: 'La cuenta destino seleccionada no tiene fondos creados. Cree un fondo primero en la configuración.',
        variant: 'warning',
      });
      return;
    }
    if (montoOrigenNum <= 0) {
      await showAlert({ title: 'Monto invalido', message: 'El monto a transferir debe ser mayor a 0.', variant: 'warning' });
      return;
    }
    if (!fondoOrigen) {
      await showAlert({ title: 'Fondos invalidos', message: 'No se pudo identificar el fondo de origen.', variant: 'warning' });
      return;
    }

    const ok = await showConfirm({
      title: 'Confirmar transferencia',
      message: `Se transferirán ${form.monto_origen} ${fondoOrigen.moneda} y se distribuirán automáticamente en los fondos de la cuenta destino según sus porcentajes.`,
      confirmText: 'Transferir',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/transferencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          cuenta_destino_id: Number(cuentaDestinoId),
          monto_origen: montoOrigenNum,
          tasa_cambio: null,
          monto_destino: montoOrigenNum,
        }),
      });
      const result: ApiResult = (await res.json()) as ApiResult;
      if (result.status === 'success') {
        await showAlert({ title: 'Transferencia aplicada', message: result.message || 'Transferencia aplicada correctamente.', variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || 'No se pudo transferir.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo procesar la transferencia.', variant: 'danger' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 custom-scrollbar max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transferir Dinero</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando fondos...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Sale de (Origen) *</label>
              <select
                required
                value={form.fondo_origen_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setForm({ ...form, fondo_origen_id: e.target.value });
                  setCuentaDestinoId('');
                }}
                className="w-full p-3 rounded-xl border border-blue-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-blue-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
              >
                <option value="">Seleccione fondo origen...</option>
                {fondos.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>)}
              </select>
            </div>

            {fondoOrigen && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">Cuenta Destino *</label>
                <select
                  required
                  value={cuentaDestinoId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setCuentaDestinoId(e.target.value);
                  }}
                  className="w-full p-3 rounded-xl border border-indigo-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-indigo-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 font-semibold"
                >
                  <option value="">Seleccione cuenta destino...</option>
                  {cuentasDestinoDisponibles.map((cuenta: CuentaBancaria) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {formatCuentaDestinoLabel(cuenta)}
                    </option>
                  ))}
                </select>
                {cuentaDestinoSinFondos && (
                  <p className="mt-2 text-sm text-red-500">
                    Esta cuenta no tiene fondos creados. Debe crear un fondo primero en la configuración para poder recibir transferencias.
                  </p>
                )}
              </div>
            )}

            

            {fondoOrigen && cuentaDestinoId && !cuentaDestinoSinFondos && (
              <div className="animate-fadeIn space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300">
                  Al confirmar, el monto se distribuirá automáticamente entre los fondos de la cuenta destino según sus porcentajes de asignación.
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a Enviar *</label>
                    <input required type="text" value={form.monto_origen} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, monto_origen: formatNumberInput(e.target.value, 2) })} placeholder="Ej: 1.500,00" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                </div>

                {form.monto_origen && distribucionPreview.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/50 space-y-2">
                    <div className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Distribución automática en cuenta destino</div>
                    <div className="space-y-1 text-sm">
                      {distribucionPreview.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-green-800 dark:text-green-200">
                          <span>{item.nombre} ({item.pct.toFixed(2)}%)</span>
                          <span className="font-bold">{fondoOrigen.moneda === 'USD' ? '$' : 'Bs '}{formatMoney(item.monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                    <input required type="text" value={form.referencia} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, referencia: e.target.value.replace(/\s/g, '') })} placeholder="Sin espacios" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                    <DatePicker
                      selected={ymdToDate(form.fecha)}
                      onChange={(date: Date | null) => setForm({ ...form, fecha: dateToYmd(date) })}
                      maxDate={new Date()}
                      dateFormat="dd/MM/yyyy"
                      locale={es}
                      placeholderText="Fecha (dd/mm/yyyy)"
                      showIcon
                      toggleCalendarOnIconClick
                      wrapperClassName="w-full min-w-0"
                      popperClassName="habioo-datepicker-popper"
                      calendarClassName="habioo-datepicker-calendar"
                      className="h-[50px] w-full rounded-xl border border-gray-300 bg-white p-3 pr-10 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (Opcional)</label>
                  <textarea rows={2} value={form.nota} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, nota: e.target.value })} placeholder="Motivo de la transferencia" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary resize-none" />
                </div>

                <button type="submit" disabled={!isTransferFormValid} className="w-full py-3 mt-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  Procesar Transferencia
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export const ModalRegistrarEgreso: React.FC<ModalRegistrarEgresoProps> = ({ onClose, onSuccess, initialCuentaId = '' }) => {
  const { showAlert, showConfirm } = useDialog();
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const [form, setForm] = useState<RegistrarEgresoForm>({
    cuenta_id: initialCuentaId || '',
    fondo_id: '',
    monto_origen: '',
    tasa_cambio: '',
    referencia: '',
    concepto: '',
    fecha: new Date().toISOString().split('T')[0] ?? '',
  });

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [resFondos, resBancos] = await Promise.all([
          fetch(`${API_BASE_URL}/fondos`, { headers }),
          fetch(`${API_BASE_URL}/bancos`, { headers }),
        ]);
        const dataFondos: FondosResponse = (await resFondos.json()) as FondosResponse;
        const dataBancos: BancosResponse = (await resBancos.json()) as BancosResponse;
        if (dataFondos.status === 'success' && Array.isArray(dataFondos.fondos)) setFondos(dataFondos.fondos);
        if (dataBancos.status === 'success' && Array.isArray(dataBancos.bancos)) setCuentas(dataBancos.bancos);
      } catch {
        await showAlert({ title: 'Error', message: 'No se pudieron cargar cuentas y fondos.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const cuentaSeleccionada = cuentas.find((c) => String(c.id) === form.cuenta_id);
  const cuentaEsUsd = String(cuentaSeleccionada?.moneda || '').toUpperCase() === 'USD';
  const fondosCuenta = useMemo(
    () => fondos.filter((f) => String(f.cuenta_bancaria_id) === form.cuenta_id),
    [fondos, form.cuenta_id]
  );
  const montoOrigenNum = parseNumber(form.monto_origen);
  const tasaNum = parseNumber(form.tasa_cambio);
  const equivalenteUsd = useMemo(() => {
    if (!montoOrigenNum) return 0;
    if (cuentaEsUsd) return montoOrigenNum;
    if (tasaNum > 0) return montoOrigenNum / tasaNum;
    return 0;
  }, [montoOrigenNum, tasaNum, cuentaEsUsd]);

  useEffect(() => {
    if (!form.cuenta_id) {
      if (form.fondo_id !== '') {
        setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: '' }));
      }
      return;
    }
    const exists = fondosCuenta.some((f) => String(f.id) === form.fondo_id);
    if (!exists) {
      const nextFondoId = String(fondosCuenta[0]?.id || '');
      if (nextFondoId !== form.fondo_id) {
        setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: nextFondoId }));
      }
    }
  }, [form.cuenta_id, form.fondo_id, fondosCuenta]);

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json: BcvResponse = (await response.json()) as BcvResponse;
      if (json?.promedio) {
        const rateNumber = parseFloat(String(json.promedio));
        const formattedRate = Number.isFinite(rateNumber)
          ? formatNumberInput(rateNumber.toFixed(3).replace('.', ','), 3)
          : formatNumberInput(String(json.promedio).replace('.', ','), 3);
        setForm((prev: RegistrarEgresoForm) => ({ ...prev, tasa_cambio: formattedRate }));
      }
    } catch {
      await showAlert({ title: 'BCV no disponible', message: 'No se pudo obtener la tasa BCV.', variant: 'warning' });
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const isValid = Boolean(
    form.cuenta_id &&
    form.fondo_id &&
    montoOrigenNum > 0 &&
    form.referencia.trim() &&
    form.concepto.trim() &&
    form.fecha &&
    (cuentaEsUsd || tasaNum > 0)
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!isValid) return;

    const ok = await showConfirm({
      title: 'Confirmar egreso',
      message: `Se registrará un egreso de ${cuentaEsUsd ? '$' : 'Bs '}${formatMoney(montoOrigenNum)}.`,
      confirmText: 'Registrar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/egresos-manuales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cuenta_id: Number(form.cuenta_id),
          fondo_id: Number(form.fondo_id),
          monto_origen: montoOrigenNum,
          tasa_cambio: cuentaEsUsd ? null : tasaNum,
          referencia: form.referencia.trim(),
          concepto: form.concepto.trim(),
          fecha: form.fecha,
        }),
      });
      const result: ApiResult = (await res.json()) as ApiResult;
      if (!res.ok || result.status !== 'success') {
        await showAlert({ title: 'Error', message: result.message || result.error || 'No se pudo registrar el egreso.', variant: 'danger' });
        return;
      }
      await showAlert({ title: 'Egreso registrado', message: result.message || 'Egreso registrado correctamente.', variant: 'success' });
      onSuccess();
    } catch {
      await showAlert({ title: 'Error de red', message: 'No se pudo registrar el egreso.', variant: 'danger' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 custom-scrollbar max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Registrar Egreso</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde cuenta *</label>
              <select
                required
                value={form.cuenta_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, cuenta_id: e.target.value, fondo_id: '' }))}
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
              >
                <option value="">Seleccione...</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.nombre_banco || 'Banco')} ({c.apodo || 'Cuenta'}){String(c.moneda || '').toUpperCase() === 'USD' ? ' - USD' : ' - Bs'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde fondo *</label>
              <select
                required
                value={form.fondo_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: e.target.value }))}
                disabled={!form.cuenta_id}
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-60"
              >
                <option value="">{form.cuenta_id ? 'Seleccione...' : 'Seleccione cuenta primero'}</option>
                {fondosCuenta.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre} ({String(f.moneda || '').toUpperCase()}) - Disp: {String(f.moneda || '').toUpperCase() === 'USD' ? '$' : 'Bs '}{formatMoney(f.saldo_actual)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Monto {cuentaEsUsd ? '(USD)' : '(Bs)'} *
                </label>
                <input
                  required
                  type="text"
                  value={form.monto_origen}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, monto_origen: formatNumberInput(e.target.value, 2) }))}
                  placeholder="0,00"
                  className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
              {!cuentaEsUsd && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa BCV *</label>
                  <div className="flex gap-2">
                    <input
                      required
                      type="text"
                      value={form.tasa_cambio}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, tasa_cambio: formatNumberInput(e.target.value, 3) }))}
                      placeholder="0,000"
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
                    />
                    <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-3 rounded-xl font-bold border border-blue-300 dark:border-blue-700">
                      {isFetchingBCV ? '...' : 'BCV'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!cuentaEsUsd && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800/50 flex justify-between items-center">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Equivalente USD:</span>
                <span className="font-black text-amber-700 dark:text-amber-200 text-lg">${formatMoney(equivalenteUsd)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                <input
                  required
                  type="text"
                  value={form.referencia}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, referencia: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                <DatePicker
                  selected={ymdToDate(form.fecha)}
                  onChange={(date: Date | null) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, fecha: dateToYmd(date) }))}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  locale={es}
                  placeholderText="Fecha (dd/mm/yyyy)"
                  showIcon
                  toggleCalendarOnIconClick
                  wrapperClassName="w-full min-w-0"
                  popperClassName="habioo-datepicker-popper"
                  calendarClassName="habioo-datepicker-calendar"
                  className="h-[50px] w-full rounded-xl border border-gray-300 bg-white p-3 pr-10 text-gray-900 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Concepto *</label>
              <textarea
                required
                rows={2}
                value={form.concepto}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, concepto: e.target.value }))}
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary resize-none"
              />
            </div>

            <button type="submit" disabled={!isValid} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              Registrar Egreso
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const ModalEliminarFondo: React.FC<ModalEliminarFondoProps> = ({ fondo, fondosDisponibles, onClose, onSuccess }) => {
  const { showAlert, showConfirm } = useDialog();

  const [destinoId, setDestinoId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const saldo = parseFloat(String(fondo?.saldo_actual ?? 0));
  const fondosDestino = fondo ? fondosDisponibles.filter((f) => f.id !== fondo.id && f.moneda === fondo.moneda) : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!fondo) return;

    const ok = await showConfirm({
      title: 'Eliminar fondo',
      message: `Se eliminara el fondo ${fondo.nombre}.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    setLoading(true);
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${fondo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(destinoId ? { destino_id: destinoId } : {}),
      });
      const result: ApiResult = (await res.json()) as ApiResult;
      if (result.status === 'success') {
        await showAlert({ title: 'Fondo eliminado', message: result.message || 'Fondo eliminado correctamente.', variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || result.message || 'No se pudo eliminar.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo conectar con el servidor.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  if (!fondo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Eliminar Fondo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Esta accion desactiva el fondo <strong>{fondo.nombre}</strong>. El historial de movimientos se conserva para auditoria.
          </p>

          {saldo > 0 ? (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50">
              <p className="text-xs font-bold text-orange-700 dark:text-orange-300 mb-3 uppercase tracking-wider">
                Saldo restante: {fondo.moneda === 'USD' ? '$' : 'Bs'} {formatMoney(saldo)}
              </p>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fondo destino (opcional, misma moneda)</label>
              <select value={destinoId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDestinoId(e.target.value)} className="w-full p-3 rounded-xl border border-orange-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-orange-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Eliminar sin transferir saldo</option>
                {fondosDestino.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda})</option>)}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Si este fondo no tiene movimientos bancarios, puede eliminarlo aunque tenga saldo.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800/50 mt-4">
              <p className="text-sm font-bold text-green-700 dark:text-green-300">Este fondo tiene saldo en cero y se puede eliminar directamente.</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 mt-4">
            {loading ? 'Procesando...' : 'Confirmar Eliminacion'}
          </button>
        </form>
      </div>
    </div>
  );
};
