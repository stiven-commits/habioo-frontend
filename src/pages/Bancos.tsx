import React, { useEffect, useRef, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalBase from '../components/ui/ModalBase';
import ModalFondos from '../components/ModalFondos';
import { ModalEliminarFondo } from '../components/BancosModals';
import { API_BASE_URL } from '../config/api';
import { formatMoney } from '../utils/currency';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';
import { useDialog } from '../components/ui/DialogProvider';
import PageHeader from '../components/ui/PageHeader';
import FormField from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';

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
  acepta_transferencia?: boolean;
  acepta_pago_movil?: boolean;
  pago_movil_telefono?: string;
  pago_movil_cedula_rif?: string;
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
  acepta_transferencia: boolean;
  acepta_pago_movil: boolean;
  pago_movil_telefono: string;
  pago_movil_cedula_rif: string;
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
  acepta_transferencia: true,
  acepta_pago_movil: false,
  pago_movil_telefono: '',
  pago_movil_cedula_rif: '',
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

const preserveBancosOrder = (next: Banco[], prev: Banco[]): Banco[] => {
  if (prev.length === 0) return next;
  const prevIndexById = new Map<number, number>(prev.map((item, index) => [item.id, index]));
  return [...next].sort((a: Banco, b: Banco) => {
    const ai = prevIndexById.get(a.id);
    const bi = prevIndexById.get(b.id);
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
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
  const [fondosRefreshKey, setFondosRefreshKey] = useState<number>(0);
  const [showCuentaModal, setShowCuentaModal] = useState<boolean>(false);
  const [isSavingCuenta, setIsSavingCuenta] = useState<boolean>(false);
  const cuentaSubmitLockRef = useRef<boolean>(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const monedaRule = resolveTipoMoneda(form.tipo);

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

      if (dataBancos.status === 'success') {
        setBancos((prev: Banco[]) => preserveBancosOrder(dataBancos.bancos, prev));
      }
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

  const mapBancoToForm = (banco: Banco): FormState => {
    const tipo = String(banco.tipo || 'Transferencia');
    const monedaForced = resolveTipoMoneda(tipo).moneda;
    return {
      ...initialForm,
      tipo,
      moneda: monedaForced || 'BS',
      nombre_banco: String(banco.nombre_banco || ''),
      apodo: String(banco.apodo || ''),
      nombre_titular: String(banco.nombre_titular || ''),
      cedula_rif: String(banco.cedula_rif || ''),
      numero_cuenta: String(banco.numero_cuenta || ''),
      telefono: String(banco.telefono || ''),
      acepta_transferencia: Boolean(banco.acepta_transferencia ?? tipo === 'Transferencia'),
      acepta_pago_movil: Boolean(banco.acepta_pago_movil ?? tipo === 'Pago Movil'),
      pago_movil_telefono: String(banco.pago_movil_telefono || banco.telefono || ''),
      pago_movil_cedula_rif: String(banco.pago_movil_cedula_rif || banco.cedula_rif || ''),
    };
  };

  const openCreateModal = (): void => {
    setEditingBanco(null);
    setForm(initialForm);
    setShowCuentaModal(true);
  };

  const openEditModal = (banco: Banco): void => {
    setEditingBanco(banco);
    setForm(mapBancoToForm(banco));
    setShowCuentaModal(true);
  };

  const closeCuentaModal = (): void => {
    if (isSavingCuenta) return;
    setShowCuentaModal(false);
    setEditingBanco(null);
    setForm(initialForm);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const field = name as FormField;
    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
      const checked = e.target.checked;
      if (field === 'acepta_pago_movil') {
        setForm((prev: FormState) => ({
          ...prev,
          acepta_pago_movil: checked,
          pago_movil_telefono: checked ? prev.pago_movil_telefono : '',
          pago_movil_cedula_rif: checked ? prev.pago_movil_cedula_rif : '',
        }));
        return;
      }
      setForm((prev: FormState) => ({ ...prev, [field]: checked }));
      return;
    }
    if (field === 'tipo') {
      const isTransferencia = value === 'Transferencia';
      const isPagoMovil = value === 'Pago Movil';
      setForm((prev: FormState) => ({
        ...prev,
        tipo: value,
        nombre_banco: '',
        acepta_transferencia: isTransferencia,
        acepta_pago_movil: isPagoMovil ? true : (isTransferencia ? prev.acepta_pago_movil : false),
        pago_movil_telefono: isPagoMovil ? (prev.pago_movil_telefono || prev.telefono) : (isTransferencia ? prev.pago_movil_telefono : ''),
        pago_movil_cedula_rif: isPagoMovil ? (prev.pago_movil_cedula_rif || prev.cedula_rif) : (isTransferencia ? prev.pago_movil_cedula_rif : ''),
      }));
      return;
    }
    if (field === 'telefono') {
      setForm((prev: FormState) => ({ ...prev, telefono: sanitizePhone(value) }));
      return;
    }
    if (field === 'pago_movil_telefono') {
      setForm((prev: FormState) => ({ ...prev, pago_movil_telefono: sanitizePhone(value) }));
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

  const handlePagoMovilCedulaChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setForm((prev: FormState) => ({ ...prev, pago_movil_cedula_rif: sanitizeCedulaRif(e.target.value, { withDash: true }) }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isSavingCuenta || cuentaSubmitLockRef.current) return;
    const token = localStorage.getItem('habioo_token');
    if (['Transferencia', 'Pago Movil'].includes(form.tipo) && !isValidCedulaRif(form.cedula_rif)) {
      await showAlert({ title: 'Dato invalido', message: 'La cédula/RIF debe iniciar con V, E, J o G y contener solo números.', variant: 'warning' });
      return;
    }
    if (form.tipo === 'Pago Movil' && !isValidPhone(form.telefono)) {
      await showAlert({ title: 'Dato invalido', message: 'El teléfono debe contener solo números.', variant: 'warning' });
      return;
    }
    if (form.tipo === 'Transferencia' && form.acepta_pago_movil) {
      if (!isValidPhone(form.pago_movil_telefono || '')) {
        await showAlert({ title: 'Dato invalido', message: 'Debe indicar un teléfono válido para pago móvil.', variant: 'warning' });
        return;
      }
      if (!isValidCedulaRif(form.pago_movil_cedula_rif || '')) {
        await showAlert({ title: 'Dato invalido', message: 'La cédula/RIF para pago móvil no es válida.', variant: 'warning' });
        return;
      }
    }
    if (form.tipo === 'Zelle' && !isValidEmail(form.numero_cuenta)) {
      await showAlert({ title: 'Dato invalido', message: 'El correo de Zelle no tiene un formato válido.', variant: 'warning' });
      return;
    }

    try {
      cuentaSubmitLockRef.current = true;
      setIsSavingCuenta(true);
      const isEditing = Boolean(editingBanco?.id);
      const endpoint = isEditing ? `${API_BASE_URL}/bancos/${editingBanco?.id}` : `${API_BASE_URL}/bancos`;
      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          acepta_transferencia: form.tipo === 'Transferencia' ? true : form.tipo === 'Pago Movil' ? false : form.acepta_transferencia,
          acepta_pago_movil: form.tipo === 'Pago Movil' ? true : form.tipo === 'Transferencia' ? form.acepta_pago_movil : false,
          pago_movil_telefono: form.tipo === 'Pago Movil' ? form.telefono : (form.acepta_pago_movil ? form.pago_movil_telefono : ''),
          pago_movil_cedula_rif: form.tipo === 'Pago Movil' ? form.cedula_rif : (form.acepta_pago_movil ? form.pago_movil_cedula_rif : ''),
        }),
      });

      if (res.ok) {
        closeCuentaModal();
        fetchData();
      } else {
        const err: ApiActionResponse = await res.json();
        await showAlert({ title: 'Error', message: err.message || 'Error al guardar la cuenta bancaria', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de conexion', message: 'No se pudo guardar la cuenta.', variant: 'danger' });
    } finally {
      setIsSavingCuenta(false);
      cuentaSubmitLockRef.current = false;
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
      <PageHeader
        title="Cuentas Bancarias"
        actions={
          <button onClick={openCreateModal} className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 font-bold py-2 px-5 rounded-xl transition-all shadow-md text-sm flex items-center gap-2">
            + Agregar Cuenta
          </button>
        }
      />

      {bancos.length > 0 && !bancos.some(b => b.es_predeterminada) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-xl shadow-sm">
          <p className="text-yellow-800 dark:text-yellow-300 font-medium text-sm">
            <strong className="block mb-1 text-base">⚠️ Falta asignar una cuenta principal</strong>
            Es obligatorio asignar una cuenta bancaria principal (predeterminada) ya que esta información será compartida con los inmuebles para que notifiquen sus pagos. 
            Por favor, haz clic en el botón <span className="font-bold">Hacer Principal</span> en alguna de las cuentas abajo para continuar.
          </p>
        </div>
      )}

      {bancos.length > 0 && bancos.some(b => b.es_predeterminada) && bancos.some(b => !fondos.some(f => f.cuenta_bancaria_id === b.id)) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-xl shadow-sm">
          <p className="text-blue-800 dark:text-blue-300 font-medium text-sm">
            <strong className="block mb-1 text-base">ℹ️ Falta configurar fondos en sus cuentas</strong>
            Debe agregar mínimo un fondo (ej. Fondo Operativo) a sus cuentas bancarias para que los ingresos puedan ser distribuidos correctamente. Si agrega nuevas cuentas posteriormente, se le continuará recordando.
            Por favor, haga clic en el botón <span className="font-bold">Gestionar Fondos</span> en la cuenta correspondiente.
          </p>
        </div>
      )}

      {bancos.length === 0 ? <p className="text-gray-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">No hay cuentas registradas.</p> : (
        <div className="flex flex-col gap-5">
          {bancos.map((b: Banco) => (
            <div key={b.id} className={`bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-6 justify-between xl:items-center transition-all ${b.es_predeterminada ? 'border-green-400 dark:border-green-600 bg-green-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{b.nombre_banco || 'Efectivo'}</h3>
                  {(() => {
                    const canales = new Set<string>();
                    if (b.acepta_transferencia || b.tipo === 'Transferencia') canales.add('TRANSFERENCIA');
                    if (b.acepta_pago_movil || b.tipo === 'Pago Movil') canales.add('PAGO MOVIL');
                    if (b.tipo === 'Zelle') canales.add('ZELLE');
                    if (b.tipo === 'Efectivo BS' || b.tipo === 'Efectivo USD' || b.tipo === 'Efectivo') canales.add(String(b.tipo).toUpperCase());
                    return Array.from(canales);
                  })().includes('TRANSFERENCIA') && (
                    <StatusBadge color="indigo" shape="tag" size="md" border className="shadow-sm">Transferencia</StatusBadge>
                  )}
                  {(() => {
                    const canales = new Set<string>();
                    if (b.acepta_transferencia || b.tipo === 'Transferencia') canales.add('TRANSFERENCIA');
                    if (b.acepta_pago_movil || b.tipo === 'Pago Movil') canales.add('PAGO MOVIL');
                    if (b.tipo === 'Zelle') canales.add('ZELLE');
                    if (b.tipo === 'Efectivo BS' || b.tipo === 'Efectivo USD' || b.tipo === 'Efectivo') canales.add(String(b.tipo).toUpperCase());
                    return Array.from(canales);
                  })().includes('PAGO MOVIL') && (
                    <StatusBadge color="emerald" shape="tag" size="md" border className="shadow-sm">Pago Móvil</StatusBadge>
                  )}
                  {b.tipo === 'Zelle' && (
                    <StatusBadge color="blue" shape="tag" size="md" border className="shadow-sm">Zelle</StatusBadge>
                  )}
                  <StatusBadge color="gray" shape="tag" size="md">{b.apodo}</StatusBadge>
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
                  {(b.acepta_pago_movil || b.tipo === 'Pago Movil') && b.pago_movil_telefono && (
                    <p><strong className="text-gray-800 dark:text-gray-300 font-medium">Tel. Pago Móvil:</strong> {b.pago_movil_telefono}</p>
                  )}
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
                  <button
                    onClick={() => openEditModal(b)}
                    className="flex-1 text-[11px] text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 px-3 py-2.5 transition-colors border-r border-gray-200 dark:border-gray-700"
                  >
                    Editar
                  </button>
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

      {showCuentaModal && (
        <ModalBase onClose={closeCuentaModal} title={editingBanco ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'} maxWidth="max-w-6xl" disableClose={isSavingCuenta}>
          <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <FormField label="Tipo de Cuenta" required>
                  <select name="tipo" value={form.tipo} onChange={handleChange} required className="w-full p-3 bg-blue-50 dark:bg-gray-800 text-blue-800 dark:text-white border border-blue-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                    <option value="Transferencia" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Transferencia (Bs)</option>
                    <option value="Pago Movil" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Pago Movil (Bs)</option>
                    <option value="Zelle" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Zelle (USD)</option>
                    <option value="Efectivo BS" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Efectivo / Caja Chica (Bs)</option>
                    <option value="Efectivo USD" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Efectivo / Caja Chica (USD)</option>
                  </select>
                </FormField>

                {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
                  <FormField label="Institucion Bancaria" required>
                    <select name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
                      <option value="" disabled className="text-gray-400">Seleccione el banco...</option>
                      {bancosVenezuela.map((banco: string) => (
                        <option key={banco} value={banco} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{banco}</option>
                      ))}
                    </select>
                  </FormField>
                )}

                {form.tipo === 'Zelle' && (
                  <FormField label="Nombre del Banco (EEUU)" required>
                    <input type="text" name="nombre_banco" value={form.nombre_banco} onChange={handleChange} required placeholder="Ej: Wells Fargo, BofA..." className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                  </FormField>
                )}

                <FormField label="Apodo (Referencia)" required>
                  <input type="text" name="apodo" value={form.apodo} onChange={handleChange} required placeholder={form.tipo.startsWith('Efectivo') ? 'Ej: Caja Chica Conserjeria' : 'Ej: Principal / Pagos Bs'} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                </FormField>

                <FormField label={form.tipo.startsWith('Efectivo') ? 'Custodio / Responsable' : 'Nombre del Titular'} required>
                  <input type="text" name="nombre_titular" value={form.nombre_titular} onChange={handleChange} required placeholder="Ej: Junta de Condominio" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                </FormField>

                {['Transferencia', 'Pago Movil'].includes(form.tipo) && (
                  <FormField label="Cedula / RIF" required>
                    <input type="text" name="cedula_rif" value={form.cedula_rif} onChange={handleCedulaChange} pattern="^[VEJG]-?[0-9]{5,9}$" required placeholder="Ej: J-123456789" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" />
                  </FormField>
                )}

                {form.tipo === 'Transferencia' && (
                  <div className="space-y-3 md:col-span-3">
                    <FormField label="Numero de Cuenta" required>
                      <input type="text" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="20 digitos" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" />
                    </FormField>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        name="acepta_pago_movil"
                        checked={form.acepta_pago_movil}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-donezo-primary focus:ring-donezo-primary"
                      />
                      Esta cuenta tambien recibe Pago Movil
                    </label>
                    {form.acepta_pago_movil && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField label="Telefono Pago Movil" required>
                          <input
                            type="text"
                            name="pago_movil_telefono"
                            value={form.pago_movil_telefono}
                            onChange={handleChange}
                            inputMode="numeric"
                            pattern="^[0-9]{7,15}$"
                            required
                            placeholder="Ej: 04141234567"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                          />
                        </FormField>
                        <FormField label="Cedula/RIF Pago Movil" required>
                          <input
                            type="text"
                            name="pago_movil_cedula_rif"
                            value={form.pago_movil_cedula_rif}
                            onChange={handlePagoMovilCedulaChange}
                            pattern="^[VEJG]-?[0-9]{5,9}$"
                            required
                            placeholder="Ej: V-12345678"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                          />
                        </FormField>
                      </div>
                    )}
                  </div>
                )}

                {form.tipo === 'Pago Movil' && (
                  <FormField label="Telefono" required>
                    <input type="text" name="telefono" value={form.telefono} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" required placeholder="Ej: 04141234567" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" />
                  </FormField>
                )}

                {form.tipo === 'Zelle' && (
                  <FormField label="Correo Electronico" required>
                    <input type="email" name="numero_cuenta" value={form.numero_cuenta} onChange={handleChange} required placeholder="correo@zelle.com" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" />
                  </FormField>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={closeCuentaModal}
                  disabled={isSavingCuenta}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCuenta}
                  className="px-5 py-2.5 rounded-xl bg-donezo-primary hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingCuenta ? 'Guardando...' : editingBanco ? 'Guardar Cambios' : 'Guardar Configuracion'}
                </button>
              </div>
          </form>
        </ModalBase>
      )}

      {selectedBancoForFondos && (
        <ModalFondos
          cuenta={selectedBancoForFondos}
          refreshKey={fondosRefreshKey}
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
            const fondoEliminadoId = fondoAEliminar?.id;
            setFondoAEliminar(null);
            if (fondoEliminadoId !== undefined && fondoEliminadoId !== null) {
              setFondos((prev: Fondo[]) => prev.filter((f: Fondo) => String(f.id) !== String(fondoEliminadoId)));
            }
            setFondosRefreshKey((prev: number) => prev + 1);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Bancos;

