import React, { useCallback, useRef, useState } from 'react';
import type { FC, ChangeEvent, FormEvent } from 'react';
import ModalBase from '../../ui/ModalBase';
import FormField from '../../ui/FormField';
import { API_BASE_URL } from '../../../config/api';
import { useDialog } from '../../ui/DialogProvider';
import {
  sanitizeCedulaRif,
  sanitizePhone,
  sanitizeEmail,
  isValidEmail,
  isValidPhone,
  isValidCedulaRif,
} from '../../../utils/validators';
import type { Banco, FormState, Moneda, TipoCuenta } from '../types';
import { formatAba, formatSwift, parseAba, resolveTipoMoneda } from '../utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const INITIAL_FORM: FormState = {
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
  swift: '',
  aba: '',
};

const BANCOS_VENEZUELA: readonly string[] = [
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

const NATIONAL_TIPOS = ['Transferencia', 'Deposito', 'Pago Movil'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface BancoFormModalProps {
  bancoEditar?: Banco | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ApiActionResponse {
  status: string;
  message?: string;
}

// ─── Helper: Map banco to form state ────────────────────────────────────────

const mapBancoToForm = (banco: Banco): FormState => {
  const tipo = String(banco.tipo || 'Transferencia');
  const monedaStored = String(banco.moneda || '').toUpperCase();
  const monedaForced = resolveTipoMoneda(tipo).moneda;

  return {
    ...INITIAL_FORM,
    tipo,
    moneda:
      (monedaStored === 'USD' || monedaStored === 'BS'
        ? monedaStored
        : monedaForced) ?? 'BS',
    nombre_banco: String(banco.nombre_banco || ''),
    apodo: String(banco.apodo || ''),
    nombre_titular: String(banco.nombre_titular || ''),
    cedula_rif: String(banco.cedula_rif || ''),
    numero_cuenta: String(banco.numero_cuenta || ''),
    telefono: String(banco.telefono || ''),
    acepta_transferencia: Boolean(
      banco.acepta_transferencia ?? tipo === 'Transferencia'
    ),
    acepta_pago_movil: Boolean(
      banco.acepta_pago_movil ?? tipo === 'Pago Movil'
    ),
    pago_movil_telefono: String(
      banco.pago_movil_telefono || banco.telefono || ''
    ),
    pago_movil_cedula_rif: String(
      banco.pago_movil_cedula_rif || banco.cedula_rif || ''
    ),
    swift: String(banco.swift || ''),
    aba: banco.aba ? formatAba(String(banco.aba)) : '',
  };
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BancoFormModal: FC<BancoFormModalProps> = ({
  bancoEditar,
  onClose,
  onSuccess,
}) => {
  const { showAlert } = useDialog();

  // State
  const [form, setForm] = useState<FormState>(
    bancoEditar ? mapBancoToForm(bancoEditar) : INITIAL_FORM
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const submitLockRef = useRef<boolean>(false);

  // Form update helper
  const updateForm = useCallback(
    (updates: Partial<FormState>): void => {
      setForm((prev: FormState) => ({ ...prev, ...updates }));
    },
    []
  );

  // Event handlers
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const { name, value } = e.target;

      // Checkboxes
      if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
        const checked = e.target.checked;

        if (name === 'acepta_pago_movil') {
          updateForm({
            acepta_pago_movil: checked,
            pago_movil_telefono: checked ? form.pago_movil_telefono : '',
            pago_movil_cedula_rif: checked ? form.pago_movil_cedula_rif : '',
          });
          return;
        }

        updateForm({ [name]: checked });
        return;
      }

      // Currency change
      if (name === 'moneda') {
        const currency = value as Moneda;
        const defaultTipo: TipoCuenta =
          currency === 'USD' ? 'Zelle' : 'Transferencia';

        updateForm({
          moneda: currency,
          tipo: defaultTipo,
          nombre_banco: '',
          acepta_transferencia: defaultTipo === 'Transferencia',
          acepta_pago_movil: false,
          pago_movil_telefono: '',
          pago_movil_cedula_rif: '',
          swift: '',
          aba: '',
        });
        return;
      }

      // Account type change
      if (name === 'tipo') {
        const isTransferencia = value === 'Transferencia';
        const isDeposito = value === 'Deposito';
        const isPagoMovil = value === 'Pago Movil';
        const isTransIntl = value === 'Transferencia Internacional';

        updateForm({
          tipo: value,
          nombre_banco: '',
          swift: '',
          aba: '',
          acepta_transferencia:
            isTransferencia || isDeposito || isTransIntl,
          acepta_pago_movil: isPagoMovil
            ? true
            : isTransferencia
            ? form.acepta_pago_movil
            : false,
          pago_movil_telefono: isPagoMovil
            ? form.pago_movil_telefono || form.telefono
            : isTransferencia
            ? form.pago_movil_telefono
            : '',
          pago_movil_cedula_rif: isPagoMovil
            ? form.pago_movil_cedula_rif || form.cedula_rif
            : isTransferencia
            ? form.pago_movil_cedula_rif
            : '',
        });
        return;
      }

      // Field-specific formatters
      if (name === 'swift') {
        updateForm({ swift: formatSwift(value) });
        return;
      }

      if (name === 'aba') {
        updateForm({ aba: formatAba(value) });
        return;
      }

      if (name === 'telefono') {
        updateForm({ telefono: sanitizePhone(value) });
        return;
      }

      if (name === 'pago_movil_telefono') {
        updateForm({ pago_movil_telefono: sanitizePhone(value) });
        return;
      }

      if (name === 'numero_cuenta' && form.tipo === 'Zelle') {
        updateForm({ numero_cuenta: sanitizeEmail(value) });
        return;
      }

      // Default
      updateForm({ [name]: value });
    },
    [form, updateForm]
  );

  const handleCedulaChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      updateForm({
        cedula_rif: sanitizeCedulaRif(e.target.value, { withDash: true }),
      });
    },
    [updateForm]
  );

  const handlePagoMovilCedulaChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      updateForm({
        pago_movil_cedula_rif: sanitizeCedulaRif(e.target.value, {
          withDash: true,
        }),
      });
    },
    [updateForm]
  );

  // Validation
  const validateForm = useCallback(async (): Promise<boolean> => {
    // Validate cedula/rif for national transfers
    if (
      NATIONAL_TIPOS.includes(form.tipo as typeof NATIONAL_TIPOS[number]) &&
      !isValidCedulaRif(form.cedula_rif)
    ) {
      await showAlert({
        title: 'Dato invalido',
        message:
          'La cédula/RIF debe iniciar con V, E, J o G y contener solo números.',
        variant: 'warning',
      });
      return false;
    }

    // Validate phone for pago móvil
    if (form.tipo === 'Pago Movil' && !isValidPhone(form.telefono)) {
      await showAlert({
        title: 'Dato invalido',
        message: 'El teléfono debe contener solo números.',
        variant: 'warning',
      });
      return false;
    }

    // Validate pago móvil fields when enabled
    if (form.tipo === 'Transferencia' && form.acepta_pago_movil) {
      if (!isValidPhone(form.pago_movil_telefono || '')) {
        await showAlert({
          title: 'Dato invalido',
          message: 'Debe indicar un teléfono válido para pago móvil.',
          variant: 'warning',
        });
        return false;
      }
      if (!isValidCedulaRif(form.pago_movil_cedula_rif || '')) {
        await showAlert({
          title: 'Dato invalido',
          message: 'La cédula/RIF para pago móvil no es válida.',
          variant: 'warning',
        });
        return false;
      }
    }

    // Validate Zelle email
    if (form.tipo === 'Zelle' && !isValidEmail(form.numero_cuenta)) {
      await showAlert({
        title: 'Dato invalido',
        message: 'El correo de Zelle no tiene un formato válido.',
        variant: 'warning',
      });
      return false;
    }

    // Validate international transfer fields
    if (form.tipo === 'Transferencia Internacional') {
      if (form.swift.length !== 8 && form.swift.length !== 11) {
        await showAlert({
          title: 'Dato invalido',
          message:
            'El codigo SWIFT/BIC debe tener 8 u 11 caracteres alfanumericos.',
          variant: 'warning',
        });
        return false;
      }
      if (parseAba(form.aba).length !== 9) {
        await showAlert({
          title: 'Dato invalido',
          message: 'El numero ABA debe tener exactamente 9 digitos.',
          variant: 'warning',
        });
        return false;
      }
    }

    return true;
  }, [form, showAlert]);

  // Submission
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();

      if (isSaving || submitLockRef.current) return;

      const isValid = await validateForm();
      if (!isValid) return;

      const token = localStorage.getItem('habioo_token');
      const isEditing = Boolean(bancoEditar?.id);
      const endpoint = isEditing
        ? `${API_BASE_URL}/bancos/${bancoEditar?.id}`
        : `${API_BASE_URL}/bancos`;

      const payload = {
        ...form,
        swift:
          form.tipo === 'Transferencia Internacional'
            ? form.swift
            : undefined,
        aba:
          form.tipo === 'Transferencia Internacional'
            ? parseAba(form.aba)
            : undefined,
        acepta_transferencia:
          form.tipo === 'Transferencia'
            ? true
            : form.tipo === 'Pago Movil'
            ? false
            : form.acepta_transferencia,
        acepta_pago_movil:
          form.tipo === 'Pago Movil'
            ? true
            : form.tipo === 'Transferencia'
            ? form.acepta_pago_movil
            : false,
        pago_movil_telefono:
          form.tipo === 'Pago Movil'
            ? form.telefono
            : form.acepta_pago_movil
            ? form.pago_movil_telefono
            : '',
        pago_movil_cedula_rif:
          form.tipo === 'Pago Movil'
            ? form.cedula_rif
            : form.acepta_pago_movil
            ? form.pago_movil_cedula_rif
            : '',
      };

      try {
        submitLockRef.current = true;
        setIsSaving(true);

        const res = await fetch(endpoint, {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          onSuccess();
        } else {
          const err: ApiActionResponse = await res.json();
          await showAlert({
            title: 'Error',
            message: err.message || 'Error al guardar la cuenta bancaria',
            variant: 'danger',
          });
        }
      } catch (error) {
        console.error('Error saving banco:', error);
        await showAlert({
          title: 'Error de conexion',
          message: 'No se pudo guardar la cuenta.',
          variant: 'danger',
        });
      } finally {
        setIsSaving(false);
        submitLockRef.current = false;
      }
    },
    [form, bancoEditar, isSaving, validateForm, onSuccess, showAlert]
  );

  const handleClose = useCallback(() => {
    if (isSaving) return;
    onClose();
  }, [isSaving, onClose]);

  const isEditing = Boolean(bancoEditar);

  return (
    <ModalBase
      onClose={handleClose}
      title={isEditing ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
      maxWidth="max-w-6xl"
      disableClose={isSaving}
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Currency Selector */}
          <div className="md:col-span-3">
            <FormField label="Moneda" required>
              <div className="flex gap-3">
                <button
                  type="button"
                  name="moneda"
                  onClick={() =>
                    handleChange({
                      target: { name: 'moneda', value: 'BS' },
                    } as ChangeEvent<HTMLSelectElement>)
                  }
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold border transition-colors ${
                    form.moneda === 'BS'
                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                      : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Bs (Bolivares)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleChange({
                      target: { name: 'moneda', value: 'USD' },
                    } as ChangeEvent<HTMLSelectElement>)
                  }
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold border transition-colors ${
                    form.moneda === 'USD'
                      ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
                      : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  USD (Dolares)
                </button>
              </div>
            </FormField>
          </div>

          {/* Account Type (filtered by currency) */}
          <FormField label="Tipo de Cuenta" required>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              required
              className="w-full p-3 bg-blue-50 dark:bg-gray-800 text-blue-800 dark:text-white border border-blue-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            >
              {form.moneda === 'USD' ? (
                <>
                  <option value="Zelle">Zelle</option>
                  <option value="Transferencia Internacional">
                    Transferencia Internacional
                  </option>
                  <option value="Efectivo USD">Efectivo USD</option>
                </>
              ) : (
                <>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Deposito">Deposito</option>
                  <option value="Pago Movil">Pago Movil</option>
                  <option value="Efectivo BS">
                    Efectivo / Caja Chica (Bs)
                  </option>
                </>
              )}
            </select>
          </FormField>

          {/* Bank Institution (National) */}
          {NATIONAL_TIPOS.includes(
            form.tipo as (typeof NATIONAL_TIPOS)[number]
          ) && (
            <FormField label="Institucion Bancaria" required>
              <select
                name="nombre_banco"
                value={form.nombre_banco}
                onChange={handleChange}
                required
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              >
                <option value="" disabled className="text-gray-400">
                  Seleccione el banco...
                </option>
                {BANCOS_VENEZUELA.map((banco: string) => (
                  <option
                    key={banco}
                    value={banco}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {banco}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* Bank Name (International) */}
          {form.tipo === 'Transferencia Internacional' && (
            <FormField label="Nombre del Banco (EEUU)" required>
              <input
                type="text"
                name="nombre_banco"
                value={form.nombre_banco}
                onChange={handleChange}
                required
                placeholder="Ej: Wells Fargo, Bank of America..."
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </FormField>
          )}

          {/* Nickname */}
          <FormField label="Apodo (Referencia)" required>
            <input
              type="text"
              name="apodo"
              value={form.apodo}
              onChange={handleChange}
              required
              placeholder={
                form.tipo.startsWith('Efectivo')
                  ? 'Ej: Caja Chica Conserjeria'
                  : form.moneda === 'USD'
                  ? 'Ej: Zelle Principal'
                  : 'Ej: Principal / Pagos Bs'
              }
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
            />
          </FormField>

          {/* Account Holder */}
          <FormField
            label={
              form.tipo.startsWith('Efectivo')
                ? 'Custodio / Responsable'
                : 'Nombre del Titular'
            }
            required
          >
            <input
              type="text"
              name="nombre_titular"
              value={form.nombre_titular}
              onChange={handleChange}
              required
              placeholder="Ej: Junta de Condominio"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
            />
          </FormField>

          {/* ID/RIF (National) */}
          {NATIONAL_TIPOS.includes(
            form.tipo as (typeof NATIONAL_TIPOS)[number]
          ) && (
            <FormField label="Cedula / RIF" required>
              <input
                type="text"
                name="cedula_rif"
                value={form.cedula_rif}
                onChange={handleCedulaChange}
                pattern="^[VEJG]-?[0-9]{5,9}$"
                required
                placeholder="Ej: J-123456789"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
              />
            </FormField>
          )}

          {/* Account Number (Transferencia/Deposito) */}
          {['Transferencia', 'Deposito'].includes(form.tipo) && (
            <div className="space-y-3 md:col-span-3">
              <FormField label="Numero de Cuenta" required>
                <input
                  type="text"
                  name="numero_cuenta"
                  value={form.numero_cuenta}
                  onChange={handleChange}
                  required
                  placeholder="20 digitos"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                />
              </FormField>

              {/* Pago Móvil Option */}
              {form.tipo === 'Transferencia' && (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Pago Móvil Phone */}
          {form.tipo === 'Pago Movil' && (
            <FormField label="Telefono" required>
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                inputMode="numeric"
                pattern="^[0-9]{7,15}$"
                required
                placeholder="Ej: 04141234567"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
              />
            </FormField>
          )}

          {/* International Transfer Fields */}
          {form.tipo === 'Transferencia Internacional' && (
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Numero de Cuenta (Beneficiario)" required>
                <input
                  type="text"
                  name="numero_cuenta"
                  value={form.numero_cuenta}
                  onChange={handleChange}
                  required
                  placeholder="Ej: 123456789"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono"
                />
              </FormField>
              <FormField label="SWIFT / BIC" required>
                <input
                  type="text"
                  name="swift"
                  value={form.swift}
                  onChange={handleChange}
                  required
                  placeholder="Ej: BOFAUS3N"
                  maxLength={11}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono tracking-widest uppercase"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  8 u 11 caracteres alfanumericos · se formatea en mayusculas
                  automaticamente
                </p>
              </FormField>
              <FormField label="ABA (Routing Number)" required>
                <input
                  type="text"
                  name="aba"
                  value={form.aba}
                  onChange={handleChange}
                  required
                  placeholder="XXX-XXX-XXX"
                  inputMode="numeric"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono tracking-widest"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  9 digitos · formato XXX-XXX-XXX
                </p>
              </FormField>
            </div>
          )}

          {/* Zelle Email */}
          {form.tipo === 'Zelle' && (
            <FormField label="Correo Electronico" required>
              <input
                type="email"
                name="numero_cuenta"
                value={form.numero_cuenta}
                onChange={handleChange}
                required
                placeholder="correo@zelle.com"
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </FormField>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-donezo-primary hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving
              ? 'Guardando...'
              : isEditing
              ? 'Guardar Cambios'
              : 'Guardar Configuracion'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

export default BancoFormModal;
