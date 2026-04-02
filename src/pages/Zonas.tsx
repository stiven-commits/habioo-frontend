import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Pencil, Power, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';

interface ZonasProps {}

interface OutletContext {
  userRole: string;
}

interface Unidad {
  id: number;
  identificador: string;
}

interface Zona {
  id: number;
  nombre: string;
  activa: boolean;
  tiene_gastos: boolean;
  propiedades: Unidad[];
  propiedades_ids: number[];
}

interface ZonaForm {
  nombre: string;
  propiedades_ids: number[];
  activa: boolean;
}

interface ZonasApiSuccessResponse {
  status: 'success';
  scope?: 'juntas' | 'inmuebles';
  zonas: Zona[];
  todas_propiedades: Unidad[];
}

interface ApiActionResponse {
  status: string;
  message?: string;
  error?: string;
}

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface DialogContextValue {
  showConfirm: (opts: ConfirmDialogOptions) => Promise<boolean>;
  showAlert?: (opts: { title?: string; message?: string; confirmText?: string; variant?: DialogVariant }) => Promise<void>;
}

const Zonas: React.FC<ZonasProps> = () => {
  const { userRole } = useOutletContext<OutletContext>();
  const { showConfirm, showAlert } = useDialog() as DialogContextValue;
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [allUnits, setAllUnits] = useState<Unidad[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [scope, setScope] = useState<'juntas' | 'inmuebles'>('inmuebles');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hasGastos, setHasGastos] = useState<boolean>(false);
  const [form, setForm] = useState<ZonaForm>({ nombre: '', propiedades_ids: [], activa: true });

  const scopeLabelPlural = scope === 'juntas' ? 'Juntas individuales' : 'Inmuebles';
  const scopeLabelSingle = scope === 'juntas' ? 'junta individual' : 'inmueble';

  const selectedCount = useMemo(() => form.propiedades_ids.length, [form.propiedades_ids]);

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/zonas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as ZonasApiSuccessResponse;
      if (data.status === 'success') {
        setScope(data.scope === 'juntas' ? 'juntas' : 'inmuebles');
        setZonas(data.zonas || []);
        setAllUnits(data.todas_propiedades || []);
      }
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect((): void => {
    if (userRole === 'Administrador') void fetchData();
  }, [userRole]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
    setForm({ ...form, nombre: capitalized });
  };

  const toggleUnidad = (id: number): void => {
    if (hasGastos && editingId) return;
    setForm((prev: ZonaForm) => {
      const exists = prev.propiedades_ids.includes(id);
      return {
        ...prev,
        propiedades_ids: exists
          ? prev.propiedades_ids.filter((pid: number) => pid !== id)
          : [...prev.propiedades_ids, id],
      };
    });
  };

  const handleCreate = (): void => {
    setEditingId(null);
    setHasGastos(false);
    setForm({ nombre: '', propiedades_ids: [], activa: true });
    setIsModalOpen(true);
  };

  const handleEdit = (zona: Zona): void => {
    setEditingId(zona.id);
    setHasGastos(zona.tiene_gastos);
    setForm({
      nombre: zona.nombre,
      propiedades_ids: zona.propiedades_ids || [],
      activa: zona.activa,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (form.propiedades_ids.length === 0) {
      if (showAlert) {
        await showAlert({
          title: 'Selección requerida',
          message: `Debes seleccionar al menos un ${scopeLabelSingle}.`,
          confirmText: 'Entendido',
          variant: 'warning',
        });
      } else {
        alert(`Debes seleccionar al menos un ${scopeLabelSingle}.`);
      }
      return;
    }

    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `${API_BASE_URL}/zonas/${editingId}` : `${API_BASE_URL}/zonas`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as ApiActionResponse;

    if (data.status === 'success') {
      setIsModalOpen(false);
      await fetchData();
      return;
    }

    if (showAlert) {
      await showAlert({
        title: 'No se pudo guardar',
        message: data.error || data.message || 'Error al guardar el área/sector.',
        confirmText: 'Cerrar',
        variant: 'danger',
      });
    } else {
      alert(data.error || data.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await showConfirm({
      title: 'Eliminar área / sector',
      message: 'Esta acción eliminará el área/sector permanentemente. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`${API_BASE_URL}/zonas/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as ApiActionResponse;
    if (data.status === 'success') {
      await fetchData();
      return;
    }

    if (showAlert) {
      await showAlert({
        title: 'No se pudo eliminar',
        message: data.message || 'No se pudo eliminar el área/sector.',
        confirmText: 'Cerrar',
        variant: 'warning',
      });
      return;
    }
    alert(data.message || 'No se pudo eliminar el área/sector.');
  };

  const toggleStatus = async (zona: Zona): Promise<void> => {
    const nuevoEstado = !zona.activa;
    const ok = await showConfirm({
      title: nuevoEstado ? 'Activar área / sector' : 'Desactivar área / sector',
      message: nuevoEstado
        ? `Se habilitará "${zona.nombre}" para nuevos gastos.`
        : `Se deshabilitará "${zona.nombre}" para nuevos gastos.`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    await fetch(`${API_BASE_URL}/zonas/${zona.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nombre: zona.nombre,
        propiedades_ids: zona.propiedades_ids,
        activa: nuevoEstado,
      }),
    });
    await fetchData();
  };

  if (userRole !== 'Administrador') return <p className="p-6">Acceso denegado.</p>;

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Áreas / Sectores del Condominio"
        actions={
          <button
            onClick={handleCreate}
            className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-green-500/20"
          >
            + Crear área / sector
          </button>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
          Cargando áreas / sectores...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zonas.map((z: Zona) => (
            <div
              key={z.id}
              className={`p-6 rounded-2xl border transition-all ${
                z.activa
                  ? 'bg-white dark:bg-donezo-card-dark border-gray-200 dark:border-gray-800'
                  : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-80'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  {z.nombre}
                  {!z.activa && (
                    <StatusBadge color="gray" shape="tag" size="lg">
                      Inactiva
                    </StatusBadge>
                  )}
                </h4>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(z)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar detalles"
                  >
                    <Pencil size={16} />
                  </button>

                  {z.tiene_gastos ? (
                    <button
                      onClick={() => toggleStatus(z)}
                      className={`p-2 rounded-lg ${
                        z.activa ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={z.activa ? 'Desactivar para nuevos gastos' : 'Activar para nuevos gastos'}
                    >
                      <Power size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(z.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl h-36 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">
                  {scopeLabelPlural} ({z.propiedades.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {z.propiedades.map((p: Unidad) => (
                    <span
                      key={p.id}
                      className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-xs font-medium dark:text-gray-300"
                    >
                      {p.identificador}
                    </span>
                  ))}
                </div>
              </div>

              {z.tiene_gastos && (
                <p className="text-[11px] text-gray-500 mt-2 text-right">
                  Estructura bloqueada por historial contable.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar área / sector' : 'Nueva área / sector'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del área / sector
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={handleNameChange}
                  placeholder="Ej: Torre A, Locales Comerciales"
                  className="w-full h-12 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
                  required
                />
              </div>

              {hasGastos && editingId && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-900">
                    Esta área/sector tiene historial contable. Solo puedes cambiar el nombre o activarla/desactivarla.
                  </p>
                </div>
              )}

              <div
                className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${
                  hasGastos && editingId ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {scopeLabelPlural} en esta área / sector
                  </p>
                  <span className="text-xs font-bold text-donezo-primary">{selectedCount} seleccionados</span>
                </div>

                <div className="max-h-[340px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allUnits.map((unit: Unidad) => {
                    const selected = form.propiedades_ids.includes(unit.id);
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => toggleUnidad(unit.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                          selected
                            ? 'bg-green-50 border-green-500 text-green-900'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-donezo-primary'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selected ? 'bg-donezo-primary border-donezo-primary text-white' : 'border-gray-400'
                          }`}
                        >
                          {selected ? <Check size={12} /> : null}
                        </span>
                        <span className="truncate">{unit.identificador}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-donezo-primary text-white font-bold hover:bg-green-700 transition-colors"
                >
                  {editingId ? 'Guardar cambios' : 'Crear área / sector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Zonas;
