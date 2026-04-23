import React, { useState, useEffect, useMemo } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from './ui/ModalBase';
import DatePicker from './ui/DatePicker';
import { es } from 'date-fns/locale/es';
import { formatMoney } from '../utils/currency';
import { getBcvRateForPaymentDate } from '../utils/bcv';
import { API_BASE_URL } from '../config/api';
import { sanitizeCedulaRif, isValidCedulaRif, sanitizePhone, isValidPhone } from '../utils/validators';
import { useDialog } from './ui/DialogProvider';
import FormField from './ui/FormField';
import SearchableCombobox from './ui/SearchableCombobox';
import type { SearchableComboboxOption } from './ui/SearchableCombobox';
import HabiooLoader from './ui/HabiooLoader';

interface ModalRegistrarPagoProps {
  propiedadPreseleccionada: PropiedadPreseleccionada | null;
  reciboId?: number | null;
  soloCuentaPrincipal?: boolean;
  condominioId?: number | null;
  montoBsBloqueado?: number | null;
  tasaBloqueada?: number | null;
  cuentaIdBloqueada?: string | null;
  referenciaPrefill?: string | null;
  movimientoFondoPendienteId?: number | null;
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
  nombre?: string;
  moneda?: string;
  nombre_banco?: string;
  apodo?: string;
  tipo?: string;
  es_predeterminada?: boolean;
  acepta_transferencia?: boolean;
  acepta_pago_movil?: boolean;
  pago_movil_telefono?: string;
  pago_movil_cedula_rif?: string;
}

interface Fondo {
  cuenta_bancaria_id: number;
}

