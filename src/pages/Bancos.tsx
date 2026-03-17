import React, { useEffect, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalFondos from '../components/ModalFondos';
import { ModalEliminarFondo } from '../components/BancosModals';
import { API_BASE_URL } from '../config/api';
import { formatMoney } from '../utils/currency';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';
import { useDialog } from '../components/ui/DialogProvider';

interface BancosProps {}

interface OutletContextType {
  userRole?: string;
}

type TipoCuenta = 'Transferencia' | 'Pago Movil' | 'Zelle' | 'Efectivo BS' | 'Efectivo USD' | 'Efectivo';
type DialogVariant = 'warning' | 'danger' | 'success';

interface DialogAlertOptions {
  title: string;
  message: string;
  variant: DialogVariant;
}

interface DialogConfirmOptions extends DialogAlertOptions {
  confirmText: string;
  cancelText: string;
}

interface DialogContextType {
  showAlert: (options: DialogAlertOptions) => Promise<void>;
  showConfirm: (options: DialogConfirmOptions) => Promise<boolean>;
}

interface Banco {
  id: number;
  es_predeterminada?: boolean;
  nombre_banco: string;
  apodo: string;
  tipo: TipoCuenta | string;
  nombre_titular: string;
  cedula_rif?: string;
  numero_cuenta?: string;
  telefono?: string;
  saldo_actual?: string | number;
  saldo_total?: string | number;
  saldo?: string | number;
}

interface Fondo {
  id: number | string;
  cuenta_bancaria_id: number | string;
  nombre: string;
  moneda: string;
  saldo_actual: string | number;
  es_operativo?: boolean;
  porcentaje_asignacion?: string | number;
}

interface BancosResponse {
  status: string;
  bancos: Banco[];
  message?: string;
}

interface FondosResponse {
  status: string;
  fondos: Fondo[];
  message?: string;
}

interface ApiActionResponse {
  status: string;
  message?: string;
}

interface FormState {
  tipo: string;
  moneda: 'BS' | 'USD';
  nombre_banco: string;
  apodo: string;
  nombre_titular: string;
  cedula_rif: string;
  numero_cuenta: string;
  telefono: string;
}

type FormField = keyof FormState;

const initialForm: FormState = {
  tipo: 'Transferencia',
  moneda: 'BS',
  nombre_banco: '',
  apodo: '',
  nombre_titular: '',
  cedula_rif: '',
  numero_cuenta: '',
  telefono: '',
};

const normalizeTipo = (value: string): string => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const formatNumeroCuenta = (value: string): string => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return value;
  return digits.match(/.{1,4}/g)?.join('-') || digits;
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

const Bancos: FC<BancosProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const { showAlert, showConfirm } = useDialog() as DialogContextType;

  const [bancos, setBancos] = useState<Banco[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBancoForFondos, setSelectedBancoForFondos] = useState<Banco | null>(null);
  const [fondoAEliminar, setFondoAEliminar] = useState<Fondo | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);

  const [form, setForm] = useState<FormState>(initialForm);
  const monedaRule = resolveTipoMoneda(form.tipo);
  const monedaBloqueada = monedaRule.blocked;

  const bancosVenezuela: string[] = [
    '0102 - Banco de Venezuela',
    '0104 - Banco Venezolano de Credito',
    '0105 - Banco Mercantil',
    '0108 - Banco Provincial',
    '0114 - Banco del Caribe',
    '0115 - Banco Exterior',
    '0128 - Banco Caroni',
    '0134 - Banesco',
    '0137 - Banco Sofitasa',
    '0138 - Banco Plaza',
    '0146 - Banco de la Gente Emprendedora (Bangente)',
    '0151 - BFC Banco Fondo Comun',
    '0156 - 100% Banco',
    '0157 - DelSur Banco Universal',
    '0163 - Banco del Tesoro',
    '0166 - Banco Agricola de Venezuela',
    '0168 - Bancrecer',
    '0169 - Mi Banco',
    '0171 - Banco Activo',
    '0172 - Bancamiga',
    '0174 - Banplus',
    '0175 - Banco Bicentenario',
    '0177 - Banco de la Fuerza Armada Nacional Bolivariana',
    '0191 - Banco Nacional de Credito (BNC)',
  ];

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resBancos, resFondos] = await Promise.all([
        fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dataBancos: BancosResponse = await resBancos.json();
      const dataFondos: FondosResponse = await resFondos.json();

      if (dataBancos.status === 'success') setBancos(dataBancos.bancos);
      if (dataFondos.status === 'success') setFondos(dataFondos.fondos);
    } catch (error) {
      console.error(error);
      await showAlert({ title: 'Error de conexion', message: 'No se pudieron cargar bancos y fondos.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchData();
  }, [userRole]);

  useEffect(() => {
    if (!monedaRule.moneda) return;
    const forcedMoneda: 'BS' | 'USD' = monedaRule.moneda;
    setForm((prev: FormState) => (prev.moneda === forcedMoneda ? prev : { ...prev, moneda: forcedMoneda }));
  }, [form.tipo]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const field = name as FormField;
    if (field === 'tipo') {
      setForm((prev: FormState) => ({ ...prev, tipo: value, nombre_banco: '' }));
      return;
    }
    if (field === 'telefono') {
      setForm((prev: FormState) => ({ ...prev, telefono: sanitizePhone(value) }));
      return;
    }
    if (field === 'numero_cuenta' && form.tipo === 'Zelle') {
      setForm((prev: FormState) => ({ ...prev, numero_cuenta: sanitizeEmail(value) }));
      return;
    }
    setForm((prev: FormState) => ({ ...prev, [field]: value }));
  };

  const handleCedulaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setForm((prev: FormState) => ({ ...prev, cedula_rif: sanitizeCedulaRif(e.target.value, { withDash: true }) }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    if (['Transferencia', 'Pago Movil'].includes(form.tipo) && !isValidCedulaRif(form.cedula_rif)) {
      await showAlert({ title: 'Dato invalido', message: 'La cédula/RIF debe iniciar con V, E, J o G y contener solo números.', variant: 'warning' });
      return;
    }
    if (form.tipo === 'Pago Movil' && !isValidPhone(form.telefono)) {
      await showAlert({ title: 'Dato invalido', message: 'El teléfono debe contener solo números.', variant: 'warning' });
      return;
    }
    if (form.tipo === 'Zelle' && !isValidEmail(form.numero_cuenta)) {
      await showAlert({ title: 'Dato invalido', message: 'El correo de Zelle no tiene un formato válido.', variant: 'warning' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bancos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm(initialForm);
        setShowForm(false);
        fetchData();
      } else {
        const err: ApiActionResponse = await res.json();
        await showAlert({ title: 'Error', message: err.message || 'Error al guardar la cuenta', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo guardar la cuenta.', variant: 'danger' });
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await showConfirm({
      title: 'Eliminar cuenta bancaria',
      message: 'Solo se podra eliminar si sus fondos no tienen movimientos. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/bancos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiActionResponse = await res.json();

      if (res.ok && data.status === 'success') fetchData();
      else await showAlert({ title: 'Error', message: data.message || 'No se pudo eliminar la cuenta', variant: 'danger' });
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo eliminar la cuenta.', variant: 'danger' });
    }
  };

  const handleSetPredeterminada = async (id: number): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/bancos/${id}/predeterminada`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      const result: ApiActionResponse = await res.json();
      if (res.ok && result.status === 'success') {
        fetchData();
      } else {
        await showAlert({ title: 'Error', message: result.message || 'Error al actualizar la cuenta principal.', variant: 'danger' });
      }
    } catch (error) {
      console.error('Error al actualizar cuenta principal:', error);
      await showAlert({ title: 'Error de red', message: 'No se pudo actualizar la cuenta principal.', variant: 'danger' });
    }
  };

  const handleDeleteFondo = (fondo: Fondo): void => {
    setFondoAEliminar(fondo);
  };

  const toNum = (val: string | number | undefined): number => {
    const n = parseFloat(String(val ?? 0));
    return Number.isFinite(n) ? n : 0;
  };

  const renderSaldosCuenta = (cuenta: Banco): React.ReactNode => {
    const cuentaId = cuenta?.id;
    const fondosCuenta = fondos.filter((f: Fondo) => f?.cuenta_bancaria_id === cuentaId);

    const saldos = fondosCuenta.reduce<Record<string, number>>((acc: Record<string, number>, f: Fondo) => {
      const moneda = f?.moneda || 'N/A';
      acc[moneda] = (acc[moneda] || 0) + toNum(f?.saldo_actual);
      return acc;
    }, {});

    // Monto real de la cuenta bancaria menos suma de fondos virtuales.
    // Este diferencial representa entradas no distribuibles en fondos (ej. gastos tipo Extra).
    const saldoCuentaReal = toNum(cuenta?.saldo_actual ?? cuenta?.saldo_total ?? cuenta?.saldo);
    const totalFondosCuenta = fondosCuenta.reduce((acc: number, f: Fondo) => acc + toNum(f?.saldo_actual), 0);
    const fondosTransito = saldoCuentaReal - totalFondosCuenta;
    const showFondosTransito = fondosTransito > 0;

    return (
      <div className="space-y-1.5">
        {Object.entries(saldos).length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center">Sin fondos registrados</p>
        ) : (
          Object.entries(saldos).map(([moneda, monto]: [string, number]) => (
            <div key={moneda} className="flex justify-between items-center gap-6 border-b border-gray-200 dark:border-gray-700/50 pb-1 last:border-0 last:pb-0">
              <span className="text-xs font-bold text-gray-500">{moneda}</span>
              <span className={`font-black tracking-tight ${moneda === 'USD' || moneda === 'EUR' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                {formatMoney(monto)}
              </span>
            </div>
          ))
        )}
        {showFondosTransito && (
          <div className="flex justify-between items-center gap-6 mt-2 px-2 py-2 rounded-lg border border-dashed border-yellow-500/50 bg-yellow-50/60 dark:bg-yellow-900/10">
            <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">Fondos en Transito / Gastos Extra</span>
            <span className="font-black tracking-tight text-yellow-700 dark:text-yellow-300">
              {formatMoney(fondosTransito)}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (userRole !== 'Administrador') return <p className="p-6 text-gray-500">No tienes permisos para ver esta seccion.</p>;
  if (loading) return <p className="p-6 text-gray-500">Cargando cuentas...</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Cuentas Bancarias</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 font-bold py-2 px-5 rounded-xl transition-all shadow-md text-sm flex items-center gap-2">
          {showForm ? 'Cancelar' : '+ Agregar Cuenta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Nueva Cuenta Bancaria</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Cuenta *</label>
              <select name="tipo" value={form.tipo} onChange={handleChange} required className="w-full p-3 bg-blue-50 dark:bg-gray-800 text-blue-800 dark:text-white border border-blue-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                <option value="Transferencia" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Transferencia (Bs)</option>
                <option value="Pago Movil" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Pago Movil (Bs)</option>
                <option value="Zelle" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Zelle (USD)</option>
                <option value="Efectivo BS" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Efectivo / Caja Fuerte (Bs)</option>
                <option value="Efectivo USD" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Efectivo / Caja Fuerte (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Moneda Base *</label>
              <select
                name="moneda"
                value={form.moneda}
                onChange={handleChange}
                required
                disabled={monedaBloqueada}
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="BS" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Bolivares (BS)</option>
                <option value="USD" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Dolares (USD)</option>
              </select>
            </div>

            {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Institucion Bancaria *</label>
                <select name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
                  <option value="" disabled className="text-gray-400">Seleccione el banco...</option>
                  {bancosVenezuela.map((banco: string) => (
                    <option key={banco} value={banco} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{banco}</option>
                  ))}
                </select>
              </div>
            )}

            {form.tipo === 'Zelle' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Banco (EEUU) *</label>
                <input type="text" name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required placeholder="Ej: Wells Fargo, BofA..." className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apodo (Referencia) *</label><input type="text" name="apodo" value={form.apodo} onChange={handleChange} required placeholder={form.tipo.startsWith('Efectivo') ? 'Ej: Caja Chica Conserjeria' : 'Ej: Principal / Pagos Bs'} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{form.tipo.startsWith('Efectivo') ? 'Custodio / Responsable *' : 'Nombre del Titular *'}</label><input type="text" name="nombre_titular" value={form.nombre_titular} onChange={handleChange} required placeholder="Ej: Junta de Condominio" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>

            {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cedula / RIF *</label><input type="text" name="cedula_rif" value={form.cedula_rif} onChange={handleCedulaChange} pattern="^[VEJG]-?[0-9]{5,9}$" required placeholder="Ej: J-123456789" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {form.tipo === 'Transferencia' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Numero de Cuenta *</label><input type="text" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="20 digitos" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {form.tipo === 'Pago Movil' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono *</label><input type="text" name="telefono" value={form.telefono} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" required placeholder="Ej: 04141234567" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
            )}

            {form.tipo === 'Zelle' && (
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electronico *</label><input type="email" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="correo@zelle.com" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
            )}
          </div>
          <button type="submit" className="w-full md:w-auto bg-donezo-primary hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg">Guardar Configuracion</button>
        </form>
      )}

      {bancos.length === 0 ? <p className="text-gray-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">No hay cuentas registradas.</p> : (
        <div className="flex flex-col gap-5">
          {bancos.map((b: Banco) => (
            <div key={b.id} className={`bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-6 justify-between xl:items-center transition-all ${b.es_predeterminada ? 'border-green-400 dark:border-green-600 bg-green-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{b.nombre_banco || 'Efectivo'}</h3>
                  <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] uppercase font-bold px-2.5 py-1 rounded-md shadow-sm">{b.tipo || 'N/A'}</span>
                  <span className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-[11px] uppercase font-bold px-2.5 py-1 rounded-md">{b.apodo}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong className="text-gray-800 dark:text-gray-300 font-medium">Titular/Custodio:</strong> {b.nombre_titular}</p>
                  {b.cedula_rif && <p><strong className="text-gray-800 dark:text-gray-300 font-medium">CI/RIF:</strong> {b.cedula_rif}</p>}
                  {b.numero_cuenta && (
                    <p>
                      <strong className="text-gray-800 dark:text-gray-300 font-medium">{b.tipo === 'Zelle' ? 'Correo:' : 'N Cuenta:'}</strong>{' '}
                      {b.tipo === 'Zelle' ? b.numero_cuenta : formatNumeroCuenta(b.numero_cuenta)}
                    </p>
                  )}
                  {b.telefono && <p><strong className="text-gray-800 dark:text-gray-300 font-medium">Telefono:</strong> {b.telefono}</p>}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-w-[240px] border border-gray-100 dark:border-gray-700/50">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3 flex items-center justify-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  Saldos Virtuales
                </p>
                {renderSaldosCuenta(b)}
              </div>

              <div className="flex flex-col gap-2 min-w-[220px]">
                <button onClick={() => setSelectedBancoForFondos(b)} className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 text-[11px] uppercase tracking-wide font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  Gestionar Fondos
                </button>

                <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  {b.es_predeterminada ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[11px] font-bold px-3 py-2.5 cursor-default border-r border-gray-200 dark:border-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Principal
                    </div>
                  ) : (
                    <button onClick={() => handleSetPredeterminada(b.id)} className="flex-1 text-[11px] text-gray-600 hover:text-gray-800 font-bold bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-3 py-2.5 transition-colors border-r border-gray-200 dark:border-gray-700">Hacer Principal</button>
                  )}
                  <button onClick={() => handleDelete(b.id)} className="flex items-center justify-center px-4 py-2 bg-gray-50 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-sm transition-colors" title="Eliminar cuenta">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBancoForFondos && (
        <ModalFondos
          cuenta={selectedBancoForFondos}
          onDeleteFondo={handleDeleteFondo}
          onClose={() => {
            setSelectedBancoForFondos(null);
            fetchData();
          }}
        />
      )}

      {fondoAEliminar && (
        <ModalEliminarFondo
          fondo={fondoAEliminar}
          fondosDisponibles={fondos}
          onClose={() => setFondoAEliminar(null)}
          onSuccess={() => {
            setFondoAEliminar(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Bancos;
