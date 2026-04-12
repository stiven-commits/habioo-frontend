import React, { useEffect, useRef, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from './ui/ModalBase';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from './ui/DialogProvider';
import DatePicker from './ui/DatePicker';
import FormField from './ui/FormField';

interface ModalFondosProps {
  cuenta: CuentaBancaria;
  onClose: () => void;
  onDeleteFondo?: (fondo: Fondo) => void;
  refreshKey?: number;
}

interface CuentaBancaria {
  id: number;
  nombre_banco: string;
  apodo: string;
  tipo?: string;
  moneda?: string;
}

interface Fondo {
  id: number;
  cuenta_bancaria_id: number;
  nombre: string;
  es_operativo: boolean;
  porcentaje_asignacion: string | number;
  saldo_actual: string | number;
  moneda: string;
  visible_propietarios?: boolean;
  fecha_saldo?: string | null;
}

interface FormState {
  nombre: string;
  moneda: string;
  porcentaje: string;
  saldo_inicial: string;
  fecha_saldo: string;
  es_operativo: boolean;
}

interface FondosResponse {
  status: string;
  fondos: Fondo[];
}

interface ApiActionResponse {
  status: string;
  message?: string;
}

type DialogVariant = 'warning' | 'danger' | 'success';

interface AlertOptions {
  title: string;
  message: string;
  variant: DialogVariant;
}

interface ConfirmOptions extends AlertOptions {
  confirmText: string;
}

interface DialogContextType {
  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const initialForm: FormState = {
  nombre: '',
  moneda: 'BS',
  porcentaje: '',
  saldo_inicial: '0',
  fecha_saldo: '',
  es_operativo: false,
};

const normalizeTipo = (value: string): string => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeMoneda = (value: unknown): 'BS' | 'USD' | 'EUR' | null => {
  const raw = String(value || '').trim().toUpperCase();
  if (['BS', 'VES', 'BOLIVAR', 'BOLIVARES'].includes(raw)) return 'BS';
  if (['USD', 'US$', 'DOLAR', 'DOLARES'].includes(raw)) return 'USD';
  if (['EUR', 'EURO', 'EUROS'].includes(raw)) return 'EUR';
  return null;
};

const resolveTipoMoneda = (tipo: string): { moneda: 'BS' | 'USD' | null; blocked: boolean } => {
  const t = normalizeTipo(tipo);
  const isInternational = t.includes('zelle')
    || t.includes('panama')
    || (t.includes('efectivo') && t.includes('usd'))
    || t.includes('internacional')
    || t.includes('usd');
  if (isInternational) {
    return { moneda: 'USD', blocked: true };
  }

  const isNational = t.includes('pago movil')
    || t.includes('transferencia')
    || t.includes('nacional')
    || t.includes('ves')
    || (t.includes('bs') && !t.includes('usd'));
  if (isNational) {
    return { moneda: 'BS', blocked: true };
  }

  const isGenericCash = t.trim() === 'efectivo';
  if (isGenericCash) {
    return { moneda: null, blocked: false };
  }

  return { moneda: null, blocked: false };
};

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

const ymdToDisplay = (ymd?: string | null): string => {
  if (!ymd) return '-';
  const safeYmd = String(ymd).trim().slice(0, 10);
  const [year, month, day] = safeYmd.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
};

const ModalFondos: FC<ModalFondosProps> = ({ cuenta, onClose, onDeleteFondo, refreshKey = 0 }) => {
  const { showAlert, showConfirm } = useDialog() as DialogContextType;
  const cuentaMoneda = normalizeMoneda(cuenta.moneda) || resolveTipoMoneda(`${cuenta.tipo || ''} ${cuenta.nombre_banco || ''}`).moneda;
  const cuentaMonedaBloqueada = Boolean(cuentaMoneda);

  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreatingFondo, setIsCreatingFondo] = useState<boolean>(false);
  const createFondoLockRef = useRef<boolean>(false);
  const [form, setForm] = useState<FormState>({ ...initialForm, moneda: cuentaMoneda || initialForm.moneda });
  const [renamingFondoId, setRenamingFondoId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);

  const fetchFondos = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: FondosResponse = await res.json();
      if (data.status === 'success') {
        const fondosCuenta = data.fondos.filter((f: Fondo) => f.cuenta_bancaria_id === cuenta.id);
        setFondos(fondosCuenta);
      }
    } catch (error) {
      console.error(error);
      await showAlert({ title: 'Error de conexion', message: 'No se pudieron cargar los fondos.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFondos();
  }, [cuenta.id, refreshKey]);

  useEffect(() => {
    const forcedMoneda = cuentaMoneda;
    if (!forcedMoneda) return;
    setForm((prev: FormState) => (prev.moneda === forcedMoneda ? prev : { ...prev, moneda: forcedMoneda }));
  }, [cuenta.id, cuenta.tipo, cuenta.nombre_banco, cuenta.moneda, cuentaMoneda]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const type = e.target instanceof HTMLInputElement ? e.target.type : '';
    const checked = e.target instanceof HTMLInputElement ? e.target.checked : false;

    if (name === 'es_operativo' && checked) {
      setForm((prev: FormState) => ({ ...prev, es_operativo: true, porcentaje: '' }));
      return;
    }
    const field = name as keyof FormState;
    setForm((prev: FormState) => ({ ...prev, [field]: type === 'checkbox' ? checked : value }));
  };

  const formatCurrencyInput = (value: string): string => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    if (rawValue.startsWith('0') && rawValue.length > 1 && rawValue[1] !== ',') {
      rawValue = rawValue.replace(/^0+/, '');
      if (rawValue === '') rawValue = '0';
    }

    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;

    let [integerPart = '', decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimalPart !== undefined) return `${integerPart},${decimalPart.slice(0, 2)}`;
    return integerPart ?? '';
  };

  const handleMonedaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const field = e.target.name as keyof FormState;
    setForm((prev: FormState) => ({ ...prev, [field]: formatCurrencyInput(e.target.value) }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isCreatingFondo || createFondoLockRef.current) return;
    const token = localStorage.getItem('habioo_token');
    
    const isFirstFondo = fondos.length === 0;

    try {
      createFondoLockRef.current = true;
      setIsCreatingFondo(true);
      const res = await fetch(`${API_BASE_URL}/fondos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          moneda: cuentaMoneda || form.moneda,
          cuenta_bancaria_id: cuenta.id,
          es_operativo: isFirstFondo,
        }),
      });

      if (res.ok) {
        setForm({ ...initialForm, moneda: cuentaMoneda || initialForm.moneda });
        fetchFondos();
      } else {
        const errorData: ApiActionResponse = await res.json();
        await showAlert({ title: 'Error', message: errorData.message || 'No se pudo crear el fondo', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo crear el fondo.', variant: 'danger' });
    } finally {
      setIsCreatingFondo(false);
      createFondoLockRef.current = false;
    }
  };

  const handleDeleteFondoLocal = async (id: number): Promise<void> => {
    const ok = await showConfirm({
      title: 'Eliminar fondo',
      message: 'Esta accion desactiva el fondo si cumple las condiciones. ¿Deseas continuar?',
      variant: 'warning',
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiActionResponse = await res.json();

      if (res.ok && data.status === 'success') fetchFondos();
      else await showAlert({ title: 'Error', message: data.message || 'No se pudo eliminar el fondo', variant: 'danger' });
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo eliminar el fondo.', variant: 'danger' });
    }
  };

  const handleStartRename = (fondo: Fondo): void => {
    setRenamingFondoId(fondo.id);
    setRenameValue(fondo.nombre);
  };

  const handleCancelRename = (): void => {
    if (isSavingRename) return;
    setRenamingFondoId(null);
    setRenameValue('');
  };

  const handleSaveRename = async (fondoId: number): Promise<void> => {
    const nombre = renameValue.trim();
    if (!nombre) {
      await showAlert({ title: 'Nombre requerido', message: 'Debe indicar un nombre para el fondo.', variant: 'warning' });
      return;
    }

    const current = fondos.find((f) => f.id === fondoId);
    if (current && current.nombre.trim() === nombre) {
      setRenamingFondoId(null);
      setRenameValue('');
      return;
    }

    const token = localStorage.getItem('habioo_token');
    setIsSavingRename(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${fondoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre }),
      });
      const data: ApiActionResponse = await res.json();

      if (!res.ok || data.status !== 'success') {
        await showAlert({ title: 'Error', message: data.message || 'No se pudo renombrar el fondo.', variant: 'danger' });
        return;
      }

      setFondos((prev: Fondo[]) => prev.map((f) => (f.id === fondoId ? { ...f, nombre } : f)));
      setRenamingFondoId(null);
      setRenameValue('');
    } catch {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo renombrar el fondo.', variant: 'danger' });
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleToggleVisiblePropietarios = async (fondo: Fondo, checked: boolean): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${fondo.id}/visibilidad-propietarios`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visible_propietarios: checked }),
      });
      const data: ApiActionResponse = await res.json();
      if (!res.ok || data.status !== 'success') {
        await showAlert({
          title: 'Error',
          message: data.message || 'No se pudo actualizar la visibilidad del fondo.',
          variant: 'danger',
        });
        return;
      }
      setFondos((prev: Fondo[]) => prev.map((f) => (f.id === fondo.id ? { ...f, visible_propietarios: checked } : f)));
    } catch {
      await showAlert({
        title: 'Error de conexion',
        message: 'No se pudo actualizar la visibilidad para inmuebles.',
        variant: 'danger',
      });
    }
  };

  const handleSetOperativo = async (fondo: Fondo): Promise<void> => {
    // Si ya es operativo, no hacer nada
    if (fondo.es_operativo) return;
    
    // Validar si el fondo que se quiere hacer principal tiene porcentaje asignado
    // Se recomienda advertir que si se hace principal, su porcentaje ingresado se borrará
    const ok = await showConfirm({
      title: 'Hacer Fondo Principal',
      message: `¿Estás seguro de establecer "${fondo.nombre}" como el Fondo Principal para esta cuenta? \n\nCualquier porcentaje que tuviera asignado se anulará, y en su lugar, absorberá el dinero residual que sobre luego de alimentar los fondos auxiliares.`,
      confirmText: 'Establecer como Principal',
      variant: 'warning'
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${fondo.id}/operativo`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data: ApiActionResponse = await res.json();
      if (res.ok && data.status === 'success') {
        fetchFondos();
      } else {
        await showAlert({ title: 'Error', message: data.message || 'No se pudo establecer el fondo como principal.', variant: 'danger' });
      }
    } catch {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo actualizar el fondo principal.', variant: 'danger' });
    }
  };

  const porcentajeUsado = fondos.reduce((acc: number, curr: Fondo) => acc + toNumber(curr.porcentaje_asignacion), 0);
  const porcentajeRestante = Math.max(0, 100 - porcentajeUsado).toFixed(2);
  const tieneOperativo = fondos.some((f: Fondo) => f.es_operativo);

  return (
    <ModalBase
      onClose={onClose}
      title="Configuracion de Fondos"
      helpTooltip="Aqui puedes crear, editar y eliminar fondos de la cuenta bancaria, definir porcentaje de asignacion y marcar fondo principal u opciones de visibilidad."
      subtitle={<>Cuenta bancaria: <strong className="text-donezo-primary">{cuenta.nombre_banco} ({cuenta.apodo})</strong></>}
      maxWidth="max-w-2xl"
      disableClose={isCreatingFondo}
    >

        {!tieneOperativo && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
              <strong className="block text-sm mb-1">💡 Importante</strong>
              El <strong>Fondo Principal (Operativo)</strong> funciona como la cuenta receptora base. Es el motor principal del que dependen las demas alcancías porque a partir de este fondo se descontarán matemáticamente los porcentajes asignados a cualquier otro fondo auxiliar (Reservas, Mejoras, etc.) antes de absorber el dinero sobrante.
            </p>
          </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-end mb-3">
            <h4 className="font-bold text-gray-700 dark:text-gray-300">Distribucion de Ingresos</h4>

            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                fondos.length === 0
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  : Number(porcentajeRestante) > 0
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}
            >
              {fondos.length === 0
                ? 'Asigne un fondo para activar la cuenta'
                : Number(porcentajeRestante) > 0
                  ? `${porcentajeRestante}% asignado al Fondo Principal`
                  : '100% distribuido'}
            </span>
          </div>

          {loading ? <p className="text-sm text-gray-500">Cargando...</p> : fondos.length === 0 ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
              No hay fondos virtuales. Agregue uno abajo para empezar.
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${fondos.length > 1 ? 'md:grid-cols-2' : ''} gap-3 max-h-[22rem] overflow-y-auto custom-scrollbar pr-2`}>
              {fondos.map((f: Fondo) => (
                <div key={f.id} className={`p-4 rounded-xl border flex flex-col gap-3 shadow-sm transition-all ${f.es_operativo ? 'border-donezo-primary bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      {renamingFondoId === f.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-donezo-primary"
                            placeholder="Nuevo nombre del fondo"
                            maxLength={80}
                          />
                          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => { void handleSaveRename(f.id); }}
                              disabled={isSavingRename}
                              className="px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-60"
                            >
                              {isSavingRename ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelRename}
                              disabled={isSavingRename}
                              className="px-3 py-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                          {f.nombre}
                          {f.es_operativo && <span className="bg-donezo-primary text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black">Principal</span>}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">Entrada: <strong className="text-gray-700 dark:text-gray-300">{f.es_operativo ? 'Remanente Automatico' : `${f.porcentaje_asignacion}%`}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Saldo Actual</p>
                      <p className={`font-black text-lg ${f.moneda === 'USD' || f.moneda === 'EUR' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                        {formatMoney(f.saldo_actual)} <span className="text-xs font-normal">{f.moneda}</span>
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center w-full">
                      <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={Boolean(f.es_operativo)}
                          onChange={() => handleSetOperativo(f)}
                          disabled={f.es_operativo}
                          className="rounded border-gray-300 text-donezo-primary focus:ring-donezo-primary disabled:opacity-50"
                        />
                        Fondo Principal
                      </label>
                      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleStartRename(f)}
                          disabled={isSavingRename}
                          className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-60"
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          onClick={() => (onDeleteFondo ? onDeleteFondo(f) : handleDeleteFondoLocal(f.id))}
                          disabled={isSavingRename}
                          className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <label 
                      className="inline-flex items-center gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer"
                      title="Esta opción permite que los inmuebles puedan ver los egresos que se realicen de este dinero desde su panel."
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(f.visible_propietarios ?? true)}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          void handleToggleVisiblePropietarios(f, e.target.checked);
                        }}
                        className="rounded border-gray-300 text-donezo-primary focus:ring-donezo-primary cursor-pointer"
                      />
                      Visible para inmuebles
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-gray-400 hover:text-donezo-primary transition-colors">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </label>
                    <div className="w-full text-right">
                      <p className="text-[10px] uppercase font-bold tracking-wide text-gray-400 dark:text-gray-500">
                        Fecha apertura del fondo
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                        {ymdToDisplay(f.fecha_saldo)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Aperturar Nuevo Fondo</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${fondos.length === 0 ? 'md:col-span-3' : 'md:col-span-2'}`}>
              <FormField label="Nombre del Fondo" required>
                <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Fondo de Reserva" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
              </FormField>
            </div>

            {fondos.length > 0 && (
              <FormField label="% de Ingresos" required>
                <input type="number" step="0.01" min="0" max={porcentajeRestante} name="porcentaje" value={form.porcentaje} onChange={handleChange} required placeholder="Ej: 10" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
              </FormField>
            )}

            <FormField label="Moneda Base">
              <select
                name="moneda"
                value={form.moneda}
                onChange={handleChange}
                disabled={cuentaMonedaBloqueada}
                className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {cuentaMonedaBloqueada ? (
                  <option value={cuentaMoneda || 'BS'} className="bg-white dark:bg-gray-800">
                    {cuentaMoneda === 'USD' ? 'Dólares (USD)' : cuentaMoneda === 'EUR' ? 'Euros (EUR)' : 'Bolívares (BS)'}
                  </option>
                ) : (
                  <>
                    <option value="BS" className="bg-white dark:bg-gray-800">Bolívares (BS)</option>
                    <option value="USD" className="bg-white dark:bg-gray-800">Dólares (USD)</option>
                    <option value="EUR" className="bg-white dark:bg-gray-800">Euros (EUR)</option>
                  </>
                )}
              </select>
            </FormField>

            <div className={`${fondos.length === 0 ? 'md:col-span-2' : ''}`}>
              <FormField label="Saldo de Apertura">
                <input type="text" name="saldo_inicial" value={form.saldo_inicial} onChange={handleMonedaChange} required placeholder="0,00" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white font-mono" />
              </FormField>
            </div>

            <FormField label="Fecha del saldo">
              <DatePicker
                selected={ymdToDate(form.fecha_saldo)}
                onChange={(date) => setForm((prev: FormState) => ({ ...prev, fecha_saldo: dateToYmd(date) }))}
                placeholderText="dd/mm/yyyy"
                className="h-[42px] w-full rounded-lg border border-gray-200 bg-white p-2.5 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                wrapperClassName="w-full min-w-0"
                maxDate={new Date()}
              />
            </FormField>
          </div>

          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Los pagos registrados con fecha anterior a esta, entraran en cuarentena como Ajustes Historicos.
          </p>

          <div className="mt-4 flex justify-end pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button
              type="submit"
              disabled={isCreatingFondo}
              className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreatingFondo ? 'Creando...' : 'Crear Fondo Virtual'}
            </button>
          </div>
        </form>
    </ModalBase>
  );
};

const toNumber = (value: string | number | undefined | null): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default ModalFondos;