interface CuentasResponse {
  status: string;
  bancos?: BancoCuenta[];
  data?: BancoCuenta | BancoCuenta[];
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

interface GastoListado {
  id: number | string;
  concepto?: string | null;
  tipo?: string | null;
  monto_usd?: number | string | null;
  monto_pagado_usd?: number | string | null;
  deuda_restante?: number | string | null;
  en_aviso_cobro?: boolean | string | number | null;
}

interface GastosResponse {
  status: string;
  gastos?: GastoListado[];
}

interface DesvioGastoDraftItem {
  id: string;
  gastoId: string;
  montoBs: string;
}

interface FormPagoState {
  cuenta_id: string;
  metodo_pago: 'Transferencia' | 'Pago Movil' | 'Zelle' | 'Efectivo';
  monto_origen: string;
  tasa_cambio: string;
  referencia: string;
  fecha_pago: string;
  nota: string;
  cedula_origen: string;
  banco_origen: string;
  telefono_origen: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'warning';
}

interface DialogContextType {
  showAlert: (options: { title: string; message: string; variant: 'warning' | 'danger' | 'success' }) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const BANCOS_VENEZUELA: string[] = [
  'Banco de Venezuela (BDV)', 'Banesco Banco Universal', 'Banco Mercantil', 'BBVA Provincial',
  'Banco Nacional de Crédito (BNC)', 'Bancamiga Banco Universal', 'Banplus Banco Universal',
  'Banco del Tesoro', 'Banco del Caribe (Bancaribe)', 'Banco Fondo Común (BFC)', 'Banco Caroní',
  'Banco Activo', 'Banco Venezolano de Crédito (BVC)', 'Banco Sofitasa', '100% Banco',
  'Delsur Banco Universal', 'Banco Agrícola de Venezuela', 'Banco Bicentenario', 'Banco Plaza',
  'Banco Exterior', 'Banco de la Fuerza Armada Nacional Bolivariana (Banfanb)',
  'Banco Digital de los Trabajadores (BDT)', 'N58 Banco Digital', 'Bancrecer', 'Bangente', 'R4 Banco Microfinanciero'
];

const getLocalYmd = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const toSingleDate = (value: Date | Date[] | null): Date | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

const initialFormPago = (): FormPagoState => ({
  cuenta_id: '',
  metodo_pago: 'Transferencia',
  monto_origen: '',
  tasa_cambio: '',
  referencia: '',
  fecha_pago: getLocalYmd(),
  nota: '',
  cedula_origen: '',
  banco_origen: '',
  telefono_origen: ''
});

const inferCuentaMoneda = (cuenta?: BancoCuenta): 'USD' | 'BS' => {
  if (!cuenta) return 'BS';
  const moneda = String(cuenta.moneda || '').trim().toUpperCase();
  if (moneda === 'USD') return 'USD';
  const tipo = String(cuenta.tipo || '').trim().toUpperCase();
  if (tipo.includes('USD') || tipo.includes('ZELLE')) return 'USD';
  const apodo = String(cuenta.apodo || '').trim().toUpperCase();
  if (apodo.includes('USD')) return 'USD';
  return 'BS';
};
const round2 = (value: number): number => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

const ModalRegistrarPago: FC<ModalRegistrarPagoProps> = ({
  propiedadPreseleccionada,
  reciboId = null,
  soloCuentaPrincipal = false,
  condominioId = null,
  montoBsBloqueado = null,
  tasaBloqueada = null,
  cuentaIdBloqueada = null,
  referenciaPrefill = null,
  movimientoFondoPendienteId = null,
  onClose,
  onSuccess,
}) => {
  const { showConfirm, showAlert } = useDialog() as DialogContextType;
  const [cuentasBancarias, setCuentasBancarias] = useState<BancoCuenta[]>([]);
  const [cuentasConFondos, setCuentasConFondos] = useState<BancoCuenta[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState<boolean>(true);
  const isLoading: boolean = loadingCuentas;

  const [formPago, setFormPago] = useState<FormPagoState>(initialFormPago());
  const [montoUsdDirecto, setMontoUsdDirecto] = useState<string>('');
  const isOpen = Boolean(propiedadPreseleccionada);
  const hasMontoBsBloqueado = Number.isFinite(Number(montoBsBloqueado)) && Number(montoBsBloqueado) > 0;
  const hasTasaBloqueada = Number.isFinite(Number(tasaBloqueada)) && Number(tasaBloqueada) > 0;

  useEffect(() => {
    // Solo auto-completamos si la modal está abierta, hay cuentas y el usuario NO ha seleccionado una manualmente
    if (isOpen && cuentasConFondos && cuentasConFondos.length > 0 && !formPago.cuenta_id) {
      const cuentaPorDefecto =
        cuentasConFondos.find((c: BancoCuenta) => c.es_predeterminada && inferCuentaMoneda(c) === 'BS') ??
        cuentasConFondos.find((c: BancoCuenta) => c.es_predeterminada) ??
        cuentasConFondos.find((c: BancoCuenta) => inferCuentaMoneda(c) === 'BS') ??
        cuentasConFondos[0];
      
      if (cuentaPorDefecto) {
        const metodos = getMetodosCuenta(cuentaPorDefecto);
        setFormPago((prev: FormPagoState) => ({
          ...prev,
          cuenta_id: String(cuentaPorDefecto.id),
          metodo_pago: metodos[0] || 'Transferencia',
        }));
      }
    }
  }, [isOpen, cuentasConFondos]); // Importante: No poner formPago en las dependencias para evitar ciclos infinitos

  useEffect(() => {
    if (!isOpen || !cuentaIdBloqueada || !cuentasConFondos.length) return;
    const cuenta = cuentasConFondos.find((c: BancoCuenta) => String(c.id) === String(cuentaIdBloqueada));
    if (!cuenta) return;
    const metodos = getMetodosCuenta(cuenta);
    setFormPago((prev: FormPagoState) => {
      if (prev.cuenta_id === String(cuenta.id)) return prev;
      const nextMetodo = metodos.includes(prev.metodo_pago) ? prev.metodo_pago : (metodos[0] || 'Transferencia');
      return { ...prev, cuenta_id: String(cuenta.id), metodo_pago: nextMetodo };
    });
  }, [isOpen, cuentaIdBloqueada, cuentasConFondos]);

  const getMetodosCuenta = (cuenta?: BancoCuenta): Array<FormPagoState['metodo_pago']> => {
    if (!cuenta) return [];
    const tipo = String(cuenta.tipo || '');
    const legacyTransfer = tipo === 'Transferencia';
    const legacyPagoMovil = tipo === 'Pago Movil';
    const legacyZelle = tipo === 'Zelle';
    const legacyEfectivo = tipo.startsWith('Efectivo');

    const canTransfer = cuenta.acepta_transferencia ?? legacyTransfer;
    const canPagoMovil = cuenta.acepta_pago_movil ?? legacyPagoMovil;

    if (legacyZelle) return ['Zelle'];
    if (legacyEfectivo) return ['Efectivo'];

    const methods: Array<FormPagoState['metodo_pago']> = [];
    if (canTransfer) methods.push('Transferencia');
    if (canPagoMovil) methods.push('Pago Movil');
    if (methods.length === 0 && legacyTransfer) methods.push('Transferencia');
    if (methods.length === 0 && legacyPagoMovil) methods.push('Pago Movil');
    return methods;
  };

  const [conversionUSD, setConversionUSD] = useState<string>('0.00');
  const [mostrarDesvioExtra, setMostrarDesvioExtra] = useState<boolean>(false);
  const [gastosExtraDisponibles, setGastosExtraDisponibles] = useState<GastoListado[]>([]);
  const [loadingGastosExtra, setLoadingGastosExtra] = useState<boolean>(false);
  const [desviosGastos, setDesviosGastos] = useState<DesvioGastoDraftItem[]>([]);

  useEffect(() => {
    const fetchCuentasBancarias = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('habioo_token');

        if (soloCuentaPrincipal && condominioId) {
          const resPrincipal = await fetch(`${API_BASE_URL}/api/propietario/cuentas/${condominioId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const dataPrincipal: CuentasResponse = await resPrincipal.json();
          const cuentasRaw =
            resPrincipal.ok && dataPrincipal.status === 'success'
              ? (Array.isArray(dataPrincipal.data) ? dataPrincipal.data : [])
              : [];
          const cuentas = Array.isArray(cuentasRaw) ? cuentasRaw : [];

          const principalBs = cuentas.find((c: BancoCuenta) => c.es_predeterminada && inferCuentaMoneda(c) === 'BS');
          const principalUsd = cuentas.find((c: BancoCuenta) => c.es_predeterminada && inferCuentaMoneda(c) === 'USD');
          const fallbackBs = cuentas.find((c: BancoCuenta) => inferCuentaMoneda(c) === 'BS');
          const fallbackUsd = cuentas.find((c: BancoCuenta) => inferCuentaMoneda(c) === 'USD');

          const selected = [
            principalBs || fallbackBs || null,
            principalUsd || fallbackUsd || null,
          ].filter((c): c is BancoCuenta => Boolean(c));
          const principal = selected.filter(
            (c: BancoCuenta, idx: number, arr: BancoCuenta[]) => arr.findIndex((x) => String(x.id) === String(c.id)) === idx
          );
          setCuentasBancarias(principal);
          setCuentasConFondos(principal);
          return;
        }

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

  const formatCurrencyInput = (value: string, maxDecimals = 2): string => {
    let rawValue = value.replace(/[^0-9,]/g, '');
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;
    let [integerPart = '', decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimalPart !== undefined) {
      decimalPart = decimalPart.slice(0, maxDecimals);
      return `${integerPart},${decimalPart}`;
    }
    return integerPart ?? '';
  };

  const getConversionUSD = (updatedForm: FormPagoState): string => {
    if (!updatedForm.monto_origen || !updatedForm.cuenta_id) return '0.00';

    const monto = parseInputNumber(updatedForm.monto_origen);
    const tasaRaw = parseInputNumber(updatedForm.tasa_cambio);

    if (tasaRaw > 0) return round2(monto / tasaRaw).toFixed(2);
    return '0.00';
  };

  const applyFormChange = (name: keyof FormPagoState, value: string): void => {
    const updatedForm: FormPagoState = { ...formPago, [name]: value } as FormPagoState;
    setFormPago(updatedForm);
    setConversionUSD(getConversionUSD(updatedForm));
  };

  const handlePagoChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    const field = name as keyof FormPagoState;
    if (field === 'cuenta_id') {
      const cuenta = cuentasConFondos.find((b: BancoCuenta) => String(b.id) === value);
      const metodos = getMetodosCuenta(cuenta);
      const nextMetodo = metodos.includes(formPago.metodo_pago) ? formPago.metodo_pago : (metodos[0] || 'Transferencia');
      const updatedForm: FormPagoState = {
        ...formPago,
        cuenta_id: value,
        metodo_pago: nextMetodo,
      };
      if (nextMetodo === 'Pago Movil' && cuenta?.pago_movil_cedula_rif && !updatedForm.cedula_origen) {
        updatedForm.cedula_origen = cuenta.pago_movil_cedula_rif;
      }
      setFormPago(updatedForm);
      setConversionUSD(getConversionUSD(updatedForm));
      return;
    }
    let newVal = value;

    if (field === 'monto_origen') newVal = formatCurrencyInput(value, 2);
    if (field === 'tasa_cambio') newVal = formatCurrencyInput(value, 4);
    if (field === 'cedula_origen') newVal = sanitizeCedulaRif(value);
    if (field === 'telefono_origen') newVal = sanitizePhone(value);

    applyFormChange(field, newVal);
  };

  const [isLoadingAutoRate, setIsLoadingAutoRate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedBank = cuentasConFondos.find((b: BancoCuenta) => b.id.toString() === formPago.cuenta_id);
  const metodosCuentaSeleccionada = getMetodosCuenta(selectedBank);
  const cuentaBancariaId = formPago.cuenta_id;
  const cuentaSeleccionada =
    cuentasConFondos.find((c: BancoCuenta) => c.id.toString() === cuentaBancariaId) ??
    cuentasBancarias.find((c: BancoCuenta) => c.id.toString() === cuentaBancariaId);
  const nombreCuentaSeleccionada = String(
    cuentaSeleccionada?.nombre ||
    cuentaSeleccionada?.apodo ||
    cuentaSeleccionada?.nombre_banco ||
    ''
  ).toUpperCase();
  const tipoCuentaSeleccionada = String(cuentaSeleccionada?.tipo || '').toUpperCase();
  const esMetodoUsd = formPago.metodo_pago === 'Zelle' || (formPago.metodo_pago === 'Efectivo' && !tipoCuentaSeleccionada.includes('BS'));
  const esCuentaUsd =
    inferCuentaMoneda(cuentaSeleccionada) === 'USD' ||
    esMetodoUsd;
  const requiresTasa = formPago.metodo_pago === 'Transferencia' || formPago.metodo_pago === 'Pago Movil';
  const useAutoBcvMode = soloCuentaPrincipal;

  useEffect(() => {
    if (!selectedBank) return;
    if (!metodosCuentaSeleccionada.length) return;
    if (metodosCuentaSeleccionada.includes(formPago.metodo_pago)) return;
    setFormPago((prev: FormPagoState) => ({ ...prev, metodo_pago: metodosCuentaSeleccionada[0] || 'Transferencia' }));
  }, [selectedBank, metodosCuentaSeleccionada, formPago.metodo_pago]);

  useEffect(() => {
    if (!isOpen || !hasMontoBsBloqueado || esCuentaUsd) return;
    const nextMonto = formatCurrencyInput(String(montoBsBloqueado).replace('.', ','), 2);
    setFormPago((prev: FormPagoState) => {
      if (prev.monto_origen === nextMonto) return prev;
      return { ...prev, monto_origen: nextMonto };
    });
  }, [isOpen, hasMontoBsBloqueado, esCuentaUsd, montoBsBloqueado]);

  useEffect(() => {
    if (!isOpen || !hasMontoBsBloqueado || !esCuentaUsd) return;
    const nextMonto = formatCurrencyInput(String(montoBsBloqueado).replace('.', ','), 2);
    setMontoUsdDirecto((prev) => (prev === nextMonto ? prev : nextMonto));
  }, [isOpen, hasMontoBsBloqueado, esCuentaUsd, montoBsBloqueado]);

  useEffect(() => {
    if (!isOpen || !referenciaPrefill?.trim()) return;
    setFormPago((prev: FormPagoState) => (prev.referencia.trim() ? prev : { ...prev, referencia: referenciaPrefill.trim() }));
  }, [isOpen, referenciaPrefill]);

  useEffect(() => {
    if (!isOpen || !hasTasaBloqueada || esCuentaUsd) return;
    const nextTasa = formatCurrencyInput(String(tasaBloqueada).replace('.', ','), 4);
    setFormPago((prev: FormPagoState) => (prev.tasa_cambio === nextTasa ? prev : { ...prev, tasa_cambio: nextTasa }));
  }, [isOpen, hasTasaBloqueada, esCuentaUsd, tasaBloqueada]);

  useEffect(() => {
    if (esCuentaUsd) {
      setConversionUSD(round2(parseInputNumber(montoUsdDirecto)).toFixed(2));
      return;
    }
    if (!requiresTasa) {
      setConversionUSD(round2(parseInputNumber(formPago.monto_origen)).toFixed(2));
      return;
    }
    setConversionUSD(getConversionUSD(formPago));
  }, [esCuentaUsd, montoUsdDirecto, formPago, requiresTasa, cuentasConFondos]);

  useEffect(() => {
    if (formPago.metodo_pago !== 'Efectivo' && !esCuentaUsd) return;
    if (formPago.referencia.trim()) return;
    const referenciaSugerida = nombreCuentaSeleccionada.includes('ZELLE') ? 'ZELLE' : 'EFECTIVO';
    setFormPago((prev: FormPagoState) => ({ ...prev, referencia: referenciaSugerida }));
  }, [esCuentaUsd, formPago.metodo_pago, formPago.referencia, nombreCuentaSeleccionada]);

  const fetchBcvRate = async (fechaPagoYmd: string, silent = false): Promise<void> => {
    const fechaObjetivo = String(fechaPagoYmd || '').trim();
    const ymdValido = /^\d{4}-\d{2}-\d{2}$/.test(fechaObjetivo) ? fechaObjetivo : getLocalYmd();

    setIsLoadingAutoRate(true);
    try {
      const rateNumber = await getBcvRateForPaymentDate(ymdValido);

      if (!rateNumber || rateNumber <= 0) throw new Error('BCV invalid');
      const formattedRate = formatCurrencyInput(rateNumber.toFixed(4).replace('.', ','), 4);

      setFormPago((prev: FormPagoState) => {
        if (prev.tasa_cambio === formattedRate) return prev;
        const updated: FormPagoState = { ...prev, tasa_cambio: formattedRate };
        setConversionUSD(getConversionUSD(updated));
        return updated;
      });
    } catch {
      if (!silent) {
        await showAlert({
          title: 'BCV no disponible',
          message: `No se pudo cargar la tasa BCV para la fecha ${ymdValido}. Intente nuevamente o ingrese la tasa manual.`,
          variant: 'warning',
        });
      }
    } finally {
      setIsLoadingAutoRate(false);
    }
  };

  const handleFechaPagoChange = (date: Date | null): void => {
    const nextYmd = dateToYmd(date);
    const shouldAutoFetchRate = Boolean(nextYmd) && !esCuentaUsd && requiresTasa && !hasTasaBloqueada;

    setFormPago((prev: FormPagoState) => ({
      ...prev,
      fecha_pago: nextYmd,
      ...(shouldAutoFetchRate ? { tasa_cambio: '' } : {}),
    }));

    if (shouldAutoFetchRate) {
      void fetchBcvRate(nextYmd, false);
    }
  };

  useEffect(() => {
    if (!isOpen || !formPago.cuenta_id || esCuentaUsd || !requiresTasa || hasTasaBloqueada) return;
    void fetchBcvRate(formPago.fecha_pago, true);
  }, [isOpen, formPago.cuenta_id, esCuentaUsd, requiresTasa, hasTasaBloqueada]);

  useEffect(() => {
    const fetchGastosExtras = async (): Promise<void> => {
      if (!isOpen || soloCuentaPrincipal) return;
      const token = localStorage.getItem('habioo_token');
      if (!token) return;

      setLoadingGastosExtra(true);
      try {
        const res = await fetch(`${API_BASE_URL}/gastos-extras-procesados`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: GastosResponse = await res.json();
        if (!res.ok || data.status !== 'success') {
          setGastosExtraDisponibles([]);
          return;
        }
        const gastos = Array.isArray(data.gastos) ? data.gastos : [];
        const uniqueById = new Map<string, GastoListado>();
        gastos.forEach((g: GastoListado) => {
          const id = String(g.id ?? '').trim();
          if (!id || uniqueById.has(id)) return;
          uniqueById.set(id, g);
        });
        const filtradosConDeuda = Array.from(uniqueById.values()).filter((g: GastoListado) => {
          const deudaRestanteRaw = g.deuda_restante;
          const deudaRestante = deudaRestanteRaw !== undefined && deudaRestanteRaw !== null
            ? toNumber(deudaRestanteRaw)
            : Math.max(0, toNumber(g.monto_usd) - toNumber(g.monto_pagado_usd));
          return deudaRestante > 0;
        });
        setGastosExtraDisponibles(filtradosConDeuda);
      } catch {
        setGastosExtraDisponibles([]);
      } finally {
        setLoadingGastosExtra(false);
      }
    };
    void fetchGastosExtras();
  }, [isOpen, soloCuentaPrincipal]);

  const getEffectiveRateForDesvio = (): number => {
    if (esCuentaUsd) {
      const tasaManual = parseInputNumber(formPago.tasa_cambio);
      return tasaManual > 0 ? tasaManual : 1;
    }
    if (requiresTasa) {
      const tasa = parseInputNumber(formPago.tasa_cambio);
      return tasa > 0 ? tasa : 0;
    }
    return 1;
  };

  const addDesvioRow = (): void => {
    const selectedIds = new Set(
      desviosGastos
        .map((row) => row.gastoId)
        .filter((id) => id.trim().length > 0),
    );
    const firstAvailable = gastosExtraDisponibles.find((g) => !selectedIds.has(String(g.id)));
    const defaultGastoId = firstAvailable ? String(firstAvailable.id) : '';
    setDesviosGastos((prev: DesvioGastoDraftItem[]) => ([
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        gastoId: defaultGastoId,
        montoBs: '',
      },
    ]));
  };

  const updateDesvioRow = (rowId: string, patch: Partial<DesvioGastoDraftItem>): void => {
    setDesviosGastos((prev: DesvioGastoDraftItem[]) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const removeDesvioRow = (rowId: string): void => {
    setDesviosGastos((prev: DesvioGastoDraftItem[]) => prev.filter((row) => row.id !== rowId));
  };

  const handleCuentaComboboxChange = (value: string): void => {
    const cuenta = cuentasConFondos.find((b: BancoCuenta) => String(b.id) === value);
    const metodos = getMetodosCuenta(cuenta);
    const nextMetodo = metodos.includes(formPago.metodo_pago) ? formPago.metodo_pago : (metodos[0] || 'Transferencia');
    const updatedForm: FormPagoState = {
      ...formPago,
      cuenta_id: value,
      metodo_pago: nextMetodo,
    };
    if (nextMetodo === 'Pago Movil' && cuenta?.pago_movil_cedula_rif && !updatedForm.cedula_origen) {
      updatedForm.cedula_origen = cuenta.pago_movil_cedula_rif;
    }
    setFormPago(updatedForm);
    setConversionUSD(getConversionUSD(updatedForm));
  };

  const cuentaOptions = useMemo<SearchableComboboxOption[]>(
    () => cuentasConFondos.map((b: BancoCuenta) => ({
      value: String(b.id),
      label: `${b.nombre_banco || 'Cuenta'} (${b.apodo || b.tipo || 'Sin alias'})`,
      searchText: `${b.nombre_banco || ''} ${b.apodo || ''} ${b.tipo || ''}`,
    })),
    [cuentasConFondos],
  );

  const bancoOrigenOptions = useMemo<SearchableComboboxOption[]>(
    () => BANCOS_VENEZUELA.map((banco: string) => ({ value: banco, label: banco })),
    [],
  );

  const gastoExtraOptions = useMemo<SearchableComboboxOption[]>(
    () => gastosExtraDisponibles.map((g: GastoListado) => {
      const pendienteUsd = g.deuda_restante !== undefined && g.deuda_restante !== null
        ? Math.max(0, toNumber(g.deuda_restante))
        : Math.max(0, toNumber(g.monto_usd) - toNumber(g.monto_pagado_usd));
      const concepto = String(g.concepto || `Gasto #${g.id}`);
      const enAvisoCobroRaw = String(g.en_aviso_cobro ?? '').trim().toLowerCase();
      const enAvisoCobro = g.en_aviso_cobro === true || enAvisoCobroRaw === 'true' || enAvisoCobroRaw === 't' || enAvisoCobroRaw === '1';
      const badgeSinAviso = enAvisoCobro ? '' : ' [sin aviso de cobro]';
      return {
        value: String(g.id),
        label: `${concepto} - Pendiente: $${formatMoney(pendienteUsd)}${badgeSinAviso}`,
        searchText: `${concepto} ${g.id} ${enAvisoCobro ? '' : 'sin aviso de cobro'}`,
      };
    }),
    [gastosExtraDisponibles],
  );

  const getGastoOptionsForRow = (rowId: string): SearchableComboboxOption[] => {
    const currentRow = desviosGastos.find((row) => row.id === rowId);
    const selectedByOthers = new Set(
      desviosGastos
        .filter((row) => row.id !== rowId)
        .map((row) => row.gastoId)
        .filter((id) => id.trim().length > 0),
    );
    const visible = gastoExtraOptions.filter((option) => !selectedByOthers.has(option.value));
    if (currentRow?.gastoId && !visible.some((option) => option.value === currentRow.gastoId)) {
      const selected = gastoExtraOptions.find((option) => option.value === currentRow.gastoId);
      if (selected) visible.unshift(selected);
    }
    return visible;
  };

  const handleSubmitPago = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!cuentasConFondos.some((c: BancoCuenta) => c.id.toString() === formPago.cuenta_id)) {
      alert('Error: seleccione una cuenta bancaria que tenga al menos un fondo activo.');
      return;
    }
    if (requiresTasa && !formPago.banco_origen.trim()) {
      alert('Error: seleccione el banco de origen.');
      return;
    }
    if (requiresTasa && !isValidCedulaRif(formPago.cedula_origen)) {
      alert('Error: la cédula de origen debe iniciar con V, E, J o G y contener solo números.');
      return;
    }
    if (formPago.metodo_pago === 'Pago Movil' && !isValidPhone(formPago.telefono_origen)) {
      alert('Error: para Pago Movil debe indicar un telefono de origen valido.');
      return;
    }
    if (esCuentaUsd && parseInputNumber(montoUsdDirecto) <= 0) {
      alert('Error: ingrese un monto pagado (USD) válido.');
      return;
    }
    if (requiresTasa && !esCuentaUsd && parseInputNumber(formPago.tasa_cambio) <= 0) {
      alert('Error: no hay una tasa BCV válida disponible para calcular el equivalente en USD.');
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
      const monedaReal = esCuentaUsd ? 'USD' : (requiresTasa ? 'BS' : 'USD');
      const token = localStorage.getItem('habioo_token');
      const montoUsdDirectoNum = parseInputNumber(montoUsdDirecto);
      const montoOrigenNum = esCuentaUsd ? montoUsdDirectoNum : parseInputNumber(formPago.monto_origen);
      const tasaCambioNum = parseInputNumber(formPago.tasa_cambio);
      const montoUsdNum = esCuentaUsd ? montoUsdDirectoNum : parseInputNumber(conversionUSD);
      const tasaDesvio = getEffectiveRateForDesvio();
      const desviosPayload = mostrarDesvioExtra
        ? desviosGastos
            .map((row: DesvioGastoDraftItem) => {
              const montoBs = parseInputNumber(row.montoBs);
              const montoUsd = tasaDesvio > 0 ? (montoBs / tasaDesvio) : 0;
              return {
                gasto_extra_id: row.gastoId ? Number(row.gastoId) : null,
                monto_desvio_bs: montoBs > 0 ? Number(montoBs.toFixed(2)) : null,
                monto_desvio_usd: montoUsd > 0 ? Number(montoUsd.toFixed(2)) : null,
              };
            })
            .filter((row) => Number.isFinite(Number(row.gasto_extra_id)) && Number(row.gasto_extra_id) > 0 && Number(row.monto_desvio_usd) > 0)
        : [];
      const totalDesvioUsd = desviosPayload.reduce((acc, row) => acc + Number(row.monto_desvio_usd || 0), 0);

      if (mostrarDesvioExtra) {
        if (!desviosPayload.length) {
          alert('Error: agregue al menos un desvío válido a Gasto Extra.');
          return;
        }
        if (requiresTasa && !esCuentaUsd && tasaDesvio <= 0) {
          alert('Error: requiere una tasa válida para convertir los desvíos en Bs a USD.');
          return;
        }
        if (totalDesvioUsd > montoUsdNum) {
          alert('Error: la suma de desvíos no puede superar el monto total del pago.');
          return;
        }
      }

      const payload = {
        ...formPago,
        recibo_id: reciboId,
        propiedad_id: propiedadPreseleccionada.id,
        moneda: monedaReal,
        monto_origen: montoOrigenNum,
        tasa_cambio: esCuentaUsd ? 1 : (requiresTasa ? tasaCambioNum : null),
        monto_bs_pagado: esCuentaUsd ? montoUsdDirectoNum : undefined,
        monto_usd: montoUsdNum,
        metodo: formPago.metodo_pago,
        gasto_extra_id: mostrarDesvioExtra && desviosPayload[0] ? Number(desviosPayload[0].gasto_extra_id) : null,
        monto_desvio_usd: mostrarDesvioExtra && desviosPayload[0] ? Number(desviosPayload[0].monto_desvio_usd) : null,
        desvios_gastos: mostrarDesvioExtra ? desviosPayload : null,
        movimiento_fondo_pendiente_id:
          Number.isFinite(Number(movimientoFondoPendienteId)) && Number(movimientoFondoPendienteId) > 0
            ? Number(movimientoFondoPendienteId)
            : null,
      };

      const endpoint = soloCuentaPrincipal ? `${API_BASE_URL}/pagos-propietario` : `${API_BASE_URL}/pagos-admin`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const result: PagoResponse = await res.json();
      if (result.status === 'success') {
        alert(result.message || (soloCuentaPrincipal ? 'Pago enviado para aprobación.' : 'Pago registrado.'));
        onSuccess();
      } else alert(result.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!propiedadPreseleccionada) return null;

  return (
    <ModalBase
      onClose={onClose}
      title="Registrar Pago"
      helpTooltip="Esta ventana permite registrar pagos manuales, distribuirlos en conceptos y confirmar el asiento. Revisa montos, fecha y soportes antes de guardar."
      maxWidth="max-w-6xl"
      disableClose={isSubmitting}
      closeOnOverlayClick={false}
    >
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

        {isLoading ? (
          <HabiooLoader size="sm" message="Cargando información del pago..." className="py-8" />
        ) : (
          <>
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

            <form onSubmit={handleSubmitPago} className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
              <FormField label="Cuenta Bancaria Destino" required>
                <SearchableCombobox
                  options={cuentaOptions}
                  value={formPago.cuenta_id}
                  onChange={handleCuentaComboboxChange}
                  placeholder={cuentasConFondos.length ? 'Seleccione cuenta bancaria...' : 'No hay cuentas con fondos activos'}
                  emptyMessage="Sin cuentas disponibles"
                  disabled={Boolean(cuentaIdBloqueada)}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                />
                {cuentasBancarias.length > 0 && cuentasConFondos.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                    Debe crear al menos un fondo en una cuenta bancaria para registrar pagos.
                  </p>
                )}
              </FormField>

              {formPago.cuenta_id && metodosCuentaSeleccionada.length > 0 && (
                <FormField label="Método de Pago" required>
                  <div className="grid grid-cols-2 gap-2">
                    {metodosCuentaSeleccionada.map((metodo) => (
                      <button
                        key={metodo}
                        type="button"
                        onClick={() => {
                          const updated: FormPagoState = { ...formPago, metodo_pago: metodo };
                          if (metodo === 'Pago Movil' && selectedBank?.pago_movil_cedula_rif && !updated.cedula_origen) {
                            updated.cedula_origen = selectedBank.pago_movil_cedula_rif;
                          }
                          setFormPago(updated);
                          setConversionUSD(getConversionUSD(updated));
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          formPago.metodo_pago === metodo
                            ? 'border-donezo-primary bg-blue-50 text-donezo-primary dark:bg-blue-900/30 dark:text-blue-300'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {metodo}
                      </button>
                    ))}
                  </div>
                </FormField>
              )}

              <div className="lg:col-span-2">
                {esCuentaUsd ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                    <FormField label="Monto Pagado (USD)" required>
                      <input
                        type="text"
                        value={montoUsdDirecto}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (hasMontoBsBloqueado) return;
                          setMontoUsdDirecto(formatCurrencyInput(e.target.value, 2));
                        }}
                        placeholder="0,00"
                        readOnly={hasMontoBsBloqueado}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                        required
                      />
                    </FormField>
                    <FormField label="Fecha Pago" required>
                      <DatePicker
                        selected={ymdToDate(formPago.fecha_pago)}
                        onChange={(date: Date | Date[] | null) => {
                          const nextDate = toSingleDate(date);
                          handleFechaPagoChange(nextDate);
                        }}
                        {...(ymdToDate(getLocalYmd()) ? { maxDate: ymdToDate(getLocalYmd()) as Date } : {})}
                        dateFormat="dd/MM/yyyy"
                        locale={es}
                        placeholderText="Fecha (dd/mm/yyyy)"
                        showIcon
                        toggleCalendarOnIconClick
                        wrapperClassName="w-full min-w-0"
                        popperClassName="habioo-datepicker-popper"
                        calendarClassName="habioo-datepicker-calendar"
                        className="h-[50px] w-full rounded-xl border border-gray-200 bg-white p-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        required
                      />
                    </FormField>
                  </div>
                ) : requiresTasa ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                    <div className="md:col-span-2">
                      <FormField label="Monto Pagado" required>
                        <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary read-only:bg-gray-50 read-only:dark:bg-gray-800/70" required readOnly={hasMontoBsBloqueado} />
                      </FormField>
                    </div>
                    <div className="md:col-span-2">
                      <FormField label="Fecha Pago" required>
                        <DatePicker
                          selected={ymdToDate(formPago.fecha_pago)}
                          onChange={(date: Date | Date[] | null) => {
                            const nextDate = toSingleDate(date);
                            handleFechaPagoChange(nextDate);
                          }}
                          {...(ymdToDate(getLocalYmd()) ? { maxDate: ymdToDate(getLocalYmd()) as Date } : {})}
                          dateFormat="dd/MM/yyyy"
                          locale={es}
                          placeholderText="Fecha (dd/mm/yyyy)"
                          showIcon
                          toggleCalendarOnIconClick
                          wrapperClassName="w-full min-w-0"
                          popperClassName="habioo-datepicker-popper"
                          calendarClassName="habioo-datepicker-calendar"
                          className="h-[50px] w-full rounded-xl border border-gray-200 bg-white p-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          required
                        />
                      </FormField>
                    </div>
                    <div className="md:col-span-2">
                      <FormField label="Tasa de Cambio" required>
                        <div className="flex w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-donezo-primary">
                          <input
                            type="text"
                            name="tasa_cambio"
                            value={formPago.tasa_cambio}
                            readOnly={useAutoBcvMode || hasTasaBloqueada}
                            onChange={handlePagoChange}
                            placeholder={isLoadingAutoRate ? 'Cargando tasa...' : (useAutoBcvMode ? 'Tasa automática' : 'Ingrese tasa')}
                            required
                            className={`h-[50px] flex-1 border-0 px-3 outline-none dark:text-white ${
                              (useAutoBcvMode || hasTasaBloqueada) ? 'bg-gray-50 dark:bg-gray-800/70' : 'bg-white dark:bg-gray-800'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => { void fetchBcvRate(formPago.fecha_pago, false); }}
                            disabled={isLoadingAutoRate || hasTasaBloqueada}
                            className="h-[50px] min-w-[72px] border-l border-green-200 dark:border-green-800 bg-green-50 px-3 text-center text-xs font-black uppercase tracking-wider text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                          >
                            {isLoadingAutoRate ? '...' : 'BCV'}
                          </button>
                        </div>
                      </FormField>
                    </div>
                    <div className="md:col-span-3">
                      <FormField label="Cedula Origen" required>
                        <input type="text" name="cedula_origen" value={formPago.cedula_origen} onChange={handlePagoChange} pattern="^[VEJG][0-9]{5,9}$" placeholder="V12345678" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required />
                      </FormField>
                    </div>
                    <div className="md:col-span-3">
                      <FormField label="Banco de Origen" required>
                        <SearchableCombobox
                          options={bancoOrigenOptions}
                          value={formPago.banco_origen}
                          onChange={(value: string) => applyFormChange('banco_origen', value)}
                          placeholder="Seleccione banco..."
                          emptyMessage="Sin bancos"
                          className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                        />
                      </FormField>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                    <FormField label="Monto Pagado" required>
                      <input type="text" name="monto_origen" value={formPago.monto_origen} onChange={handlePagoChange} placeholder="0,00" className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary read-only:bg-gray-50 read-only:dark:bg-gray-800/70" required readOnly={hasMontoBsBloqueado} />
                    </FormField>
                    <FormField label="Fecha Pago" required>
                      <DatePicker
                        selected={ymdToDate(formPago.fecha_pago)}
                        onChange={(date: Date | Date[] | null) => {
                          const nextDate = toSingleDate(date);
                          handleFechaPagoChange(nextDate);
                        }}
                        {...(ymdToDate(getLocalYmd()) ? { maxDate: ymdToDate(getLocalYmd()) as Date } : {})}
                        dateFormat="dd/MM/yyyy"
                        locale={es}
                        placeholderText="Fecha (dd/mm/yyyy)"
                        showIcon
                        toggleCalendarOnIconClick
                        wrapperClassName="w-full min-w-0"
                        popperClassName="habioo-datepicker-popper"
                        calendarClassName="habioo-datepicker-calendar"
                        className="h-[50px] w-full rounded-xl border border-gray-200 bg-white p-3 pr-10 outline-none transition-all focus:ring-2 focus:ring-donezo-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        required
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {hasMontoBsBloqueado && (
                <div className="lg:col-span-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-200">
                  Monto bloqueado por trazabilidad bancaria: este pago viene de un ingreso ya registrado en estado de cuenta.
                </div>
              )}

              {requiresTasa && formPago.metodo_pago === 'Pago Movil' && (
                <div className="lg:col-span-2 grid gap-3 mt-3 border-t border-gray-100 dark:border-gray-800 pt-3 grid-cols-1 md:grid-cols-2">
                  {formPago.metodo_pago === 'Pago Movil' && (
                    <FormField label="Telefono Origen" required>
                      <input
                        type="text"
                        name="telefono_origen"
                        value={formPago.telefono_origen}
                        onChange={handlePagoChange}
                        inputMode="numeric"
                        pattern="^[0-9]{7,15}$"
                        placeholder="04141234567"
                        className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                        required
                      />
                    </FormField>
                  )}
                </div>
              )}

              {!soloCuentaPrincipal && (
                <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarDesvioExtra((prev) => {
                        const next = !prev;
                        if (!next) {
                          setDesviosGastos([]);
                        } else if (desviosGastos.length === 0) {
                          const defaultGastoId = gastosExtraDisponibles[0] ? String(gastosExtraDisponibles[0].id) : '';
                          setDesviosGastos([{
                            id: `${Date.now()}-0`,
                            gastoId: defaultGastoId,
                            montoBs: '',
                          }]);
                        }
                        return next;
                      });
                    }}
                    className="text-sm font-semibold text-donezo-primary hover:text-donezo-primary/80 transition-colors"
                  >
                    {mostrarDesvioExtra ? '- Quitar desvío a Gasto Extra' : '+ Asignar parte del pago a un Gasto Extra'}
                  </button>

                  {mostrarDesvioExtra && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <div className="col-span-6">Gasto Extra / Proyecto</div>
                        <div className="col-span-3">Monto a desviar (Bs)</div>
                        <div className="col-span-2">Equiv. USD</div>
                        <div className="col-span-1 text-right">Acción</div>
                      </div>
                      {desviosGastos.map((row: DesvioGastoDraftItem) => {
                        const tasa = getEffectiveRateForDesvio();
                        const usd = tasa > 0 ? (parseInputNumber(row.montoBs) / tasa) : 0;
                        const optionsForRow = getGastoOptionsForRow(row.id);
                        return (
                          <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-6">
                              <SearchableCombobox
                                options={optionsForRow}
                                value={row.gastoId}
                                onChange={(value: string) => updateDesvioRow(row.id, { gastoId: value })}
                                placeholder={loadingGastosExtra ? 'Cargando gastos...' : (optionsForRow.length ? 'Seleccione un gasto...' : 'Sin gastos disponibles')}
                                emptyMessage="Sin gastos extra"
                                className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="text"
                                value={row.montoBs}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDesvioRow(row.id, { montoBs: formatCurrencyInput(e.target.value, 2) })}
                                placeholder="0,00"
                                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary"
                              />
                            </div>
                            <div className="col-span-2 text-sm font-black text-emerald-600 dark:text-emerald-400">${formatMoney(usd)}</div>
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => removeDesvioRow(row.id)}
                                className="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={addDesvioRow}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          + Agregar fila de desvío
                        </button>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Tasa aplicada: {getEffectiveRateForDesvio() > 0 ? formatMoney(getEffectiveRateForDesvio(), 4) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Referencia" required={formPago.metodo_pago !== 'Efectivo'}>
                  <input type="text" name="referencia" value={formPago.referencia} onChange={handlePagoChange} placeholder={formPago.metodo_pago === 'Efectivo' ? 'EFECTIVO (opcional)' : 'Ref / Comprobante'} className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 outline-none focus:ring-2 focus:ring-donezo-primary" required={formPago.metodo_pago !== 'Efectivo'} />
                </FormField>
                {!esCuentaUsd && (
                  <div className="rounded-xl bg-green-50 dark:bg-green-900/10 px-3 py-2 flex justify-between items-center">
                    <span className="text-xs text-green-700 dark:text-green-500 font-bold uppercase tracking-wider">Abono Equivalente:</span>
                    <span className="font-black text-green-600 dark:text-green-400 text-lg">+ ${formatMoney(conversionUSD)}</span>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <div className="mt-6 flex justify-end space-x-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-donezo-primary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-donezo-primary border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-donezo-primary disabled:opacity-50"
                  >
                    {isSubmitting ? 'Procesando...' : 'Procesar Pago'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
    </ModalBase>
  );
};

const toNumber = (value: string | number | undefined | null): number => {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const parseInputNumber = (value: string | number | undefined | null): number => {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  // Regla de formato local: punto para miles y coma para decimales.
  // Si no hay coma, seguimos tratando los puntos como separadores de miles.
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/\./g, '').replace(/,/g, '');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

export default ModalRegistrarPago;
