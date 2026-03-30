import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from './ui/DatePicker';
import { es } from 'date-fns/locale/es';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from './ui/DialogProvider';

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

interface ComboboxOption {
  value: string;
  label: string;
}

interface EstadoCuentaMovimientoRow {
  tipo?: string;
  monto_bs?: number | string | null;
  monto_usd?: number | string | null;
  fondo_id?: number | string | null;
  fondo_origen_id?: number | string | null;
  fondo_destino_id?: number | string | null;
}

interface BancosEstadoCuentaResponse extends ApiResult {
  movimientos?: EstadoCuentaMovimientoRow[];
  data?: EstadoCuentaMovimientoRow[];
}

function parseNumber(val: unknown): number {
  return parseFloat(String(val || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function toNumeric(val: unknown): number {
  const n = parseFloat(String(val ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function isCuentaUsd(cuenta: CuentaBancaria): boolean {
  const moneda = String(cuenta.moneda || '').trim().toUpperCase();
  if (moneda === 'USD') return true;
  const tipo = String(cuenta.tipo || '').trim().toUpperCase();
  if (tipo.includes('USD')) return true;
  const apodo = String(cuenta.apodo || '').trim().toUpperCase();
  if (apodo.includes('USD')) return true;
  return false;
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
  const raw = String(value || '').replace(/[^0-9.,]/g, '');
  if (!raw) return '';

  // Regla de mascara: punto para miles y coma para decimales.
  const hasComma = raw.includes(',');
  const commaIndex = hasComma ? raw.lastIndexOf(',') : -1;

  const integerSection = hasComma ? raw.slice(0, commaIndex) : raw;
  const integerDigits = integerSection.replace(/\D/g, '');
  const integerPart = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!hasComma) return integerPart;

  const decimalDigits = raw.slice(commaIndex + 1).replace(/\D/g, '').slice(0, maxDecimals);
  if (raw.endsWith(',')) return `${integerPart},`;
  return `${integerPart},${decimalDigits}`;
}

function formatCuentaDestinoLabel(cuenta: CuentaBancaria): string {
  const moneda = isCuentaUsd(cuenta) ? 'USD' : 'BS';
  const ultimos4 = String(cuenta.numero_cuenta || '').replace(/\D/g, '').slice(-4);
  const banco = String(cuenta.nombre_banco || '').trim();
  const apodo = String(cuenta.apodo || '').trim();

  if (moneda === 'USD') {
    const nombreUsd = apodo || cuenta.tipo || cuenta.nombre_banco || `Cuenta ${cuenta.id}`;
    return `${String(nombreUsd).trim()} (USD)`;
  }

  const baseBs = apodo ? `${banco || 'Banco'} (${apodo})` : (banco || 'Banco');
  return ultimos4.length === 4 ? `${baseBs} - ****${ultimos4} - Bs` : `${baseBs} - Bs`;
}

function formatFondoOrigenLabel(fondo: Fondo, cuenta?: CuentaBancaria, saldoActualOverride?: number): string {
  const moneda = String(fondo.moneda || '').toUpperCase() === 'USD' ? 'USD' : 'BS';
  const saldoActual = Number.isFinite(saldoActualOverride as number)
    ? Number(saldoActualOverride)
    : toNumeric(fondo.saldo_actual);
  if (moneda === 'USD') {
    return `${fondo.nombre} (USD) - Disp: $${formatMoney(saldoActual)}`;
  }
  const cuentaLabel = cuenta ? formatCuentaDestinoLabel(cuenta) : (moneda === 'USD' ? 'Cuenta USD' : 'Cuenta Bs');
  const saldoLabel = moneda === 'USD' ? '$' : 'Bs ';
  return `${cuentaLabel} | ${fondo.nombre} (${moneda}) - Disp: ${saldoLabel}${formatMoney(saldoActual)}`;
}

async function fetchSaldosFondosPorCuenta(
  cuentaId: string,
  token: string,
  fondosCuenta: Fondo[],
): Promise<Record<string, number>> {
  if (!cuentaId || !token || fondosCuenta.length === 0) return {};

  const fondoMoneda = new Map<string, string>();
  fondosCuenta.forEach((f) => fondoMoneda.set(String(f.id), String(f.moneda || '').toUpperCase()));

  const res = await fetch(`${API_BASE_URL}/bancos-admin/${encodeURIComponent(cuentaId)}/estado-cuenta`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: BancosEstadoCuentaResponse = (await res.json()) as BancosEstadoCuentaResponse;
  const raw = Array.isArray(data.movimientos)
    ? data.movimientos
    : Array.isArray(data.data)
      ? data.data
      : [];

  const saldos: Record<string, number> = {};
  raw.forEach((mov) => {
    const tipo = String(mov.tipo || '').toUpperCase();
    const sign = tipo === 'EGRESO' ? -1 : 1;
    const montoBs = toNumeric(mov.monto_bs);
    const montoUsd = toNumeric(mov.monto_usd);

    const aplicar = (fondoIdRaw: unknown): void => {
      if (fondoIdRaw === null || fondoIdRaw === undefined || fondoIdRaw === '') return;
      const key = String(fondoIdRaw);
      const moneda = fondoMoneda.get(key) || 'BS';
      const monto = moneda === 'USD' ? montoUsd : montoBs;
      saldos[key] = (saldos[key] || 0) + (sign * monto);
    };

    if (mov.fondo_id !== null && mov.fondo_id !== undefined && mov.fondo_id !== '') {
      aplicar(mov.fondo_id);
      return;
    }
    if (sign < 0 && mov.fondo_origen_id !== null && mov.fondo_origen_id !== undefined && mov.fondo_origen_id !== '') {
      aplicar(mov.fondo_origen_id);
      return;
    }
    if (sign > 0 && mov.fondo_destino_id !== null && mov.fondo_destino_id !== undefined && mov.fondo_destino_id !== '') {
      aplicar(mov.fondo_destino_id);
    }
  });

  return saldos;
}

const SearchableCombobox: React.FC<{
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ options, value, onChange, placeholder, required = false, disabled = false, className = '' }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const selected = options.find((opt) => opt.value === value);
    setQuery(selected?.label || '');
  }, [value, options]);

  useEffect(() => {
    const onDocMouseDown = (ev: globalThis.MouseEvent): void => {
      const target = ev.target as Node | null;
      if (!target) return;
      const clickInsideInput = rootRef.current?.contains(target);
      const clickInsideMenu = menuRef.current?.contains(target);
      if (!clickInsideInput && !clickInsideMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const txt = query.trim().toLowerCase();
    if (!txt) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(txt));
  }, [options, query]);

  useEffect(() => {
    if (!open || !inputRef.current) return;

    const updatePosition = (): void => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${!disabled ? 'pr-10' : ''}`}
      />
      {!disabled && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            onChange('');
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          title="Limpiar selección"
          aria-label="Limpiar selección"
        >
          ×
        </button>
      )}
      {required && <input type="hidden" required value={value} readOnly />}
      {open && !disabled && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[260] max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setQuery(opt.label);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

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
  const [saldosFondos, setSaldosFondos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');

  const [form, setForm] = useState<TransferenciaForm>({
    fondo_origen_id: '',
    monto_origen: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0] ?? '',
    nota: '',
  });
  const resetTransferForm = (): void => {
    setForm({
      fondo_origen_id: '',
      monto_origen: '',
      referencia: '',
      fecha: new Date().toISOString().split('T')[0] ?? '',
      nota: '',
    });
    setCuentaDestinoId('');
  };
  const handleCloseTransferModal = (): void => {
    resetTransferForm();
    onClose();
  };

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

  useEffect(() => {
    const token = localStorage.getItem('habioo_token') || '';
    const cuentasUnicas = Array.from(new Set(
      fondos
        .map((f) => String(f.cuenta_bancaria_id || ''))
        .filter((id) => id !== '')
    ));
    if (!token || cuentasUnicas.length === 0) {
      setSaldosFondos({});
      return;
    }

    let cancelled = false;
    const loadSaldos = async (): Promise<void> => {
      try {
        const results = await Promise.all(
          cuentasUnicas.map(async (cuentaId) => {
            const fondosCuenta = fondos.filter((f) => String(f.cuenta_bancaria_id) === cuentaId);
            const saldos = await fetchSaldosFondosPorCuenta(cuentaId, token, fondosCuenta);
            return saldos;
          })
        );
        if (cancelled) return;
        const merged: Record<string, number> = {};
        results.forEach((part) => {
          Object.entries(part).forEach(([k, v]) => { merged[k] = v; });
        });
        setSaldosFondos(merged);
      } catch {
        if (!cancelled) setSaldosFondos({});
      }
    };
    void loadSaldos();
    return () => { cancelled = true; };
  }, [fondos]);

  const fondoOrigen = fondos.find((f) => f.id.toString() === form.fondo_origen_id);
  const cuentaOrigenId = fondoOrigen?.cuenta_bancaria_id?.toString() || '';
  const monedaOrigen = String(fondoOrigen?.moneda || '').toUpperCase();
  const cuentaById = useMemo(() => {
    const map = new Map<string, CuentaBancaria>();
    cuentas.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [cuentas]);
  const cuentasDestinoDisponibles = cuentas.filter((c) => {
    if (c.id.toString() === cuentaOrigenId) return false;
    if (!fondoOrigen) return true;
    return fondos.some(
      (f) =>
        String(f.cuenta_bancaria_id) === String(c.id)
        && String(f.moneda || '').toUpperCase() === monedaOrigen,
    );
  });
  const fondosDestinoCuenta = fondos.filter((f) =>
    f.cuenta_bancaria_id?.toString() === cuentaDestinoId &&
    (!fondoOrigen || String(f.moneda || '').toUpperCase() === String(fondoOrigen.moneda || '').toUpperCase()) &&
    f.id.toString() !== form.fondo_origen_id
  );
  const cuentaDestinoSinFondos = Boolean(cuentaDestinoId) && fondosDestinoCuenta.length === 0;
  const montoOrigenNum = parseNumber(form.monto_origen);
  const opcionesFondoOrigen = useMemo<ComboboxOption[]>(
    () => fondos.map((f) => ({
      value: String(f.id),
      label: formatFondoOrigenLabel(
        f,
        cuentaById.get(String(f.cuenta_bancaria_id || '')),
        saldosFondos[String(f.id)]
      ),
    })),
    [fondos, cuentaById, saldosFondos],
  );
  const opcionesCuentaDestino = useMemo<ComboboxOption[]>(
    () => cuentasDestinoDisponibles.map((cuenta) => ({
      value: String(cuenta.id),
      label: formatCuentaDestinoLabel(cuenta),
    })),
    [cuentasDestinoDisponibles],
  );

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
    if (isSubmittingTransfer) return;

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
    setIsSubmittingTransfer(true);
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
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 custom-scrollbar max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transferir Dinero</h3>
          <button onClick={handleCloseTransferModal} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando fondos...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Sale de (Origen) *</label>
              <SearchableCombobox
                required
                value={form.fondo_origen_id}
                onChange={(next) => {
                  setForm({ ...form, fondo_origen_id: next });
                  setCuentaDestinoId('');
                }}
                options={opcionesFondoOrigen}
                placeholder="Buscar fondo origen..."
                className="w-full p-3 rounded-xl border border-blue-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-blue-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
              />
            </div>

            {fondoOrigen && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">Cuenta Destino *</label>
                <SearchableCombobox
                  required
                  value={cuentaDestinoId}
                  onChange={setCuentaDestinoId}
                  options={opcionesCuentaDestino}
                  placeholder="Buscar cuenta destino..."
                  className="w-full p-3 rounded-xl border border-indigo-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-indigo-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 font-semibold"
                />
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

                <button type="submit" disabled={!isTransferFormValid || isSubmittingTransfer} className="w-full py-3 mt-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingTransfer ? 'Procesando...' : 'Procesar Transferencia'}
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
  const [saldosFondosCuenta, setSaldosFondosCuenta] = useState<Record<string, number>>({});
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
  const resetEgresoForm = (): void => {
    setForm({
      cuenta_id: initialCuentaId || '',
      fondo_id: '',
      monto_origen: '',
      tasa_cambio: '',
      referencia: '',
      concepto: '',
      fecha: new Date().toISOString().split('T')[0] ?? '',
    });
  };
  const handleCloseEgresoModal = (): void => {
    resetEgresoForm();
    onClose();
  };

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
  const opcionesCuentaEgreso = useMemo<ComboboxOption[]>(
    () => cuentas.map((c) => ({ value: String(c.id), label: formatCuentaDestinoLabel(c) })),
    [cuentas],
  );
  const opcionesFondoEgreso = useMemo<ComboboxOption[]>(
    () => fondosCuenta.map((f) => {
      const saldoVista = saldosFondosCuenta[String(f.id)];
      const saldo = typeof saldoVista === 'number' ? saldoVista : toNumeric(f.saldo_actual);
      return {
        value: String(f.id),
        label: `${f.nombre} (${String(f.moneda || '').toUpperCase()}) - Disp: ${String(f.moneda || '').toUpperCase() === 'USD' ? '$' : 'Bs '}${formatMoney(saldo)}`,
      };
    }),
    [fondosCuenta, saldosFondosCuenta],
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
      setSaldosFondosCuenta({});
      if (form.fondo_id !== '') {
        setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: '' }));
      }
      return;
    }
    const exists = fondosCuenta.some((f) => String(f.id) === form.fondo_id);
    if (!exists && form.fondo_id !== '') {
      setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: '' }));
    }
  }, [form.cuenta_id, form.fondo_id, fondosCuenta]);

  useEffect(() => {
    const token = localStorage.getItem('habioo_token') || '';
    if (!form.cuenta_id || !token || fondosCuenta.length === 0) {
      setSaldosFondosCuenta({});
      return;
    }

    let cancelled = false;
    const loadSaldos = async (): Promise<void> => {
      try {
        const saldos = await fetchSaldosFondosPorCuenta(form.cuenta_id, token, fondosCuenta);
        if (!cancelled) setSaldosFondosCuenta(saldos);
      } catch {
        if (!cancelled) setSaldosFondosCuenta({});
      }
    };
    void loadSaldos();
    return () => { cancelled = true; };
  }, [form.cuenta_id, fondosCuenta]);

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
          <button onClick={handleCloseEgresoModal} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde cuenta *</label>
              <SearchableCombobox
                required
                value={form.cuenta_id}
                onChange={(next) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, cuenta_id: next, fondo_id: '' }))}
                options={opcionesCuentaEgreso}
                placeholder="Buscar cuenta..."
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde fondo *</label>
              <SearchableCombobox
                required
                disabled={!form.cuenta_id}
                value={form.fondo_id}
                onChange={(next) => setForm((prev: RegistrarEgresoForm) => ({ ...prev, fondo_id: next }))}
                options={opcionesFondoEgreso}
                placeholder={form.cuenta_id ? 'Buscar fondo...' : 'Seleccione cuenta primero'}
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary disabled:opacity-60"
              />
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





