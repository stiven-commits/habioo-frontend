import React, { useEffect, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from './ui/DialogProvider';

interface ModalFondosProps {
  cuenta: CuentaBancaria;
  onClose: () => void;
  onDeleteFondo?: (fondo: Fondo) => void;
}

interface CuentaBancaria {
  id: number;
  nombre_banco: string;
  apodo: string;
}

interface Fondo {
  id: number;
  cuenta_bancaria_id: number;
  nombre: string;
  es_operativo: boolean;
  porcentaje_asignacion: string | number;
  saldo_actual: string | number;
  moneda: string;
}

interface FormState {
  nombre: string;
  moneda: string;
  porcentaje: string;
  saldo_inicial: string;
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
  es_operativo: false,
};

const ModalFondos: FC<ModalFondosProps> = ({ cuenta, onClose, onDeleteFondo }) => {
  const { showAlert, showConfirm } = useDialog() as DialogContextType;

  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [form, setForm] = useState<FormState>(initialForm);

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
  }, [cuenta.id]);

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

    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimalPart !== undefined) return `${integerPart},${decimalPart.slice(0, 2)}`;
    return integerPart;
  };

  const handleMonedaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const field = e.target.name as keyof FormState;
    setForm((prev: FormState) => ({ ...prev, [field]: formatCurrencyInput(e.target.value) }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');

    try {
      const res = await fetch(`${API_BASE_URL}/fondos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, cuenta_bancaria_id: cuenta.id }),
      });

      if (res.ok) {
        setForm(initialForm);
        fetchFondos();
      } else {
        const errorData: ApiActionResponse = await res.json();
        await showAlert({ title: 'Error', message: errorData.message || 'No se pudo crear el fondo', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo crear el fondo.', variant: 'danger' });
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

  const porcentajeUsado = fondos.reduce((acc: number, curr: Fondo) => acc + toNumber(curr.porcentaje_asignacion), 0);
  const porcentajeRestante = Math.max(0, 100 - porcentajeUsado).toFixed(2);
  const tieneOperativo = fondos.some((f: Fondo) => f.es_operativo);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 font-bold text-xl">X</button>

        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Configuracion de Fondos</h3>
        <p className="text-sm text-gray-500 mb-6">Cuenta bancaria: <strong className="text-donezo-primary">{cuenta.nombre_banco} ({cuenta.apodo})</strong></p>

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
                      <p className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                        {f.nombre}
                        {f.es_operativo && <span className="bg-donezo-primary text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black">Principal</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Entrada: <strong className="text-gray-700 dark:text-gray-300">{f.es_operativo ? 'Remanente Automatico' : `${f.porcentaje_asignacion}%`}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Saldo Actual</p>
                      <p className={`font-black text-lg ${f.moneda === 'USD' || f.moneda === 'EUR' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                        {formatMoney(f.saldo_actual)} <span className="text-xs font-normal">{f.moneda}</span>
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2 flex justify-end">
                    <button
                      onClick={() => (onDeleteFondo ? onDeleteFondo(f) : handleDeleteFondoLocal(f.id))}
                      className="text-[10px] uppercase font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Aperturar Nuevo Fondo</h4>

            <label className={`flex items-center gap-2 cursor-pointer text-xs font-bold ${tieneOperativo ? 'opacity-30 cursor-not-allowed' : 'text-donezo-primary'}`} title={tieneOperativo ? 'Ya existe un fondo principal' : 'Marque aqui si este fondo absorbera el dinero sobrante'}>
              <span className="uppercase tracking-wider">Es Fondo Principal</span>
              <div className="relative">
                <input type="checkbox" name="es_operativo" checked={form.es_operativo} onChange={handleChange} disabled={tieneOperativo} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-donezo-primary" />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${form.es_operativo ? 'md:col-span-3' : 'md:col-span-2'}`}>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Nombre del Fondo *</label>
              <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Fondo de Reserva" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
            </div>

            {!form.es_operativo && (
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">% de Ingresos *</label>
                <input type="number" step="0.01" min="0" max={porcentajeRestante} name="porcentaje" value={form.porcentaje} onChange={handleChange} required placeholder="Ej: 10" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Moneda Base</label>
              <select name="moneda" value={form.moneda} onChange={handleChange} className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold dark:text-white">
                <option value="BS" className="bg-white dark:bg-gray-800">Bolivares (BS)</option>
                <option value="USD" className="bg-white dark:bg-gray-800">Dolares (USD)</option>
                <option value="EUR" className="bg-white dark:bg-gray-800">Euros (EUR)</option>
              </select>
            </div>

            <div className={`${!form.es_operativo ? 'md:col-span-2' : ''}`}>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Saldo de Apertura</label>
              <input type="text" name="saldo_inicial" value={form.saldo_inicial} onChange={handleMonedaChange} required placeholder="0,00" className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white font-mono" />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 px-8 py-3 rounded-xl text-sm font-bold shadow-md transition-all">
              Crear Fondo Virtual
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

export default ModalFondos;
