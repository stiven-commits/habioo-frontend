import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from '../ui/DatePicker';
import { es } from 'date-fns/locale/es';
import { API_BASE_URL } from '../../config/api';
import { formatMoney } from '../../utils/currency';

interface GastoPagoProveedor {
  gasto_id: number | string;
  monto_usd: number | string;
  monto_pagado_usd: number | string;
}

interface ICuentaBancaria {
  id: number | string;
  nombre_banco?: string;
  banco?: string;
  nombre?: string;
  tipo?: string;
  moneda?: string;
}

interface FondoPagoProveedor {
  id: number | string;
  cuenta_bancaria_id: number | string;
  nombre: string;
  moneda?: string;
  saldo_actual?: number | string;
}

interface ModalPagarProveedorProps {
  isOpen: boolean;
  onClose: () => void;
  gasto: GastoPagoProveedor;
  bancos: ICuentaBancaria[];
  fondos: FondoPagoProveedor[];
}

interface FilaOrigen {
  id: string;
  cuenta_bancaria_id: number | '';
  fondo_id: number | '';
  moneda: 'Bs' | 'USD' | '';
  requiere_ref: boolean;
  monto_input: string;
  tasa_cambio: number | '';
  monto_usd: number;
  referencia: string;
}

interface ApiResponse {
  status?: string;
  message?: string;
  error?: string;
}

const toNumber = (value: number | string | undefined | null): number => parseFloat(String(value ?? 0)) || 0;
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

const createFila = (): FilaOrigen => {
  const hasUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  return {
    id: hasUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cuenta_bancaria_id: '',
    fondo_id: '',
    moneda: '',
    requiere_ref: true,
    monto_input: '',
    tasa_cambio: '',
    monto_usd: 0,
    referencia: '',
  };
};

const parseFormattedAmount = (input: string): number => {
  if (!input.trim()) return 0;
  const normalized = input.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
};

const formatRateForInput = (value: number | ''): string => {
  if (value === '' || !Number.isFinite(value)) return '';
  const fixed = value.toFixed(3);
  const [intPart = '0', decPartRaw = ''] = fixed.split('.');
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = decPartRaw.replace(/0+$/, '');
  return decPart ? `${intWithDots},${decPart}` : intWithDots;
};

const formatCurrency = (value: string): string => {
  const clean = value.replace(/[^\d,]/g, '');
  const parts = clean.split(',');
  const intPartRaw = parts[0] || '';
  const decPartRaw = (parts[1] || '').slice(0, 2);

  const intPart = intPartRaw.replace(/^0+(?=\d)/, '') || '0';
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (clean.includes(',')) {
    return `${intWithDots},${decPartRaw}`;
  }
  return intWithDots === '0' && intPartRaw === '' ? '' : intWithDots;
};

const inferMonedaFromBanco = (banco?: ICuentaBancaria): 'Bs' | 'USD' => {
  if (!banco) return 'Bs';

  const monedaRaw = String(banco.moneda || '').toUpperCase();
  if (monedaRaw === 'USD' || monedaRaw.includes('USD') || monedaRaw.includes('DOLAR')) return 'USD';
  if (monedaRaw === 'BS' || monedaRaw.includes('BS') || monedaRaw.includes('VES')) return 'Bs';

  const tipo = String(banco.tipo || '').toLowerCase();
  if (tipo.includes('zelle') || tipo.includes('usd')) return 'USD';
  return 'Bs';
};

