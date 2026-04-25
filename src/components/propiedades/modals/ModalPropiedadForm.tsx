import { useState, type ChangeEvent, type FC } from 'react';
import ModalBase from '../../ui/ModalBase';
import FormField from '../../ui/FormField';
import { getCurrentBcvRate } from '../../../utils/bcv';
import type { ModalPropiedadFormProps } from './types';

export const ModalPropiedadForm: FC<ModalPropiedadFormProps> = ({
  isOpen,
  editingId,
  form,
  setForm,
  propietariosExistentes,
  handleChange,
  handleSubmit,
  setIsModalOpen
}) => {
  if (!isOpen) return null;

  const [isFetchingBCV, setIsFetchingBCV] = useState<boolean>(false);
  const [searchPropietarioExistente, setSearchPropietarioExistente] = useState<string>('');
  const [isPropietarioDropdownOpen, setIsPropietarioDropdownOpen] = useState<boolean>(false);

  const formatNumberInput = (value: string | number | undefined | null, maxDecimals = 2): string => {
    const strValue = String(value || '');
    const isNegative = strValue.trim().startsWith('-');
    let rawValue = strValue.replace(/[^0-9,]/g, '');
    if (isNegative && !rawValue) return '-';
    const parts = rawValue.split(',');
    if (parts.length > 2) rawValue = `${parts[0]},${parts.slice(1).join('')}`;
    let [integerPart, decimalPart] = rawValue.split(',');
    if (integerPart) integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = decimalPart !== undefined ? `${integerPart},${decimalPart.slice(0, maxDecimals)}` : (integerPart || '');
    if (!formatted) return '';
    return isNegative ? `-${formatted}` : formatted;
  };

  const parseNumberInput = (value: string | number | undefined | null): number => {
    if (!value) return 0;
    return parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
  };

  const deudasIniciales = Array.isArray(form.deudas_iniciales) ? form.deudas_iniciales : [];
  const esModoPropietarioExistente = !editingId && form.propietario_modo === 'EXISTENTE';

  const propietariosFiltrados = propietariosExistentes.filter((item) => {
    const q = searchPropietarioExistente.trim().toLowerCase();
    if (!q) return true;
    return item.nombre.toLowerCase().includes(q) || item.cedula.toLowerCase().includes(q);
  });
  const propietarioSeleccionado = propietariosExistentes.find((item) => String(item.id) === form.propietario_existente_id) || null;

  const seleccionarPropietarioExistente = (idValue: string): void => {
    const selected = propietariosExistentes.find((item) => String(item.id) === idValue);
    if (!selected) {
      setForm((prev) => ({
        ...prev,
        propietario_existente_id: '',
        prop_cedula: '',
        prop_nombre: '',
        prop_email: '',
        prop_telefono: '',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      propietario_existente_id: String(selected.id),
      prop_cedula: selected.cedula,
      prop_nombre: selected.nombre,
      prop_email: selected.email || '',
      prop_telefono: selected.telefono || '',
      prop_password: '',
    }));
  };

  const updateDeudaInicial = (index: number, field: 'concepto' | 'monto_deuda' | 'monto_abono', value: string): void => {
    const next = deudasIniciales.map((item, i) => {
      if (i !== index) return item;
      if (field === 'concepto') return { ...item, [field]: value };
      return { ...item, [field]: formatNumberInput(value) };
    });
    setForm({ ...form, deudas_iniciales: next });
  };

  const addDeudaInicial = (): void => {
    setForm({
      ...form,
      deudas_iniciales: [...deudasIniciales, { concepto: '', monto_deuda: '', monto_abono: '' }]
    });
  };

  const removeDeudaInicial = (index: number): void => {
    const next = deudasIniciales.filter((_, i) => i !== index);
    setForm({
      ...form,
      deudas_iniciales: next.length > 0 ? next : [{ concepto: '', monto_deuda: '', monto_abono: '' }]
    });
  };

  const toggleDeudaInicial = (): void => {
    const nextEnabled = !form.tiene_deuda_inicial;
    setForm({
      ...form,
      tiene_deuda_inicial: nextEnabled,
      deudas_iniciales: nextEnabled
        ? (deudasIniciales.length > 0 ? deudasIniciales : [{ concepto: '', monto_deuda: '', monto_abono: '' }])
        : deudasIniciales,
      ...(nextEnabled ? { monto_saldo_inicial: '', saldo_inicial_bs: '', tasa_bcv: '' } : {})
    });
  };

  const handleSaldoBsChange = (value: string): void => {
    const saldoBs = formatNumberInput(value);
    const tasa = form.tasa_bcv || '';
    const saldoUsd = parseNumberInput(tasa) > 0 ? (parseNumberInput(saldoBs) / parseNumberInput(tasa)).toFixed(2).replace('.', ',') : '';
    setForm({ ...form, saldo_inicial_bs: saldoBs, monto_saldo_inicial: saldoUsd });
  };

  const handleTasaChange = (value: string): void => {
    const tasaBcv = formatNumberInput(value, 4);
    const saldoBs = form.saldo_inicial_bs || '';
    const saldoUsd = parseNumberInput(tasaBcv) > 0 ? (parseNumberInput(saldoBs) / parseNumberInput(tasaBcv)).toFixed(2).replace('.', ',') : '';
    setForm({ ...form, tasa_bcv: tasaBcv, monto_saldo_inicial: saldoUsd });
  };

  const fetchBCV = async (): Promise<void> => {
    setIsFetchingBCV(true);
    try {
      const rate = await getCurrentBcvRate();
      if (!Number.isFinite(rate) || (rate ?? 0) <= 0) {
        alert('No se pudo obtener la tasa BCV actual.');
        return;
      }
      const formattedRate = Number(rate).toFixed(4).replace('.', ',');
      handleTasaChange(formattedRate);
    } catch (error) {
      alert('Error al consultar BCV.');
    } finally {
      setIsFetchingBCV(false);
    }
  };

  return (
    <ModalBase
      onClose={() => setIsModalOpen(false)}
      closeOnOverlayClick={false}
      title={editingId ? 'Editar Inmueble' : 'Nuevo Inmueble'}
      helpTooltip="Este formulario te permite registrar o editar un inmueble, propietario, datos de contacto y configuraciones iniciales de saldo/deuda."
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-donezo-primary mb-3 text-sm uppercase tracking-wider">1. Datos del Inmueble</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Identificador" required>
                <input type="text" name="identificador" value={form.identificador} onChange={handleChange} placeholder="Ej: A-12 o Casa 3" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required />
              </FormField>
              <FormField label="Alícuota (%)" required>
                <input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} placeholder="Ej: 3,125" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required />
              </FormField>

              {!editingId && (
                <div className="md:col-span-2 space-y-3">
                  <div
                    className="flex items-center gap-3 mb-1 cursor-pointer"
                    onClick={toggleDeudaInicial}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form.tiene_deuda_inicial)}
                      readOnly
                      className="w-5 h-5 text-donezo-primary"
                    />
                    <h4 className="font-bold text-gray-700 dark:text-gray-300">Crear deudas anteriores</h4>
                  </div>
                  {form.tiene_deuda_inicial ? (
                    <div className="space-y-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10 p-3">
                      {deudasIniciales.map((deuda, index) => (
                        <div key={`deuda-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                          <div className="md:col-span-6">
                            <FormField label="Concepto">
                              <input
                                type="text"
                                value={deuda.concepto}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'concepto', e.target.value)}
                                placeholder="Ej: Deuda mantenimiento enero"
                                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                              />
                            </FormField>
                          </div>
                          <div className="md:col-span-2">
                            <FormField label="Monto deuda ($)">
                              <input
                                type="text"
                                value={deuda.monto_deuda}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'monto_deuda', e.target.value)}
                                placeholder="0,00"
                                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                              />
                            </FormField>
                          </div>
                          <div className="md:col-span-2">
                            <FormField label="Monto abono ($)">
                              <input
                                type="text"
                                value={deuda.monto_abono}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDeudaInicial(index, 'monto_abono', e.target.value)}
                                placeholder="Opcional"
                                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                              />
                            </FormField>
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            <button
                              type="button"
                              onClick={addDeudaInicial}
                              className="flex-1 p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50 font-bold text-sm"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDeudaInicial(index)}
                              className="flex-1 p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50 font-bold text-sm"
                            >
                              -
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Cálculo automático por fila: <strong>Saldo neto = Monto deuda - Monto abono</strong>.
                        Ejemplo: deuda 120,00 y abono 20,00 = saldo neto 100,00.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField label="Saldo Inicial (Bs)">
                          <input
                            type="text"
                            value={form.saldo_inicial_bs || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleSaldoBsChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                        </FormField>
                        <FormField label="Tasa BCV">
                          <input
                            type="text"
                            value={form.tasa_bcv || ''}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleTasaChange(e.target.value)}
                            placeholder="Ej: 36,5000"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                        </FormField>
                        <button
                          type="button"
                          onClick={fetchBCV}
                          disabled={isFetchingBCV}
                          className="w-full p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-60"
                        >
                          {isFetchingBCV ? 'Consultando...' : 'BCV'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <FormField label="Saldo Inicial (USD)">
                          <input
                            type="text"
                            name="monto_saldo_inicial"
                            value={form.monto_saldo_inicial}
                            readOnly
                            placeholder="Calculado automáticamente"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800/80 outline-none text-gray-600 dark:text-gray-300 cursor-not-allowed"
                          />
                        </FormField>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Este campo se calcula automáticamente con la fórmula:
                          <strong> Saldo Inicial (USD) = Saldo Inicial (Bs) / Tasa BCV</strong>.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          El sistema interpreta el tipo por signo:
                          negativo = saldo a favor, positivo = deuda, cero = sin saldo.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <h4 className="font-bold text-blue-600 dark:text-blue-400 text-sm uppercase tracking-wider">2. Datos del Propietario (Login)</h4>
              {!editingId && (
                <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-600 p-1 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, propietario_modo: 'NUEVO', propietario_existente_id: '' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.propietario_modo === 'NUEVO' ? 'bg-donezo-primary text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    Propietario Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, propietario_modo: 'EXISTENTE' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.propietario_modo === 'EXISTENTE' ? 'bg-donezo-primary text-white' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    Existente
                  </button>
                </div>
              )}
            </div>
            {esModoPropietarioExistente && (
              <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-900/40 p-3 space-y-3">
                <FormField label="Buscar propietario existente">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchPropietarioExistente}
                      onFocus={() => setIsPropietarioDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsPropietarioDropdownOpen(false), 120)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setSearchPropietarioExistente(e.target.value);
                        setIsPropietarioDropdownOpen(true);
                      }}
                      placeholder={propietarioSeleccionado ? `${propietarioSeleccionado.nombre} (${propietarioSeleccionado.cedula})` : 'Escriba cédula o nombre'}
                      className="w-full p-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsPropietarioDropdownOpen((prev) => !prev);
                      }}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500"
                      title="Mostrar opciones"
                    >
                      ?
                    </button>
                    {isPropietarioDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                        {propietariosFiltrados.length > 0 ? propietariosFiltrados.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              seleccionarPropietarioExistente(String(item.id));
                              setSearchPropietarioExistente('');
                              setIsPropietarioDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-100"
                          >
                            {item.nombre} ({item.cedula})
                          </button>
                        )) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No hay propietarios que coincidan
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="hidden" value={form.propietario_existente_id} required={esModoPropietarioExistente} />
                </FormField>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Se vinculará este inmueble al propietario seleccionado sin crear un usuario nuevo.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Cédula (Usuario)" required>
                <p className="text-[11px] text-gray-400 mb-1">Formato: V, E, J o G seguido de numeros.</p>
                <input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} pattern="^[VEJG][0-9]{5,9}$" placeholder="Ej: V12345678" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase disabled:opacity-70 disabled:cursor-not-allowed" required disabled={esModoPropietarioExistente} />
              </FormField>
              <FormField label="Nombre Completo" required>
                <p className="text-[11px] text-transparent mb-1 select-none" aria-hidden="true">_</p>
                <input type="text" name="prop_nombre" value={form.prop_nombre} onChange={(e) => setForm((prev) => ({ ...prev, prop_nombre: e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }))} placeholder="Ej: Carlos Daniel Rojas" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} required />
              </FormField>
              <FormField label="Correo Electronico" required>
                <input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} placeholder="Ej: usuario@email.com" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} required />
              </FormField>
              <FormField label="Correo Secundario (Opcional)">
                <input type="email" name="prop_email_secundario" value={form.prop_email_secundario} onChange={handleChange} placeholder="Ej: usuario_sec@email.com" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </FormField>
              <FormField label="Telefono (WhatsApp)">
                <p className="text-[11px] text-gray-400 mb-1">Solo numeros, sin espacios ni guiones.</p>
                <input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" placeholder="Ej: 04141234567" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </FormField>
              <FormField label="Telefono Alternativo / Fijo">
                <p className="text-[11px] text-gray-400 mb-1">Solo numeros, sin espacios ni guiones.</p>
                <input type="text" name="prop_telefono_secundario" value={form.prop_telefono_secundario} onChange={handleChange} inputMode="numeric" pattern="^[0-9]{7,15}$" placeholder="Ej: 02121234567" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" disabled={esModoPropietarioExistente} />
              </FormField>
              {editingId && (
                <div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <FormField label={<span className="text-yellow-800 dark:text-yellow-500">Restablecer Contraseña</span>}>
                    <input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Nueva clave..." className="w-full p-2.5 rounded-xl border border-yellow-300 dark:bg-gray-800 outline-none dark:text-white" />
                  </FormField>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btnSubmitProp"
              className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30"
            >
              {editingId ? 'Guardar Cambios' : 'Registrar Inmueble'}
            </button>
          </div>
      </form>
    </ModalBase>
  );
};


