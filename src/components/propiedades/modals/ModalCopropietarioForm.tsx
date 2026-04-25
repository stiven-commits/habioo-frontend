import { useEffect, useState, type ChangeEvent, type FC } from 'react';
import ModalBase from '../../ui/ModalBase';
import FormField from '../../ui/FormField';
import type { ModalCopropietarioFormProps } from './types';

export const ModalCopropietarioForm: FC<ModalCopropietarioFormProps> = ({
  isOpen,
  propiedadIdentificador,
  form,
  copropietarios,
  copropietariosDraft,
  onClose,
  onSubmit,
  onChange,
  onEditChange,
  onSaveEdit,
  onDelete,
  isSubmitting = false,
  isLoadingList = false,
  savingCopropId = null,
  deletingCopropId = null
}) => {
  if (!isOpen) return null;

  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setExpandedId(null);
  }, [isOpen, copropietarios.length]);

  const handleNombreChange = (e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    onChange(e);
  };

  const handleEditNombreChange = (copropId: number, e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = e.target.value.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    onEditChange(copropId, e);
  };

  return (
    <ModalBase
      onClose={onClose}
      closeOnOverlayClick={false}
      title="Agregar Copropietario"
      helpTooltip="Permite crear, editar o eliminar copropietarios del inmueble y definir si tendran acceso de consulta al portal."
      subtitle={<>Inmueble: <strong>{propiedadIdentificador}</strong></>}
      maxWidth="max-w-xl"
      disableClose={isSubmitting}
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
                onChange={handleNombreChange}
                placeholder="Ej: María Fernanda Pérez"
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
                placeholder="Ej: copropietario@email.com"
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
            Permitir acceso al portal (solo lectura)
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            El copropietario tendrá acceso para consultar información y registrar pagos, pero la cobranza oficial y el recibo legal permanecen a nombre del propietario principal.
          </p>

          <div className="flex justify-end gap-3 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Copropietario'}
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-5">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Copropietarios registrados</h4>

          {isLoadingList ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando copropietarios...</p>
          ) : copropietarios.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay copropietarios registrados en este inmueble.</p>
          ) : (
            <div className="space-y-3">
              {copropietarios.map((coprop) => {
                const isOpenAccordion = expandedId === coprop.id;
                const draft = copropietariosDraft[coprop.id];
                if (!draft) return null;
                return (
                  <div key={coprop.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === coprop.id ? null : coprop.id))}
                      className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{draft.nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{draft.cedula || 'Sin cédula'} | {draft.email || 'Sin correo'}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-300">{isOpenAccordion ? '?' : '?'}</span>
                    </button>

                    {isOpenAccordion && (
                      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            name="cedula"
                            value={draft.cedula}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            pattern="^[VEJG][0-9]{5,9}$"
                            placeholder="Cédula"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase"
                          />
                          <input
                            type="text"
                            name="nombre"
                            value={draft.nombre}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleEditNombreChange(coprop.id, e)}
                            placeholder="Nombre completo"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                          <input
                            type="email"
                            name="email"
                            value={draft.email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            placeholder="Email"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                          <input
                            type="text"
                            name="telefono"
                            value={draft.telefono}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            inputMode="numeric"
                            pattern="^[0-9]{7,15}$"
                            placeholder="Teléfono"
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            name="acceso_portal"
                            checked={draft.acceso_portal}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => onEditChange(coprop.id, e)}
                            className="w-4 h-4 text-donezo-primary"
                          />
                          Permitir acceso al portal (solo lectura)
                        </label>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onDelete(coprop.id)}
                            disabled={deletingCopropId === coprop.id}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
                          >
                            {deletingCopropId === coprop.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSaveEdit(coprop.id)}
                            disabled={savingCopropId === coprop.id || deletingCopropId === coprop.id}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                          >
                            {savingCopropId === coprop.id ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </ModalBase>
  );
};