const ModalPagarProveedor: React.FC<ModalPagarProveedorProps> = ({ isOpen, onClose, gasto, bancos, fondos }) => {
  const [fecha, setFecha] = useState<string>('');
  const [nota, setNota] = useState<string>('');
  const [origenes, setOrigenes] = useState<FilaOrigen[]>([createFila()]);
  const [bcvLoadingById, setBcvLoadingById] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setFecha(getLocalYmd());
    setNota('');
    setOrigenes([createFila()]);
    setBcvLoadingById({});
    setErrorMsg('');
  }, [isOpen, gasto.gasto_id]);

  const saldoPendiente = useMemo<number>(() => {
    return Math.max(0, toNumber(gasto.monto_usd) - toNumber(gasto.monto_pagado_usd));
  }, [gasto.monto_usd, gasto.monto_pagado_usd]);

  const totalPagarUsd = useMemo<number>(() => {
    return origenes.reduce((acc: number, fila: FilaOrigen) => acc + (fila.monto_usd || 0), 0);
  }, [origenes]);

  const setFila = (filaId: string, updater: (fila: FilaOrigen) => FilaOrigen): void => {
    setOrigenes((prev: FilaOrigen[]) => prev.map((fila: FilaOrigen) => (fila.id === filaId ? updater(fila) : fila)));
  };

  const addFila = (): void => setOrigenes((prev: FilaOrigen[]) => [...prev, createFila()]);

  const removeFila = (filaId: string): void => {
    setOrigenes((prev: FilaOrigen[]) => {
      if (prev.length === 1) return prev;
      return prev.filter((fila: FilaOrigen) => fila.id !== filaId);
    });
  };

  const handleBancoChange = (filaId: string, bancoIdRaw: string): void => {
    const bancoId = bancoIdRaw ? parseInt(bancoIdRaw, 10) : '';
    const banco = bancos.find((b: ICuentaBancaria) => String(b.id) === String(bancoId));
    const moneda = inferMonedaFromBanco(banco);
    const tipo = String(banco?.tipo || '').toLowerCase();
    const requiereRef = !tipo.includes('efectivo');

    setFila(filaId, (fila: FilaOrigen) => ({
      ...fila,
      cuenta_bancaria_id: bancoId,
      fondo_id: '',
      moneda,
      requiere_ref: requiereRef,
      monto_input: '',
      tasa_cambio: moneda === 'USD' ? 1 : '',
      monto_usd: 0,
      referencia: '',
    }));
  };

  const handleFondoChange = (filaId: string, fondoIdRaw: string): void => {
    setFila(filaId, (fila: FilaOrigen) => ({
      ...fila,
      fondo_id: fondoIdRaw ? parseInt(fondoIdRaw, 10) : '',
    }));
  };

  const handleMontoChange = (filaId: string, raw: string): void => {
    const visual = formatCurrency(raw);
    const montoNumero = parseFormattedAmount(visual);

    setFila(filaId, (fila: FilaOrigen) => {
      if (fila.moneda === 'USD') {
        return {
          ...fila,
          monto_input: visual,
          monto_usd: montoNumero,
          tasa_cambio: 1,
        };
      }

      const tasa = toNumber(fila.tasa_cambio);
      const usd = tasa > 0 ? parseFloat((montoNumero / tasa).toFixed(2)) : 0;
      return {
        ...fila,
        monto_input: visual,
        monto_usd: usd,
      };
    });
  };

  const handleTasaChange = (filaId: string, value: string): void => {
    const tasaNumber = parseFormattedAmount(value);
    const tasa = tasaNumber > 0 ? parseFloat(tasaNumber.toFixed(3)) : '';
    setFila(filaId, (fila: FilaOrigen) => {
      const montoBs = parseFormattedAmount(fila.monto_input);
      const usd = Number(tasa) > 0 ? parseFloat((montoBs / Number(tasa)).toFixed(2)) : 0;
      return {
        ...fila,
        tasa_cambio: tasa,
        monto_usd: usd,
      };
    });
  };

  const handleReferenciaChange = (filaId: string, value: string): void => {
    setFila(filaId, (fila: FilaOrigen) => ({ ...fila, referencia: value }));
  };

  const fetchBcv = async (filaId: string): Promise<void> => {
    setBcvLoadingById((prev: Record<string, boolean>) => ({ ...prev, [filaId]: true }));
    setErrorMsg('');

    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!response.ok) throw new Error('No se pudo consultar la tasa BCV.');

      const data: unknown = await response.json();
      const promedio =
        typeof data === 'object' && data !== null && 'promedio' in data
          ? parseFloat(String((data as { promedio?: number | string }).promedio ?? 0))
          : 0;

      if (!Number.isFinite(promedio) || promedio <= 0) {
        throw new Error('La tasa BCV recibida no es válida.');
      }

      setFila(filaId, (fila: FilaOrigen) => {
        const montoBs = parseFormattedAmount(fila.monto_input);
        const usd = montoBs > 0 ? parseFloat((montoBs / promedio).toFixed(2)) : 0;
        return {
          ...fila,
          tasa_cambio: parseFloat(promedio.toFixed(3)),
          monto_usd: usd,
        };
      });
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Error consultando BCV.');
    } finally {
      setBcvLoadingById((prev: Record<string, boolean>) => ({ ...prev, [filaId]: false }));
    }
  };

  const hasInvalidRows = useMemo<boolean>(() => {
    return origenes.some((fila: FilaOrigen) => {
      if (!fila.cuenta_bancaria_id) return true;
      if (!fila.moneda) return true;

      const montoBase = parseFormattedAmount(fila.monto_input);
      if (montoBase <= 0) return true;

      if (fila.moneda === 'Bs') {
        if (toNumber(fila.tasa_cambio) <= 0) return true;
        if (fila.requiere_ref && !fila.referencia.trim()) return true;
      }

      if (fila.moneda === 'USD') {
        if (fila.requiere_ref && !fila.referencia.trim()) return true;
      }

      if (fila.monto_usd <= 0) return true;
      return false;
    });
  }, [origenes]);

  const isOverLimit = totalPagarUsd > saldoPendiente + 0.0001;

  const fondosInsuficientes = useMemo<string[]>(() => {
    const consumoPorFondo: Record<string, { nombre: string; solicitado: number; disponible: number }> = {};

    for (const fila of origenes) {
      if (!fila.fondo_id) continue;

      const fondo = fondos.find((f: FondoPagoProveedor) => String(f.id) === String(fila.fondo_id));
      if (!fondo) continue;

      const fondoId = String(fondo.id);
      const monedaFondo = String(fondo.moneda || '').toUpperCase();
      const montoOrigen = parseFormattedAmount(fila.monto_input);
      const montoDebitar = monedaFondo === 'USD' ? fila.monto_usd : montoOrigen;

      if (!consumoPorFondo[fondoId]) {
        consumoPorFondo[fondoId] = {
          nombre: fondo.nombre,
          solicitado: 0,
          disponible: toNumber(fondo.saldo_actual),
        };
      }

      consumoPorFondo[fondoId].solicitado += montoDebitar;
    }

    return Object.values(consumoPorFondo)
      .filter((item) => item.solicitado > item.disponible + 0.0001)
      .map((item) => `Saldo insuficiente en fondo "${item.nombre}". Disponible: ${formatMoney(item.disponible)}.`);
  }, [origenes, fondos]);

  const canSubmit =
    !saving &&
    Boolean(fecha) &&
    origenes.length > 0 &&
    totalPagarUsd > 0 &&
    !isOverLimit &&
    fondosInsuficientes.length === 0 &&
    !hasInvalidRows;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('habioo_token');
      const payload = {
        gasto_id: gasto.gasto_id,
        fecha,
        nota: nota.trim() || null,
        origenes: origenes.map((fila: FilaOrigen) => {
          const montoOrigen = parseFormattedAmount(fila.monto_input);
          return {
            cuenta_bancaria_id: fila.cuenta_bancaria_id,
            fondo_id: fila.fondo_id || undefined,
            moneda: fila.moneda,
            monto_origen: montoOrigen,
            tasa_cambio: fila.moneda === 'USD' ? 1 : toNumber(fila.tasa_cambio),
            monto_usd: fila.monto_usd,
            referencia: fila.referencia.trim() || undefined,
          };
        }),
      };

      const response = await fetch(`${API_BASE_URL}/pagos-proveedores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || data.error || 'No se pudo registrar el pago.');
      }

      onClose();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {saving && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm dark:bg-slate-900/70">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Cargando / Procesando pago...</p>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Pagar proveedor</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">Orígenes reactivos por banco seleccionado</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">Monto del gasto</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">${formatMoney(toNumber(gasto.monto_usd))}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">Ya pagado</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-100">${formatMoney(toNumber(gasto.monto_pagado_usd))}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">Saldo pendiente</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">${formatMoney(saldoPendiente)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-300">
                Fecha <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={ymdToDate(fecha)}
                onChange={(date: Date | Date[] | null) => setFecha(dateToYmd(toSingleDate(date)))}
                {...(() => {
                  const maxDate = ymdToDate(getLocalYmd());
                  return maxDate ? { maxDate } : {};
                })()}
                dateFormat="dd/MM/yyyy"
                locale={es}
                placeholderText="Fecha (dd/mm/yyyy)"
                showIcon
                toggleCalendarOnIconClick
                wrapperClassName="w-full min-w-0"
                popperClassName="habioo-datepicker-popper"
                calendarClassName="habioo-datepicker-calendar"
                disabled={saving}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Nota</label>
              <input
                type="text"
                value={nota}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNota(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Orígenes de pago</h3>
              <button
                type="button"
                onClick={addFila}
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                Agregar origen
              </button>
            </div>

            {origenes.map((fila: FilaOrigen) => {
              const fondosFila = fondos.filter((f: FondoPagoProveedor) => String(f.cuenta_bancaria_id) === String(fila.cuenta_bancaria_id || ''));
              const bancoSeleccionado = bancos.find((b: ICuentaBancaria) => String(b.id) === String(fila.cuenta_bancaria_id || ''));

              return (
                <div key={fila.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  {fila.moneda === 'Bs' ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 md:col-span-4">
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                            Banco <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={fila.cuenta_bancaria_id}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleBancoChange(fila.id, e.target.value)}
                            disabled={saving}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="">Seleccione banco...</option>
                            {bancos.map((b: ICuentaBancaria) => (
                              <option key={b.id} value={b.id}>
                                {(b.nombre_banco || b.nombre || b.banco || 'Banco')} - {b.tipo || 'N/A'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-12 md:col-span-4">
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">Fondo</label>
                          <select
                            value={fila.fondo_id}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFondoChange(fila.id, e.target.value)}
                            disabled={saving || !fila.cuenta_bancaria_id}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="">Sin fondo / tránsito</option>
                            {fondosFila.map((f: FondoPagoProveedor) => (
                              <option key={f.id} value={f.id}>
                                {f.nombre} {f.moneda ? `(${f.moneda})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-12 md:col-span-4">
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                            Monto (Bs) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={fila.monto_input}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMontoChange(fila.id, e.target.value)}
                            disabled={saving || !fila.cuenta_bancaria_id}
                            placeholder="0,00"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className={`${fila.requiere_ref ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-5'}`}>
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                            Tasa <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,000"
                              value={formatRateForInput(fila.tasa_cambio)}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTasaChange(fila.id, e.target.value)}
                              disabled={saving}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => fetchBcv(fila.id)}
                              disabled={saving || Boolean(bcvLoadingById[fila.id])}
                              className="rounded-xl bg-sky-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60"
                            >
                              {bcvLoadingById[fila.id] ? '...' : 'BCV'}
                            </button>
                          </div>
                        </div>

                        <div className={`${fila.requiere_ref ? 'col-span-12 md:col-span-3' : 'col-span-12 md:col-span-6'}`}>
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">Monto (USD)</label>
                          <input
                            type="number"
                            value={fila.monto_usd}
                            disabled
                            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          />
                        </div>

                        {fila.requiere_ref && (
                          <div className="col-span-12 md:col-span-4">
                            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                              Referencia <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={fila.referencia}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReferenciaChange(fila.id, e.target.value)}
                              disabled={saving}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        )}

                        <div className="col-span-12 md:col-span-1 flex md:justify-end">
                          <button
                            type="button"
                            onClick={() => removeFila(fila.id)}
                            disabled={saving || origenes.length === 1}
                            className="h-10 rounded-xl border border-red-200 px-3 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                            title="Eliminar fila"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 md:col-span-3">
                        <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                          Banco <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={fila.cuenta_bancaria_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleBancoChange(fila.id, e.target.value)}
                          disabled={saving}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="">Seleccione banco...</option>
                          {bancos.map((b: ICuentaBancaria) => (
                            <option key={b.id} value={b.id}>
                              {(b.nombre_banco || b.nombre || b.banco || 'Banco')} - {b.tipo || 'N/A'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`${fila.requiere_ref ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-5'}`}>
                        <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">Fondo</label>
                        <select
                          value={fila.fondo_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFondoChange(fila.id, e.target.value)}
                          disabled={saving || !fila.cuenta_bancaria_id}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="">Sin fondo / tránsito</option>
                          {fondosFila.map((f: FondoPagoProveedor) => (
                            <option key={f.id} value={f.id}>
                              {f.nombre} {f.moneda ? `(${f.moneda})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 md:col-span-2">
                        <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                          Monto (USD) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fila.monto_input}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMontoChange(fila.id, e.target.value)}
                          disabled={saving || !fila.cuenta_bancaria_id}
                          placeholder="0,00"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      {fila.requiere_ref && (
                        <div className="col-span-12 md:col-span-2">
                          <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                            Referencia <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={fila.referencia}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReferenciaChange(fila.id, e.target.value)}
                            disabled={saving}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      )}

                      <div className="col-span-12 md:col-span-1 flex md:justify-end">
                        <button
                          type="button"
                          onClick={() => removeFila(fila.id)}
                          disabled={saving || origenes.length === 1}
                          className="h-10 rounded-xl border border-red-200 px-3 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                          title="Eliminar fila"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    Cuenta: <strong>{bancoSeleccionado?.tipo || 'N/A'}</strong> | Moneda: <strong>{fila.moneda || 'N/A'}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-600 dark:text-slate-200">Saldo pendiente del gasto</span>
              <span className="font-black text-slate-700 dark:text-slate-100">${formatMoney(saldoPendiente)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-600 dark:text-slate-200">Total a pagar (USD)</span>
              <span className={`font-black ${isOverLimit ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                ${formatMoney(totalPagarUsd)}
              </span>
            </div>
            {isOverLimit && <p className="mt-2 text-xs font-semibold text-red-500">El total supera el saldo pendiente.</p>}
            {fondosInsuficientes.map((msg: string) => (
              <p key={msg} className="mt-2 text-xs font-semibold text-red-500">{msg}</p>
            ))}
            {errorMsg && <p className="mt-2 text-xs font-semibold text-red-500">{errorMsg}</p>}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">* Campos obligatorios</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Procesar pago
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalPagarProveedor;


