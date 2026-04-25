import { type FC } from 'react';
import ModalBase from '../../ui/ModalBase';
import FormField from '../../ui/FormField';
import type { ModalResidenteFormProps } from './types';

export const ModalResidenteForm: FC<ModalResidenteFormProps> = ({
  isOpen,
  propiedadIdentificador,
  form,
  onClose,
  onSubmit,
  onChange,
  onDeleteExisting,
  isSubmitting = false,
  isDeleting = false,
  hasExistingResidente = false
}) => {
  if (!isOpen) return null;

  return (
    <ModalBase
      onClose={onClose}
      closeOnOverlayClick={false}
      title={hasExistingResidente ? 'Editar Residente / Inquilino' : 'Agregar Residente / Inquilino'}
      helpTooltip="Usa esta ventana para registrar o actualizar los datos del residente/inquilino y controlar su acceso al portal."
      subtitle={<>Inmueble: <strong>{propiedadIdentificador}</strong></>}
      maxWidth="max-w-xl"
      disableClose={isSubmitting || isDeleting}
    >
      <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Cédula" required>
              <input
                type="text"
                name="cedula"
                value={form.cedula}
                onChange={onChange}
                pattern="^[VEJG][0-9]{5,9}$"
                placeholder="Ej: V12345678"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase"
                required
              />
            </FormField>
            <FormField label="Nombre completo" required>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={onChange}
                placeholder="Ej: Carlos Daniel Rojas"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                required
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                placeholder="Ej: residente@email.com"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </FormField>
            <FormField label="Teléfono">
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={onChange}
                inputMode="numeric"
                pattern="^[0-9]{7,15}$"
                placeholder="Ej: 04141234567"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
              />
            </FormField>
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="acceso_portal"
              checked={form.acceso_portal}
              onChange={onChange}
              className="w-4 h-4 text-donezo-primary"
            />
            Permitir acceso al portal del residente / inquilino
          </label>

          <div className="flex justify-between gap-3 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <div>
              {hasExistingResidente && onDeleteExisting && (
                <button
                  type="button"
                  onClick={onDeleteExisting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/20 dark:border-red-800/50 dark:hover:bg-red-900/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar inquilino'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting || isDeleting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting || isDeleting}
            >
              {isSubmitting ? 'Guardando...' : hasExistingResidente ? 'Guardar Cambios' : 'Guardar Residente / Inquilino'}
            </button>
            </div>
          </div>
      </form>
    </ModalBase>
  );
};



